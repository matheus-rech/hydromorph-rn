/**
 * HydroMorph — Main Pipeline Orchestrator
 * React Native port of runPipeline() from app.js
 *
 * Coordinates: brain mask → CSF → morphology → components
 * → Evans Index → Callosal Angle → Volume → NPH score
 *
 * Author: Matheus Machado Rech
 */

import pako from 'pako';
import { parseNifti } from './NiftiReader';
import {
  voxelIndex,
  closing3D,
  opening3D,
  keepLargestComponent,
  keepLargeComponents,
  computeEvansIndex,
  computeCallosalAngle,
} from './Morphometrics';

// ─── Pipeline steps definition ────────────────────────────────────────────────

export const PIPELINE_STEPS = [
  'Parsing NIfTI header',
  'Building brain mask',
  'Extracting CSF voxels',
  'Morphological filtering',
  'Isolating ventricles',
  'Computing Evans Index',
  'Computing callosal angle',
  'Computing volume',
  'Generating report',
];

// ─── Async delay helper ───────────────────────────────────────────────────────

function delay(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Main Pipeline ────────────────────────────────────────────────────────────

/**
 * Run the full hydrocephalus morphometrics pipeline.
 *
 * @param {Object} volume - { shape, spacing, data, header }
 * @param {Function} onProgress - (stepIndex: number, message: string) => void
 * @returns {Object} results with all metrics
 */
export async function runPipeline(volume, onProgress = () => {}) {
  const { shape, spacing, data } = volume;
  const [X, Y, Z] = shape;
  const total = X * Y * Z;

  const progress = (step, msg) => {
    onProgress(step, msg);
  };

  // ── Step 0: Header already parsed ────────────────────────────────────────
  progress(0, `Volume: ${X}×${Y}×${Z}, spacing: ${spacing.map((s) => s.toFixed(2)).join('×')} mm`);
  await delay(50);

  // ── Step 1: Brain mask ────────────────────────────────────────────────────
  progress(1, 'Thresholding brain tissue (HU: -5 to 80)...');
  await delay(10);

  const brainMaskRaw = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    const hu = data[i];
    brainMaskRaw[i] = hu >= -5 && hu <= 80 ? 1 : 0;
  }

  // Closing to fill small gaps (2 iterations)
  progress(1, 'Closing brain mask...');
  await delay(10);
  let brainMask = closing3D(brainMaskRaw, shape, 2);

  // Keep largest component
  progress(1, 'Keeping largest brain component...');
  await delay(10);
  brainMask = keepLargestComponent(brainMask, shape, 1000);

  let brainVoxCount = 0;
  for (let i = 0; i < total; i++) brainVoxCount += brainMask[i];
  progress(1, `Brain mask: ${brainVoxCount.toLocaleString()} voxels`);
  await delay(20);

  // ── Step 2: CSF mask ──────────────────────────────────────────────────────
  progress(2, 'Extracting CSF (HU: 0 to 22) within brain...');
  await delay(10);

  const csfMask = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    const hu = data[i];
    csfMask[i] = brainMask[i] === 1 && hu >= 0 && hu <= 22 ? 1 : 0;
  }

  let csfCount = 0;
  for (let i = 0; i < total; i++) csfCount += csfMask[i];
  progress(2, `CSF voxels: ${csfCount.toLocaleString()}`);
  await delay(20);

  // ── Step 3: Morphological filtering ──────────────────────────────────────
  progress(3, 'Applying morphological filtering...');
  await delay(10);

  // Adaptive opening: only apply for "normal" resolution range (0.7–2.5mm).
  // Very high-res (< 0.7mm) or low-res (> 2.5mm) volumes skip opening.
  const minSpacingXY = Math.min(spacing[0], spacing[1]);
  let ventMask;
  if (minSpacingXY < 0.7 || minSpacingXY > 2.5) {
    progress(3, 'Adaptive filtering — skipping erosion for this resolution...');
    ventMask = new Uint8Array(csfMask);
  } else {
    ventMask = opening3D(csfMask, shape, 1);
  }
  await delay(20);

  // ── Step 4: Restrict to central 60% of brain bounding box ────────────────
  progress(4, 'Restricting to central brain region (ventricles are central)...');
  await delay(10);

  // Compute brain bounding box
  let bxMin = X, bxMax = 0, byMin = Y, byMax = 0, bzMin = Z, bzMax = 0;
  for (let z = 0; z < Z; z++) {
    for (let y = 0; y < Y; y++) {
      for (let x = 0; x < X; x++) {
        if (brainMask[voxelIndex(shape, x, y, z)] === 1) {
          if (x < bxMin) bxMin = x; if (x > bxMax) bxMax = x;
          if (y < byMin) byMin = y; if (y > byMax) byMax = y;
          if (z < bzMin) bzMin = z; if (z > bzMax) bzMax = z;
        }
      }
    }
  }

  // Central 60%: trim 20% from each lateral side, 10% from z (ventricles span more vertically)
  const marginX = Math.floor((bxMax - bxMin) * 0.20);
  const marginY = Math.floor((byMax - byMin) * 0.20);
  const marginZ = Math.floor((bzMax - bzMin) * 0.10);

  const cropXmin = bxMin + marginX, cropXmax = bxMax - marginX;
  const cropYmin = byMin + marginY, cropYmax = byMax - marginY;
  const cropZmin = bzMin + marginZ, cropZmax = bzMax - marginZ;

  for (let z = 0; z < Z; z++) {
    for (let y = 0; y < Y; y++) {
      for (let x = 0; x < X; x++) {
        const idx = voxelIndex(shape, x, y, z);
        if (ventMask[idx] === 0) continue;
        if (
          x < cropXmin || x > cropXmax ||
          y < cropYmin || y > cropYmax ||
          z < cropZmin || z > cropZmax
        ) {
          ventMask[idx] = 0;
        }
      }
    }
  }

  // ── Step 4b: Keep components > adaptive threshold (~0.5 mL) ──────────────
  const voxVol = spacing[0] * spacing[1] * spacing[2];
  const minVolumeMl = 0.5;
  const minComponentSize = Math.max(50, Math.round((minVolumeMl * 1000) / voxVol));
  progress(4, `Filtering connected components (>${minComponentSize} voxels, ~${minVolumeMl} mL)...`);
  await delay(10);

  ventMask = keepLargeComponents(ventMask, shape, minComponentSize);

  let ventCount = 0;
  for (let i = 0; i < total; i++) ventCount += ventMask[i];
  progress(4, `Ventricle voxels: ${ventCount.toLocaleString()}`);
  await delay(20);

  if (ventCount < 100) {
    throw new Error(
      `Very few ventricle voxels found (${ventCount}). ` +
      'Is this a head CT with HU values? Check that your file is a CT scan in Hounsfield Units.'
    );
  }

  // ── Step 5: Evans Index ───────────────────────────────────────────────────
  progress(5, 'Computing Evans Index per axial slice...');
  await delay(10);
  const evansResult = computeEvansIndex(data, ventMask, shape, spacing);
  await delay(20);

  // ── Step 6: Callosal Angle ────────────────────────────────────────────────
  progress(6, 'Computing callosal angle on coronal view...');
  await delay(10);
  const callosalResult = computeCallosalAngle(ventMask, shape, spacing);
  await delay(20);

  // ── Step 7: Volume ────────────────────────────────────────────────────────
  progress(7, 'Computing ventricle volume...');
  const voxelVol = spacing[0] * spacing[1] * spacing[2]; // mm³
  const ventVolMm3 = ventCount * voxelVol;
  const ventVolMl = ventVolMm3 / 1000;
  await delay(10);

  // ── Step 8: NPH Probability ───────────────────────────────────────────────
  progress(8, 'Generating clinical report...');
  await delay(20);

  let nphScore = 0;
  if (evansResult.maxEvans > 0.3) nphScore++;
  if (callosalResult.angleDeg !== null && callosalResult.angleDeg < 90) nphScore++;
  if (ventVolMl > 50) nphScore++;
  const nphPct = Math.round((nphScore / 3) * 100);

  return {
    evansIndex:     evansResult.maxEvans,
    evansSlice:     evansResult.bestSlice,
    evansData:      evansResult,
    callosalAngle:  callosalResult.angleDeg,
    callosalSlice:  callosalResult.bestCoronalSlice,
    callosalData:   callosalResult,
    ventVolMl,
    ventVolMm3,
    nphScore,
    nphPct,
    brainBbox:      { bxMin, bxMax, byMin, byMax, bzMin, bzMax },
    ventCount,
    brainVoxCount,
    shape,
    spacing,
    // Pass through the mask for rendering
    ventMask,
  };
}

