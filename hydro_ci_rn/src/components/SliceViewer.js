/**
 * SliceViewer — CT scan slice renderer
 *
 * Renders a single axial or coronal CT slice with ventricle overlay.
 * Converts raw pixel data (Uint8ClampedArray RGBA) to a base64 PNG
 * using a pure-JS PNG encoder, then displays via <Image>.
 *
 * For axial slices (mode='axial'): renders XY plane at z=sliceIndex
 * For coronal slices (mode='coronal'): renders XZ plane at y=sliceIndex
 *
 * Annotations are drawn as SVG overlays on top of the image.
 *
 * Author: Matheus Machado Rech
 */

import React, { useMemo } from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Svg, { Line, Circle, Text as SvgText } from 'react-native-svg';
import { colors, radius } from '../theme';
import { generateAxialPixels, generateCoronalPixels } from '../pipeline/Morphometrics';

// ─── Pure-JS minimal PNG encoder ──────────────────────────────────────────────
// Implements enough of PNG spec to encode RGBA images without native deps.

function encodePNG(width, height, rgba) {
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

  // Encode to base64
  let binary = '';
  for (let i = 0; i < pngBytes.length; i++) {
    binary += String.fromCharCode(pngBytes[i]);
  }
  return 'data:image/png;base64,' + btoa(binary);
}

// ─── SliceViewer component ────────────────────────────────────────────────────

const SCREEN_WIDTH = Dimensions.get('window').width;
const MAX_VIEWER_WIDTH = Math.min(SCREEN_WIDTH - 40, 480);

/**
 * @param {Float32Array}     volumeData      - flat float32 CT data
 * @param {Uint8Array}       mask            - ventricle mask
 * @param {number[]}         shape           - [X, Y, Z]
 * @param {number[]}         spacing         - [sx, sy, sz] mm
 * @param {'axial'|'coronal'} mode
 * @param {number}           sliceIndex      - current slice index
 * @param {boolean}          showMask        - whether to show ventricle overlay
 * @param {Object}           evansData       - Evans annotation data (axial only)
 * @param {Object}           callosalData    - Callosal annotation data (coronal only)
 * @param {number}           evansSlice      - best Evans slice (axial only)
 */
export default function SliceViewer({
  volumeData,
  mask,
  shape,
  spacing,
  mode = 'axial',
  sliceIndex,
  showMask = true,
  evansData,
  callosalData,
  evansSlice,
}) {
  const [X, Y, Z] = shape;

  // Image dimensions depend on view mode
  const imgWidth  = mode === 'axial' ? X : X;
  const imgHeight = mode === 'axial' ? Y : Z;

  // Compute display dimensions preserving aspect ratio
  const aspectRatio = imgWidth / imgHeight;
  const displayWidth  = MAX_VIEWER_WIDTH;
  const displayHeight = Math.round(displayWidth / aspectRatio);
  const scale = displayWidth / imgWidth;

  // Generate pixel data for current slice
  const base64Uri = useMemo(() => {
    if (!volumeData || !shape) return null;
    try {
      let pixels;
      if (mode === 'axial') {
        pixels = generateAxialPixels(volumeData, mask, shape, sliceIndex, showMask);
      } else {
        pixels = generateCoronalPixels(volumeData, mask, shape, sliceIndex);
      }
      return encodePNG(imgWidth, imgHeight, pixels);
    } catch (e) {
      console.warn('SliceViewer: failed to generate pixels', e);
      return null;
    }
  }, [volumeData, mask, shape, sliceIndex, showMask, mode]);

  // Build SVG annotation
  const annotation = useMemo(() => {
    if (mode === 'axial' && evansData && sliceIndex === evansSlice) {
      return buildEvansAnnotation(evansData, evansSlice, scale, displayWidth, displayHeight);
    }
    if (mode === 'coronal' && callosalData && callosalData.vertex) {
      return buildCallosalAnnotation(callosalData, Z, scale, displayWidth, displayHeight);
    }
    return null;
  }, [mode, evansData, callosalData, sliceIndex, evansSlice, scale, displayWidth, displayHeight, Z]);

  if (!base64Uri) {
    return (
      <View style={[styles.placeholder, { width: displayWidth, height: displayHeight }]}>
        <Text style={styles.placeholderText}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, { width: displayWidth, height: displayHeight }]}>
      <Image
        source={{ uri: base64Uri }}
        style={{ width: displayWidth, height: displayHeight }}
        resizeMode="stretch"
      />
      {annotation && (
        <Svg
          style={StyleSheet.absoluteFill}
          width={displayWidth}
          height={displayHeight}
        >
          {annotation}
        </Svg>
      )}
    </View>
  );
}

