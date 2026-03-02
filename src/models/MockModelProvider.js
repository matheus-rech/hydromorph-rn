/**
 * MockModelProvider — Realistic mock segmentation outputs
 *
 * Generates perturbed masks from the classical pipeline result
 * to simulate different ML model behaviors:
 *   - MedSAM2: Dilate by 1 → slight over-segmentation (+5-15% volume)
 *   - SAM3:    Opening (erode+dilate) → conservative, smoother (-5-10% volume)
 *   - YOLOvx:  Ellipsoidal approximation → blobby (±10-20% volume)
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

// Simulated processing times (ms)
const SIMULATED_TIMES = {
  medsam2: 2000,
  sam3: 3500,
  yolovx: 700,
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
    case 'medsam2':
      mask = perturbMedSAM2(classicalMask, shape);
      break;
    case 'sam3':
      mask = perturbSAM3(classicalMask, shape);
      break;
    case 'yolovx':
      mask = perturbYOLOvx(classicalMask, shape);
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
  let nphScore = 0;
  if (evansResult.maxEvans > 0.3) nphScore++;
  if (callosalResult.angleDeg !== null && callosalResult.angleDeg < 90) nphScore++;
  if (ventVolMl > 50) nphScore++;
  const nphPct = Math.round((nphScore / 3) * 100);

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
 * MedSAM2: Dilate classical mask by 1 iteration → over-segmentation.
 * Adds ~5-15% more voxels around ventricle boundaries.
 */
function perturbMedSAM2(classicalMask, shape) {
  return dilate3D(classicalMask, shape, 1);
}

/**
 * SAM3: Morphological opening (erode then dilate) → conservative.
 * Smooths boundaries and removes small protrusions, reducing volume by ~5-10%.
 */
function perturbSAM3(classicalMask, shape) {
  return opening3D(classicalMask, shape, 1);
}

/**
 * YOLOvx: Ellipsoidal approximation of each connected component.
 * Replaces each component with its best-fit axis-aligned ellipsoid.
 * Produces blobby, smooth segmentations typical of detection-based methods.
 */
function perturbYOLOvx(classicalMask, shape) {
  const [X, Y, Z] = shape;
  const total = X * Y * Z;
  const result = new Uint8Array(total);

  const { labels, counts } = connectedComponents3D(classicalMask, shape);

  // For each significant component, compute bounding box + centroid,
  // then fill an ellipsoid
  for (const [label, count] of counts) {
    if (count < 50) continue;

    let sumX = 0, sumY = 0, sumZ = 0;
    let minX = X, maxX = 0, minY = Y, maxY = 0, minZ = Z, maxZ = 0;

    for (let z = 0; z < Z; z++) {
      for (let y = 0; y < Y; y++) {
        for (let x = 0; x < X; x++) {
          if (labels[voxelIndex(shape, x, y, z)] === label) {
            sumX += x; sumY += y; sumZ += z;
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
            if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
          }
        }
      }
    }

    const cx = sumX / count;
    const cy = sumY / count;
    const cz = sumZ / count;

    // Semi-axes from bounding box (slightly scaled to match volume)
    const rx = (maxX - minX) / 2 * 0.85;
    const ry = (maxY - minY) / 2 * 0.85;
    const rz = (maxZ - minZ) / 2 * 0.85;

    if (rx < 1 || ry < 1 || rz < 1) continue;

    // Fill ellipsoid
    const ixMin = Math.max(0, Math.floor(cx - rx - 1));
    const ixMax = Math.min(X - 1, Math.ceil(cx + rx + 1));
    const iyMin = Math.max(0, Math.floor(cy - ry - 1));
    const iyMax = Math.min(Y - 1, Math.ceil(cy + ry + 1));
    const izMin = Math.max(0, Math.floor(cz - rz - 1));
    const izMax = Math.min(Z - 1, Math.ceil(cz + rz + 1));

    for (let z = izMin; z <= izMax; z++) {
      for (let y = iyMin; y <= iyMax; y++) {
        for (let x = ixMin; x <= ixMax; x++) {
          const dx = (x - cx) / rx;
          const dy = (y - cy) / ry;
          const dz = (z - cz) / rz;
          if (dx * dx + dy * dy + dz * dz <= 1.0) {
            result[voxelIndex(shape, x, y, z)] = 1;
          }
        }
      }
    }
  }

  return result;
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