// ─── Sample Data Loader ───────────────────────────────────────────────────────

/**
 * Loads and decodes the bundled sample CT scan from assets/sample-data.json.
 * Returns a volume object compatible with runPipeline().
 *
 * Encoding: base64 → gzip decompress → Int16Array → Float32Array
 */
export async function loadSampleVolume(onProgress = () => {}) {
  onProgress(0, 'Loading sample CT scan asset...');
  await delay(30);

  // Dynamic require for the JSON asset (works with Metro bundler)
  const sample = require('../../assets/sample-data.json');

  onProgress(0, 'Decompressing sample volume...');
  await delay(30);

  const b64 = sample.data_b64_gzip_int16;

  // Decode base64 → Uint8Array
  // In React Native, atob is available globally via the Hermes/JSC runtime
  const binaryStr = atob(b64);
  const compressed = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    compressed[i] = binaryStr.charCodeAt(i);
  }

  // Gzip decompress
  const raw = pako.inflate(compressed);
  const int16 = new Int16Array(raw.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) float32[i] = int16[i];

  const volume = {
    shape:   sample.shape,
    spacing: sample.spacing,
    affine: [
      [sample.spacing[0], 0, 0, 0],
      [0, sample.spacing[1], 0, 0],
      [0, 0, sample.spacing[2], 0],
      [0, 0, 0, 1],
    ],
    data: float32,
    header: {
      ndim:       3,
      datatype:   16,
      bitpix:     32,
      voxOffset:  352,
      sformCode:  0,
      dims:       sample.shape,
      pixdim:     sample.spacing,
    },
    fileName: 'sample_ct_155.nii.gz',
    fileSize: compressed.length,
  };

  return volume;
}