// ─── Annotation builders ──────────────────────────────────────────────────────

function buildEvansAnnotation(evansData, evansSlice, scale, W, H) {
  if (!evansData || !evansData.perSlice) return null;
  const sliceData = evansData.perSlice.find((s) => s.z === evansSlice);
  if (!sliceData) return null;

  const { ventLeft, ventRight, skullLeft, skullRight } = sliceData;
  const sy = Math.floor(H * 0.4); // draw at ~40% height

  return (
    <>
      {/* Ventricle width line (blue) */}
      <Line
        x1={ventLeft * scale}
        y1={sy}
        x2={ventRight * scale}
        y2={sy}
        stroke={colors.accent}
        strokeWidth={2}
      />
      {/* Skull width line (orange) */}
      <Line
        x1={skullLeft * scale}
        y1={sy + 8}
        x2={skullRight * scale}
        y2={sy + 8}
        stroke={colors.orange}
        strokeWidth={2}
      />
      {/* Labels */}
      <SvgText
        x={ventLeft * scale}
        y={sy - 5}
        fill={colors.accent}
        fontSize={Math.max(10, 12 * scale)}
        fontFamily="monospace"
      >
        V
      </SvgText>
      <SvgText
        x={skullLeft * scale}
        y={sy + 22}
        fill={colors.orange}
        fontSize={Math.max(10, 12 * scale)}
        fontFamily="monospace"
      >
        S
      </SvgText>
    </>
  );
}

function buildCallosalAnnotation(callosalData, Z, scale, W, H) {
  if (!callosalData || !callosalData.vertex) return null;

  const { vertex, leftPt, rightPt, angleDeg } = callosalData;

  // Flip z: z=0 → bottom, z=Z-1 → top
  const vx = vertex.x * scale;
  const vz = (Z - 1 - vertex.z) * scale;
  const lx = leftPt.x * scale;
  const lz = (Z - 1 - leftPt.z) * scale;
  const rx = rightPt.x * scale;
  const rz = (Z - 1 - rightPt.z) * scale;

  return (
    <>
      {/* Dashed lines from vertex to left and right points */}
      <Line
        x1={vx} y1={vz} x2={lx} y2={lz}
        stroke={colors.cyan}
        strokeWidth={2.5}
        strokeDasharray="4 3"
      />
      <Line
        x1={vx} y1={vz} x2={rx} y2={rz}
        stroke={colors.cyan}
        strokeWidth={2.5}
        strokeDasharray="4 3"
      />
      {/* Vertex dot */}
      <Circle cx={vx} cy={vz} r={5} fill={colors.cyan} />
      {/* Left point dot */}
      <Circle cx={lx} cy={lz} r={4} fill={colors.orange} />
      {/* Right point dot */}
      <Circle cx={rx} cy={rz} r={4} fill={colors.orange} />
      {/* Angle label */}
      {angleDeg !== null && (
        <SvgText
          x={vx + 8}
          y={vz - 8}
          fill={colors.cyan}
          fontSize={14}
          fontWeight="bold"
          fontFamily="monospace"
        >
          {angleDeg}°
        </SvgText>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#000',
    position: 'relative',
  },
  placeholder: {
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: colors.muted,
    fontSize: 13,
  },
});
