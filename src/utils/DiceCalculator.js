/**
 * DiceCalculator — Voxel-wise overlap metrics for comparing segmentation masks.
 * Computes Dice coefficient, IoU, and volume delta between classical and
 * model-predicted masks. Optimized for large Uint8Array masks (up to 16M voxels).
 *
 * Author: Matheus Machado Rech
 */

'use strict';

/**
 * Dice coefficient = 2|A∩B| / (|A|+|B|).
 * @param {Uint8Array} maskA - Binary mask (0/1 per voxel)
 * @param {Uint8Array} maskB - Binary mask (0/1 per voxel)
 * @returns {number} Float 0.0 to 1.0
 */
export function computeDice(maskA, maskB) {
  if (!maskA || !maskB) return 0;
  const len = maskA.length;
  if (len !== maskB.length) return 0;

  let intersection = 0;
  let sumA = 0;
  let sumB = 0;

  for (let i = 0; i < len; i++) {
    const a = maskA[i];
    const b = maskB[i];
    intersection += a & b;
    sumA += a;
    sumB += b;
  }

  const denom = sumA + sumB;
  if (denom === 0) return 1.0; // both empty — perfect agreement
  return (2 * intersection) / denom;
}

/**
 * Intersection over Union = |A∩B| / |A∪B|.
 * @param {Uint8Array} maskA - Binary mask (0/1 per voxel)
 * @param {Uint8Array} maskB - Binary mask (0/1 per voxel)
 * @returns {number} Float 0.0 to 1.0
 */
export function computeIoU(maskA, maskB) {
  if (!maskA || !maskB) return 0;
  const len = maskA.length;
  if (len !== maskB.length) return 0;

  let intersection = 0;
  let union = 0;

  for (let i = 0; i < len; i++) {
    const a = maskA[i];
    const b = maskB[i];
    intersection += a & b;
    union += a | b;
  }

  if (union === 0) return 1.0; // both empty — perfect agreement
  return intersection / union;
}

/**
 * Volume percentage difference: ((volumeB - volumeA) / volumeA) * 100.
 * @param {number} volumeA - Reference volume in mL (typically classical)
 * @param {number} volumeB - Comparison volume in mL (typically model)
 * @returns {number} Percentage difference (positive = B is larger)
 */
export function computeVolumeDelta(volumeA, volumeB) {
  if (volumeA === 0) return 0;
  return ((volumeB - volumeA) / volumeA) * 100;
}

/**
 * Compute Dice coefficient and IoU together in a single pass.
 * Avoids scanning the mask arrays twice when both metrics are needed.
 *
 * @param {Uint8Array} maskA - Binary mask (0/1 per voxel)
 * @param {Uint8Array} maskB - Binary mask (0/1 per voxel)
 * @returns {{ dice: number, iou: number }}
 */
export function computeDiceAndIoU(maskA, maskB) {
  if (!maskA || !maskB) return { dice: 0, iou: 0 };
  const len = maskA.length;
  if (len !== maskB.length) return { dice: 0, iou: 0 };

  let intersection = 0;
  let sumA = 0;
  let sumB = 0;

  for (let i = 0; i < len; i++) {
    const a = maskA[i];
    const b = maskB[i];
    intersection += a & b;
    sumA += a;
    sumB += b;
  }

  const denom = sumA + sumB;
  const union = denom - intersection; // |A∪B| = |A| + |B| - |A∩B|

  const dice = denom === 0 ? 1.0 : (2 * intersection) / denom;
  const iou = union === 0 ? 1.0 : intersection / union;

  return { dice, iou };
}

/**
 * Convenience function: compute all overlap metrics at once.
 * @param {Uint8Array} classicalMask - Classical pipeline binary mask
 * @param {Uint8Array} modelMask - Model-predicted binary mask
 * @param {number} classicalVolume - Classical volume in mL
 * @param {number} modelVolume - Model volume in mL
 * @returns {{ dice: number, iou: number, volumeDelta: number }}
 */
export function computeAllMetrics(classicalMask, modelMask, classicalVolume, modelVolume) {
  return {
    dice: computeDice(classicalMask, modelMask),
    iou: computeIoU(classicalMask, modelMask),
    volumeDelta: computeVolumeDelta(classicalVolume, modelVolume),
  };
}