// ─── NIfTI File Loader ────────────────────────────────────────────────────────

/**
 * Read a NIfTI file from a local URI (from expo-document-picker).
 * Reads the file as base64 and converts to ArrayBuffer, then parses.
 */
export async function loadNiftiFromUri(uri, fileName, fileSize, onProgress = () => {}) {
  onProgress(0, 'Reading file...');
  await delay(20);

  // Read using expo-file-system
  const FileSystem = require('expo-file-system');
  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  onProgress(0, 'Decompressing & parsing NIfTI...');
  await delay(30);

  // Convert base64 to ArrayBuffer
  const binaryStr = atob(b64);
  const buffer = new ArrayBuffer(binaryStr.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const volume = await parseNifti(buffer);
  volume.fileName = fileName;
  volume.fileSize = fileSize;
  return volume;
}

// ─── Sanity Checks ────────────────────────────────────────────────────────────

/**
 * Run sanity checks on the results and return an array of warning strings.
 * An empty array means all checks passed.
 */
export function runSanityChecks(results) {
  const warnings = [];
  const { evansIndex, callosalAngle, ventVolMl, spacing } = results;

  if (evansIndex > 0.7)
    warnings.push(`Evans Index ${evansIndex.toFixed(3)} is very high (>0.7). Please verify segmentation.`);
  if (evansIndex < 0.1)
    warnings.push(`Evans Index ${evansIndex.toFixed(3)} is very low. Verify ventricles were detected.`);
  if (callosalAngle !== null && callosalAngle > 160)
    warnings.push(`Callosal angle ${callosalAngle}° seems very wide. Verify coronal segmentation.`);
  if (ventVolMl < 5)
    warnings.push(`Ventricle volume ${ventVolMl.toFixed(1)} mL seems very low. Check segmentation.`);
  if (ventVolMl > 200)
    warnings.push(`Ventricle volume ${ventVolMl.toFixed(1)} mL seems very high. Verify segmentation.`);
  if (spacing[0] > 5 || spacing[1] > 5 || spacing[2] > 5)
    warnings.push(
      `Large voxel spacing detected (${spacing.map((s) => s.toFixed(1)).join('×')} mm). ` +
      'Results may be less accurate.'
    );

  return warnings;
}
