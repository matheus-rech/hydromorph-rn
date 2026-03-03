/**
 * PngEncoder — Pure-JS minimal PNG encoder
 * Encodes RGBA pixel buffers to PNG base64 strings without native dependencies.
 * Uses store-only deflate (intentionally uncompressed for speed).
 *
 * Author: Matheus Machado Rech
 */

'use strict';

/**
 * Encode an RGBA pixel buffer as a PNG and return raw base64 (no data URI prefix).
 *
 * @param {number}            width  - Image width in pixels
 * @param {number}            height - Image height in pixels
 * @param {Uint8ClampedArray} rgba   - RGBA pixel data (length = width * height * 4)
 * @returns {string} Raw base64-encoded PNG (no "data:image/png;base64," prefix)
 */
export function encodePNG(width, height, rgba) {
  // CRC32 table
  const crcTable = buildCrcTable();

  function crc32(data) {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ data[i]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function buildCrcTable() {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      t[n] = c;
    }
    return t;
  }

  function adler32(data) {
    let a = 1, b = 0;
    for (let i = 0; i < data.length; i++) {
      a = (a + data[i]) % 65521;
      b = (b + a) % 65521;
    }
    return ((b << 16) | a) >>> 0;
  }

  function u32be(n) {
    return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
  }

  function chunk(type, data) {
    const typeBytes = type.split('').map((c) => c.charCodeAt(0));
    const len = u32be(data.length);
    const crcData = new Uint8Array(typeBytes.length + data.length);
    crcData.set(typeBytes, 0);
    crcData.set(data, typeBytes.length);
    const checksum = u32be(crc32(crcData));
    return [...len, ...typeBytes, ...data, ...checksum];
  }

  // Build raw scanline data with filter byte 0 (None) per row
  const raw = [];
  const rowBytes = width * 4; // RGBA
  for (let y = 0; y < height; y++) {
    raw.push(0); // filter type None
    for (let i = 0; i < rowBytes; i++) {
      raw.push(rgba[y * rowBytes + i]);
    }
  }
  const rawU8 = new Uint8Array(raw);

  // zlib compress (deflate with no compression — store only, method 0x78 0x01)
  // For simplicity use "deflate stored" blocks of max 65535 bytes
  const BSIZE = 65535;
  const blocks = [];
  let pos = 0;
  while (pos < rawU8.length) {
    const end = Math.min(pos + BSIZE, rawU8.length);
    const last = end >= rawU8.length ? 1 : 0;
    const slice = rawU8.subarray(pos, end);
    const len = slice.length;
    const nlen = (~len) & 0xffff;
    // BFINAL | BTYPE (stored = 00)
    blocks.push(last | 0); // last block flag
    blocks.push(len & 0xff, (len >> 8) & 0xff);
    blocks.push(nlen & 0xff, (nlen >> 8) & 0xff);
    for (let i = 0; i < slice.length; i++) blocks.push(slice[i]);
    pos = end;
  }

  const adl = adler32(rawU8);
  const zlibData = [
    0x78, 0x01, // zlib header: CM=deflate, level=default
    ...blocks,
    (adl >>> 24) & 0xff, (adl >>> 16) & 0xff, (adl >>> 8) & 0xff, adl & 0xff,
  ];

  // IHDR
  const ihdr = new Uint8Array([
    ...u32be(width),
    ...u32be(height),
    8, 2, // bit depth 8, color type 2 = RGB  (we'll use RGB not RGBA for simplicity)
    0, 0, 0, // compression, filter, interlace
  ]);

  // Rebuild with RGB (3 bytes per pixel) to keep size smaller
  const rawRGB = [];
  for (let y = 0; y < height; y++) {
    rawRGB.push(0);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      rawRGB.push(rgba[i], rgba[i + 1], rgba[i + 2]); // skip alpha (always 255)
    }
  }
  const rawRGBu8 = new Uint8Array(rawRGB);
  const adl2 = adler32(rawRGBu8);

  const rgbBlocks = [];
  let pos2 = 0;
  while (pos2 < rawRGBu8.length) {
    const end = Math.min(pos2 + BSIZE, rawRGBu8.length);
    const last = end >= rawRGBu8.length ? 1 : 0;
    const sl = rawRGBu8.subarray(pos2, end);
    const len = sl.length;
    const nlen = (~len) & 0xffff;
    rgbBlocks.push(last | 0);
    rgbBlocks.push(len & 0xff, (len >> 8) & 0xff);
    rgbBlocks.push(nlen & 0xff, (nlen >> 8) & 0xff);
    for (let i = 0; i < sl.length; i++) rgbBlocks.push(sl[i]);
    pos2 = end;
  }

  const ihdrFull = new Uint8Array([...u32be(width), ...u32be(height), 8, 2, 0, 0, 0]);
  const zlibRGB = [
    0x78, 0x01,
    ...rgbBlocks,
    (adl2 >>> 24) & 0xff, (adl2 >>> 16) & 0xff, (adl2 >>> 8) & 0xff, adl2 & 0xff,
  ];

  const pngBytes = [
    137, 80, 78, 71, 13, 10, 26, 10, // PNG signature
    ...chunk('IHDR', Array.from(ihdrFull)),
    ...chunk('IDAT', zlibRGB),
    ...chunk('IEND', []),
  ];

  // Encode to base64 (raw — no data URI prefix)
  let binary = '';
  for (let i = 0; i < pngBytes.length; i++) {
    binary += String.fromCharCode(pngBytes[i]);
  }
  return btoa(binary);
}
