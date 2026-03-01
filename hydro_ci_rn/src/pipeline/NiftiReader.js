/**
 * NIfTI-1 File Parser with gzip support
 * HydroMorph — React Native port of nifti-reader.js
 * Supports .nii and .nii.gz files
 * Author: Matheus Machado Rech
 */

import pako from 'pako';

// NIfTI-1 datatype codes
const NIFTI_TYPE = {
  UINT8:   2,
  INT16:   4,
  INT32:   8,
  FLOAT32: 16,
  FLOAT64: 64,
  UINT16:  512,
};

/**
 * Parse a NIfTI-1 file from an ArrayBuffer.
 * Handles .nii (raw) and .nii.gz (gzip compressed).
 * Returns { shape, spacing, affine, data, header }
 */
export async function parseNifti(arrayBuffer) {
  let buffer = arrayBuffer;

  // Detect gzip by magic bytes (1f 8b)
  const magic = new Uint8Array(buffer, 0, 2);
  if (magic[0] === 0x1f && magic[1] === 0x8b) {
    // Decompress using pako
    const compressed = new Uint8Array(buffer);
    const decompressed = pako.inflate(compressed);
    buffer = decompressed.buffer;
  }

  const view = new DataView(buffer);

  // Detect endianness via sizeof_hdr (must be 348)
  let littleEndian = true;
  const hdrSizeLE = view.getInt32(0, true);
  if (hdrSizeLE !== 348) {
    const hdrSizeBE = view.getInt32(0, false);
    if (hdrSizeBE === 348) {
      littleEndian = false;
    } else {
      throw new Error(`Invalid NIfTI header size: ${hdrSizeLE} (LE) / ${hdrSizeBE} (BE)`);
    }
  }

  // Read dim array (int16 × 8 starting at offset 40)
  const ndim = view.getInt16(40, littleEndian);
  const dimX = view.getInt16(42, littleEndian);
  const dimY = view.getInt16(44, littleEndian);
  const dimZ = view.getInt16(46, littleEndian);

  if (ndim < 3) throw new Error(`NIfTI has only ${ndim} dimensions, need at least 3`);
  if (dimX < 1 || dimY < 1 || dimZ < 1)
    throw new Error(`Invalid dimensions: ${dimX}×${dimY}×${dimZ}`);

  // Read datatype (int16 at offset 70)
  const datatype = view.getInt16(70, littleEndian);

  // Read bitpix (int16 at offset 72)
  const bitpix = view.getInt16(72, littleEndian);

  // Read pixdim (float32 × 8 starting at offset 76)
  // pixdim[1..3] = voxel spacing in mm
  const sx = Math.abs(view.getFloat32(80, littleEndian)); // pixdim[1]
  const sy = Math.abs(view.getFloat32(84, littleEndian)); // pixdim[2]
  const sz = Math.abs(view.getFloat32(88, littleEndian)); // pixdim[3]

  // Validate spacing
  const spacingX = (sx > 0 && sx < 100) ? sx : 1.0;
  const spacingY = (sy > 0 && sy < 100) ? sy : 1.0;
  const spacingZ = (sz > 0 && sz < 100) ? sz : 1.0;

  // Read vox_offset (float32 at offset 108) — where image data starts
  let voxOffset = Math.round(view.getFloat32(108, littleEndian));
  if (voxOffset < 348) voxOffset = 352; // default NIfTI-1 offset

  // Read sform_code (int16 at offset 252)
  const sformCode = view.getInt16(252, littleEndian);

  // Read sform affine (3 rows × 4 float32 values)
  const affine = [
    [view.getFloat32(280, littleEndian), view.getFloat32(284, littleEndian),
     view.getFloat32(288, littleEndian), view.getFloat32(292, littleEndian)],
    [view.getFloat32(296, littleEndian), view.getFloat32(300, littleEndian),
     view.getFloat32(304, littleEndian), view.getFloat32(308, littleEndian)],
    [view.getFloat32(312, littleEndian), view.getFloat32(316, littleEndian),
     view.getFloat32(320, littleEndian), view.getFloat32(324, littleEndian)],
    [0, 0, 0, 1]
  ];

  // If sform is not valid, build a simple diagonal affine from pixdim
  const affineValid =
    sformCode > 0 &&
    (Math.abs(affine[0][0]) + Math.abs(affine[1][1]) + Math.abs(affine[2][2]) > 0.01);
  const finalAffine = affineValid
    ? affine
    : [
        [spacingX, 0, 0, 0],
        [0, spacingY, 0, 0],
        [0, 0, spacingZ, 0],
        [0, 0, 0, 1],
      ];

  // Read raw image data
  const totalVoxels = dimX * dimY * dimZ;
  const dataBuffer = buffer.slice(voxOffset);

  let rawData;
  try {
    rawData = readTypedData(dataBuffer, datatype, totalVoxels, littleEndian);
  } catch (e) {
    throw new Error(`Failed to read image data (datatype=${datatype}): ${e.message}`);
  }

  // Convert to Float32Array
  const float32Data = new Float32Array(totalVoxels);
  for (let i = 0; i < totalVoxels; i++) {
    float32Data[i] = rawData[i];
  }

  return {
    shape: [dimX, dimY, dimZ],
    spacing: [spacingX, spacingY, spacingZ],
    affine: finalAffine,
    data: float32Data,
    header: {
      ndim,
      datatype,
      bitpix,
      voxOffset,
      sformCode,
      dims: [dimX, dimY, dimZ],
      pixdim: [spacingX, spacingY, spacingZ],
    },
  };
}

