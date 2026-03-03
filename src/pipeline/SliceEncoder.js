/**
 * SliceEncoder — Convert volume slices to PNG for API upload
 *
 * Generates PNG images from CT volume data suitable for uploading
 * to remote segmentation APIs (e.g. Gradio-based HuggingFace Spaces).
 *
 * Author: Matheus Machado Rech
 */

import { generateAxialPixels } from './Morphometrics';
import { encodePNG } from '../utils/PngEncoder';

/**
 * Encode an axial slice of the volume as a PNG base64 string.
 * Returns raw base64 (no data URI prefix) suitable for API upload.
 *
 * @param {Float32Array} volumeData - Flat CT volume data
 * @param {number[]}     shape      - [X, Y, Z]
 * @param {number[]}     spacing    - [sx, sy, sz] mm
 * @param {number}       sliceIndex - Axial slice z-index
 * @returns {{ base64: string, width: number, height: number }}
 */
export function encodeAxialSlicePNG(volumeData, shape, spacing, sliceIndex) {
  const [X, Y] = shape;
  // Generate grayscale RGBA pixels (no mask overlay, no color)
  const pixels = generateAxialPixels(volumeData, null, shape, sliceIndex, false);
  const base64 = encodePNG(X, Y, pixels);
  return { base64, width: X, height: Y };
}

/**
 * Find the axial slice with the most ventricle voxels.
 * Useful for selecting a representative slice for API segmentation.
 *
 * @param {Uint8Array} mask  - Binary ventricle mask
 * @param {number[]}   shape - [X, Y, Z]
 * @returns {number} Best slice index
 */
export function findBestVentricleSlice(mask, shape) {
  const [X, Y, Z] = shape;
  let bestSlice = Math.floor(Z / 2);
  let maxCount = 0;

  for (let z = 0; z < Z; z++) {
    let count = 0;
    for (let y = 0; y < Y; y++) {
      for (let x = 0; x < X; x++) {
        // voxelIndex = x + y * X + z * X * Y
        if (mask[x + y * X + z * X * Y]) count++;
      }
    }
    if (count > maxCount) {
      maxCount = count;
      bestSlice = z;
    }
  }

  return bestSlice;
}
