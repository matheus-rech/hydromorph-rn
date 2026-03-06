/**
 * MockModelProvider — Realistic mock segmentation outputs
 *
 * Generates perturbed masks from the classical pipeline result
 * to simulate different ML model behaviors:
 *   - SAM3:        Opening (erode+dilate) → conservative, smoother (-5-10% volume)
 *   - BiomedParse: Dilate by 1 → foundation model over-segmentation (+5-15% volume)
 *   - SegVol:      Component filtering + opening → native 3D noise removal (-2-5% volume)
 *   - VISTA-3D:    Dilate + opening → smoothed, slightly expanded (±5% volume)
 *   - RepMedSAM:   Opening (erode+dilate) → lightweight edge model, conservative (-5-10% volume)
 *
 * When real API backends are available, swap this provider with
 * ApiModelProvider implementing the same interface.
 *
 * Author: Matheus Machado Rech
 */

import {
  voxelIndex,
  dilate3D,
  opening3D,
  connectedComponents3D,
  computeEvansIndex,
  computeCallosalAngle,
} from '../pipeline/Morphometrics';
import { getModelConfig } from './ModelRegistry';
import { computeNphScore } from '../clinical/scoring';

// Simulated processing times (ms)
const SIMULATED_TIMES = {
  sam3: 3500,
  biomedparse: 4000,
  segvol: 3000,
  vista3d: 2500,
  repmedsam: 500,
};

/**
 * Generate a mock result for a given model ID.
 * Returns a ModelResult object with the same shape as classical results
 * plus bounding boxes and processing time.
 */
export async function generateMockResult(modelId, volumeData, classicalMask, shape, spacing) {
  const config = getModelConfig(modelId);
  if (!config) throw new Error(`Unknown model: ${modelId}`);

  const startTime = performance.now();

  // Simulate processing delay
  const simTime = SIMULATED_TIMES[modelId] || 1500;
  await delay(simTime);

  // Generate perturbed mask
  let mask;
  switch (modelId) {
    case 'sam3':
      mask = perturbSAM3(classicalMask, shape);
      break;
    case 'biomedparse':
      mask = perturbBiomedParse(classicalMask, shape);
      break;
    case 'segvol':
      mask = perturbSegVol(classicalMask, shape);
      break;
    case 'vista3d':
      mask = perturbVISTA3D(classicalMask, shape);
      break;
    case 'repmedsam':
      mask = perturbRepMedSAM(classicalMask, shape);
      break;
    default:
      mask = new Uint8Array(classicalMask);
  }

  // Count voxels
  let ventCount = 0;
  for (let i = 0; i < mask.length; i++) ventCount += mask[i];

  // Recompute metrics using existing functions
  const evansResult = computeEvansIndex(volumeData, mask, shape, spacing);
  const callosalResult = computeCallosalAngle(mask, shape, spacing);

  // Volume
  const voxelVol = spacing[0] * spacing[1] * spacing[2];
  const ventVolMm3 = ventCount * voxelVol;
  const ventVolMl = ventVolMm3 / 1000;

  // NPH score
  const { nphScore, nphPct } = computeNphScore(
    evansResult.maxEvans,
    callosalResult.angleDeg,
    ventVolMl,
  );

  // Bounding boxes from connected components
  const boundingBoxes = computeBoundingBoxes(mask, shape, spacing);

  const processingTime = ((performance.now() - startTime) / 1000).toFixed(1);

  return {
    modelId,
    modelName: config.name,
    modelColor: config.color,
    colorRgb: config.colorRgb,
    evansIndex: evansResult.maxEvans,
    evansSlice: evansResult.bestSlice,
    evansData: evansResult,
    callosalAngle: callosalResult.angleDeg,
    callosalSlice: callosalResult.bestCoronalSlice,
    callosalData: callosalResult,
    ventVolMl,
    ventVolMm3,
    nphScore,
    nphPct,
    ventCount,
    ventMask: mask,
    shape,
    spacing,
    boundingBoxes,
    processingTime: `${processingTime}s`,
    processingTimeNum: parseFloat(processingTime),
  };
}

// ─── Perturbation Strategies ──────────────────────────────────────────────────

/**
 * SAM3: Morphological opening (erode then dilate) → conservative.
 * Smooths boundaries and removes small protrusions, reducing volume by ~5-10%.
 */
function perturbSAM3(classicalMask, shape) {
  return opening3D(classicalMask, shape, 1);
}

/**
 * BiomedParse: Dilate classical mask by 1 iteration → over-segmentation.
 * Foundation models tend to over-segment slightly, adding ~5-15% volume.
 */
function perturbBiomedParse(classicalMask, shape) {
  return dilate3D(classicalMask, shape, 1);
}

/**
 * SegVol: Component filtering + opening → native 3D noise removal.
 * Keeps only components > 100 voxels, then applies opening.
 * Simulates native 3D volumetric processing, reducing volume by ~2-5%.
 */
function perturbSegVol(classicalMask, shape) {
  const total = classicalMask.length;
  const { labels, counts } = connectedComponents3D(classicalMask, shape);

  // Build a keep-set of labels with > 100 voxels (O(k) where k = component count)
  const keepLabels = new Set();
  for (const [label, count] of counts) {
    if (count > 100) keepLabels.add(label);
  }

  // Single O(n) pass to apply the filter
  const filtered = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    if (keepLabels.has(labels[i])) filtered[i] = 1;
  }

  // Smooth with opening
  return opening3D(filtered, shape, 1);
}

/**
 * VISTA-3D: Dilate then opening → smoothed, slightly expanded mask.
 * The combination simulates auto+interactive refinement, ±5% volume.
 */
function perturbVISTA3D(classicalMask, shape) {
  const dilated = dilate3D(classicalMask, shape, 1);
  return opening3D(dilated, shape, 1);
}

/**
 * RepMedSAM: Opening (erode then dilate) → lightweight edge model, conservative.
 * Same strategy as SAM3; edge models tend to be conservative, -5-10% volume.
 */
function perturbRepMedSAM(classicalMask, shape) {
  return opening3D(classicalMask, shape, 1);
}

// ─── Bounding Boxes ─────────────────────────────────────────────────────────

/**
 * Compute axis-aligned bounding boxes from connected components.
 * Returns array of { minX, maxX, minY, maxY, minZ, maxZ, volumeMl, confidence }.
 */
function computeBoundingBoxes(mask, shape, spacing) {
  const [X, Y, Z] = shape;
  const { labels, counts } = connectedComponents3D(mask, shape);
  const voxelVol = spacing[0] * spacing[1] * spacing[2];
  const boxes = [];

  for (const [label, count] of counts) {
    if (count < 50) continue;

    let minX = X, maxX = 0, minY = Y, maxY = 0, minZ = Z, maxZ = 0;
    for (let z = 0; z < Z; z++) {
      for (let y = 0; y < Y; y++) {
        for (let x = 0; x < X; x++) {
          if (labels[voxelIndex(shape, x, y, z)] === label) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
            if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
          }
        }
      }
    }

    boxes.push({
      minX, maxX, minY, maxY, minZ, maxZ,
      volumeMl: (count * voxelVol) / 1000,
      confidence: 0.75 + Math.random() * 0.2, // mock confidence 0.75-0.95
    });
  }

  return boxes;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