function readTypedData(buffer, datatype, count, littleEndian) {
  switch (datatype) {
    case NIFTI_TYPE.UINT8: {
      return new Uint8Array(buffer, 0, count);
    }
    case NIFTI_TYPE.INT16: {
      const aligned = ensureAligned(buffer, count * 2);
      const arr = new Int16Array(aligned, 0, count);
      if (littleEndian !== isLittleEndianSystem()) swapBytes(arr, 2);
      return arr;
    }
    case NIFTI_TYPE.INT32: {
      const aligned = ensureAligned(buffer, count * 4);
      const arr = new Int32Array(aligned, 0, count);
      if (littleEndian !== isLittleEndianSystem()) swapBytes(arr, 4);
      return arr;
    }
    case NIFTI_TYPE.FLOAT32: {
      const aligned = ensureAligned(buffer, count * 4);
      const arr = new Float32Array(aligned, 0, count);
      if (littleEndian !== isLittleEndianSystem()) swapBytes(arr, 4);
      return arr;
    }
    case NIFTI_TYPE.FLOAT64: {
      const aligned = ensureAligned(buffer, count * 8);
      const arr = new Float64Array(aligned, 0, count);
      if (littleEndian !== isLittleEndianSystem()) swapBytes(arr, 8);
      const f32 = new Float32Array(count);
      for (let i = 0; i < count; i++) f32[i] = arr[i];
      return f32;
    }
    case NIFTI_TYPE.UINT16: {
      const aligned = ensureAligned(buffer, count * 2);
      const arr = new Uint16Array(aligned, 0, count);
      if (littleEndian !== isLittleEndianSystem()) swapBytes(arr, 2);
      return arr;
    }
    default:
      throw new Error(`Unsupported datatype: ${datatype}`);
  }
}

function ensureAligned(buffer, byteLength) {
  const aligned = new ArrayBuffer(byteLength);
  new Uint8Array(aligned).set(
    new Uint8Array(buffer, 0, Math.min(byteLength, buffer.byteLength))
  );
  return aligned;
}

function isLittleEndianSystem() {
  const buf = new ArrayBuffer(2);
  new Uint16Array(buf)[0] = 0xff00;
  return new Uint8Array(buf)[0] === 0x00;
}

function swapBytes(arr, bytesPerElement) {
  const u8 = new Uint8Array(arr.buffer);
  for (let i = 0; i < arr.length; i++) {
    const off = i * bytesPerElement;
    for (let j = 0; j < bytesPerElement / 2; j++) {
      const tmp = u8[off + j];
      u8[off + j] = u8[off + bytesPerElement - 1 - j];
      u8[off + bytesPerElement - 1 - j] = tmp;
    }
  }
}
