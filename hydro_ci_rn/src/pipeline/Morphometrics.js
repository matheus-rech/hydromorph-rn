/**
 * HydroMorph — Morphometrics Pipeline Functions
 * React Native port of app.js pipeline logic
 *
 * Functions ported exactly from the reference JS implementation:
 *   getVoxel, setVoxel, voxelIndex
 *   erode3D, dilate3D, opening3D, closing3D
 *   connectedComponents3D, keepLargestComponent, keepLargeComponents
 *   computeEvansIndex, computeCallosalAngle
 *
 * Author: Matheus Machado Rech
 */

'use strict';

// ─── Volume Index Helpers ─────────────────────────────────────────────────────

export function voxelIndex(shape, x, y, z) {
  return x + y * shape[0] + z * shape[0] * shape[1];
}

export function getVoxel(data, shape, x, y, z) {
  if (x < 0 || y < 0 || z < 0 || x >= shape[0] || y >= shape[1] || z >= shape[2]) return 0;
  return data[x + y * shape[0] + z * shape[0] * shape[1]];
}

export function setVoxel(data, shape, x, y, z, val) {
  if (x < 0 || y < 0 || z < 0 || x >= shape[0] || y >= shape[1] || z >= shape[2]) return;
  data[x + y * shape[0] + z * shape[0] * shape[1]] = val;
}

// ─── Morphological Operations ─────────────────────────────────────────────────

const NEIGHBORS_6 = [
  [-1, 0, 0], [1, 0, 0],
  [0, -1, 0], [0, 1, 0],
  [0, 0, -1], [0, 0, 1],
];

/**
 * 3D erosion with 6-connectivity.
 * A voxel stays 1 only if all 6 neighbors are also 1.
 */
export function erode3D(mask, shape, iterations = 1) {
  const [X, Y, Z] = shape;
  const total = X * Y * Z;
  let src = new Uint8Array(mask);
  let dst = new Uint8Array(total);

  for (let iter = 0; iter < iterations; iter++) {
    dst.fill(0);
    for (let z = 1; z < Z - 1; z++) {
      for (let y = 1; y < Y - 1; y++) {
        for (let x = 1; x < X - 1; x++) {
          if (src[voxelIndex(shape, x, y, z)] === 0) continue;
          let keep = true;
          for (const [dx, dy, dz] of NEIGHBORS_6) {
            if (src[voxelIndex(shape, x + dx, y + dy, z + dz)] === 0) {
              keep = false;
              break;
            }
          }
          if (keep) dst[voxelIndex(shape, x, y, z)] = 1;
        }
      }
    }
    src = dst;
    dst = new Uint8Array(total);
  }
  return src;
}

/**
 * 3D dilation with 6-connectivity.
 * Any voxel adjacent to a 1 voxel becomes 1.
 */
export function dilate3D(mask, shape, iterations = 1) {
  const [X, Y, Z] = shape;
  const total = X * Y * Z;
  let src = new Uint8Array(mask);
  let dst = new Uint8Array(total);

  for (let iter = 0; iter < iterations; iter++) {
    dst.set(src);
    for (let z = 1; z < Z - 1; z++) {
      for (let y = 1; y < Y - 1; y++) {
        for (let x = 1; x < X - 1; x++) {
          if (src[voxelIndex(shape, x, y, z)] === 0) continue;
          for (const [dx, dy, dz] of NEIGHBORS_6) {
            dst[voxelIndex(shape, x + dx, y + dy, z + dz)] = 1;
          }
        }
      }
    }
    src = dst;
    dst = new Uint8Array(total);
  }
  return src;
}

/** Opening = erode then dilate (removes noise) */
export function opening3D(mask, shape, iterations = 1) {
  return dilate3D(erode3D(mask, shape, iterations), shape, iterations);
}

/** Closing = dilate then erode (fills small gaps) */
export function closing3D(mask, shape, iterations = 1) {
  return erode3D(dilate3D(mask, shape, iterations), shape, iterations);
}

// ─── Connected Components (BFS) ───────────────────────────────────────────────

/**
 * 3D connected components with 6-connectivity via BFS.
 * Returns { labels: Int32Array, counts: Map<label, count>, numLabels }
 */
export function connectedComponents3D(mask, shape) {
  const [X, Y, Z] = shape;
  const total = X * Y * Z;
  const labels = new Int32Array(total);
  const counts = new Map();
  let nextLabel = 1;

  // Pre-allocated BFS queue (flat triplet encoding: x,y,z interleaved)
  const queueSize = Math.min(total * 3, 6 * 1024 * 1024); // max ~2M voxels
  const queue = new Int32Array(queueSize);

  for (let z = 0; z < Z; z++) {
    for (let y = 0; y < Y; y++) {
      for (let x = 0; x < X; x++) {
        const idx = voxelIndex(shape, x, y, z);
        if (mask[idx] === 0 || labels[idx] !== 0) continue;

        const label = nextLabel++;
        labels[idx] = label;
        let count = 1;

        let head = 0, tail = 0;
        queue[tail++] = x;
        queue[tail++] = y;
        queue[tail++] = z;

        while (head < tail) {
          const cx = queue[head++];
          const cy = queue[head++];
          const cz = queue[head++];

          for (const [dx, dy, dz] of NEIGHBORS_6) {
            const nx = cx + dx, ny = cy + dy, nz = cz + dz;
            if (nx < 0 || ny < 0 || nz < 0 || nx >= X || ny >= Y || nz >= Z) continue;
            const nidx = voxelIndex(shape, nx, ny, nz);
            if (mask[nidx] === 0 || labels[nidx] !== 0) continue;
            labels[nidx] = label;
            count++;
            if (tail + 3 < queue.length) {
              queue[tail++] = nx;
              queue[tail++] = ny;
              queue[tail++] = nz;
            }
          }
        }
        counts.set(label, count);
      }
    }
  }

  return { labels, counts, numLabels: nextLabel - 1 };
}

/**
 * Keep only the single largest connected component in a binary mask.
 */
export function keepLargestComponent(mask, shape, minSize = 1) {
  const { labels, counts } = connectedComponents3D(mask, shape);
  const total = mask.length;
  const result = new Uint8Array(total);

  let maxLabel = -1, maxCount = 0;
  for (const [label, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      maxLabel = label;
    }
  }

  if (maxLabel === -1 || maxCount < minSize) return result;
  for (let i = 0; i < total; i++) {
    if (labels[i] === maxLabel) result[i] = 1;
  }
  return result;
}

/**
 * Keep all components larger than minSize voxels.
 */
export function keepLargeComponents(mask, shape, minSize = 500) {
  const { labels, counts } = connectedComponents3D(mask, shape);
  const total = mask.length;
  const result = new Uint8Array(total);

  const keepLabels = new Set();
  for (const [label, count] of counts) {
    if (count >= minSize) keepLabels.add(label);
  }

  for (let i = 0; i < total; i++) {
    if (keepLabels.has(labels[i])) result[i] = 1;
  }
  return result;
}

// ─── Evans Index ──────────────────────────────────────────────────────────────

/**
 * Compute Evans Index per axial slice.
 * Returns { maxEvans, bestSlice, perSlice[] }
 *
 * For each axial slice (z):
 *   - Measure ventricle width (leftmost → rightmost ventricle voxel) in mm
 *   - Measure skull width via bone HU > 300 (fallback to soft tissue)
 *   - evans = ventricleWidthMm / skullWidthMm
 */
export function computeEvansIndex(data, ventMask, shape, spacing) {
  const [X, Y, Z] = shape;
  let maxEvans = 0;
  let bestSlice = -1;
  const perSlice = [];

  for (let z = 0; z < Z; z++) {
    let ventLeft = X, ventRight = 0, ventCount = 0;
    for (let y = 0; y < Y; y++) {
      for (let x = 0; x < X; x++) {
        if (ventMask[voxelIndex(shape, x, y, z)] === 1) {
          ventCount++;
          if (x < ventLeft) ventLeft = x;
          if (x > ventRight) ventRight = x;
        }
      }
    }

    if (ventCount < 20) continue;

    const ventWidthMm = (ventRight - ventLeft) * spacing[0];

    // Skull width: prefer bone HU > 300, fallback to soft tissue extent
    let skullLeft = X, skullRight = 0;
    let boneCount = 0;

    for (let y = 0; y < Y; y++) {
      for (let x = 0; x < X; x++) {
        const hu = getVoxel(data, shape, x, y, z);
        if (hu > 300) {
          boneCount++;
          if (x < skullLeft) skullLeft = x;
          if (x > skullRight) skullRight = x;
        }
      }
    }

    // Fallback to soft tissue if too few bone voxels
    if (boneCount < 10 || (skullRight - skullLeft) < 50) {
      skullLeft = X;
      skullRight = 0;
      for (let y = 0; y < Y; y++) {
        for (let x = 0; x < X; x++) {
          const hu = getVoxel(data, shape, x, y, z);
          if (hu > -20 && hu < 1000) {
            if (x < skullLeft) skullLeft = x;
            if (x > skullRight) skullRight = x;
          }
        }
      }
    }

    if (skullRight <= skullLeft) continue;
    const skullWidthMm = (skullRight - skullLeft) * spacing[0];

    if (skullWidthMm < 50) continue; // sanity check

    const evans = ventWidthMm / skullWidthMm;

    perSlice.push({
      z,
      evans,
      ventWidthMm,
      skullWidthMm,
      ventLeft,
      ventRight,
      skullLeft,
      skullRight,
    });

    if (evans > maxEvans) {
      maxEvans = evans;
      bestSlice = z;
    }
  }

  return { maxEvans, bestSlice, perSlice };
}

// ─── Callosal Angle ───────────────────────────────────────────────────────────

/**
 * Compute the callosal angle from the coronal ventricle cross-section.
 *
 * Algorithm:
 *   1. Find coronal slice (y-axis) with largest ventricle cross-section
 *   2. On that slice (x vs z plane), find:
 *      - Vertex: centroid of topmost voxels (top 3 z-levels)
 *      - Left point: bottom-most voxel on left half (x < midX)
 *      - Right point: bottom-most voxel on right half (x >= midX)
 *   3. Compute vectors from vertex to left/right points (mm-corrected)
 *   4. Return angle between vectors (dot product / magnitudes)
 */
export function computeCallosalAngle(ventMask, shape, spacing) {
  const [X, Y, Z] = shape;

  // Find coronal slice with largest ventricle cross-section
  let maxCount = 0, bestY = -1;
  for (let y = 0; y < Y; y++) {
    let count = 0;
    for (let z = 0; z < Z; z++) {
      for (let x = 0; x < X; x++) {
        if (ventMask[voxelIndex(shape, x, y, z)] === 1) count++;
      }
    }
    if (count > maxCount) {
      maxCount = count;
      bestY = y;
    }
  }

  if (bestY === -1 || maxCount < 20) {
    return { angleDeg: null, bestCoronalSlice: -1, vertex: null, leftPt: null, rightPt: null };
  }

  const midX = Math.floor(X / 2);

  // Find topmost z on the coronal slice
  let topZ = 0;
  for (let z = 0; z < Z; z++) {
    for (let x = 0; x < X; x++) {
      if (ventMask[voxelIndex(shape, x, bestY, z)] === 1) {
        if (z > topZ) topZ = z;
      }
    }
  }

  // Vertex = centroid of voxels in top 3 z-levels
  let vertexSumX = 0, vertexSumZ = 0, vertexN = 0;
  const topZThresh = topZ - 3;
  for (let z = topZThresh; z <= topZ; z++) {
    for (let x = 0; x < X; x++) {
      if (ventMask[voxelIndex(shape, x, bestY, z)] === 1) {
        vertexSumX += x;
        vertexSumZ += z;
        vertexN++;
      }
    }
  }

  if (vertexN === 0) {
    return { angleDeg: null, bestCoronalSlice: bestY, vertex: null, leftPt: null, rightPt: null };
  }

  const vx = vertexSumX / vertexN;
  const vz = vertexSumZ / vertexN;

  // Bottom-most extremes on each half (lowest z = most inferior)
  let bLeftX = -1, bLeftZ = Z;
  let bRightX = -1, bRightZ = Z;

  for (let z = 0; z < Z; z++) {
    for (let x = 0; x < X; x++) {
      if (ventMask[voxelIndex(shape, x, bestY, z)] === 1) {
        if (x < midX && z < bLeftZ) {
          bLeftZ = z;
          bLeftX = x;
        }
        if (x >= midX && z < bRightZ) {
          bRightZ = z;
          bRightX = x;
        }
      }
    }
  }

  if (bLeftX < 0 || bRightX < 0) {
    return { angleDeg: null, bestCoronalSlice: bestY, vertex: null, leftPt: null, rightPt: null };
  }

  // Vectors from vertex → bottom-left and bottom-right (mm-corrected)
  const lx = (bLeftX - vx) * spacing[0];
  const lz = (bLeftZ - vz) * spacing[2];
  const rx = (bRightX - vx) * spacing[0];
  const rz = (bRightZ - vz) * spacing[2];

  const dotProd = lx * rx + lz * rz;
  const magL = Math.sqrt(lx * lx + lz * lz);
  const magR = Math.sqrt(rx * rx + rz * rz);

  if (magL < 0.001 || magR < 0.001) {
    return { angleDeg: null, bestCoronalSlice: bestY, vertex: null, leftPt: null, rightPt: null };
  }

  const cosAngle = Math.max(-1, Math.min(1, dotProd / (magL * magR)));
  const angleDeg = Math.round(Math.acos(cosAngle) * (180 / Math.PI));

  return {
    angleDeg,
    bestCoronalSlice: bestY,
    vertex: { x: vx, z: vz },
    leftPt: { x: bLeftX, z: bLeftZ },
    rightPt: { x: bRightX, z: bRightZ },
    midX,
  };
}

// ─── Slice Rendering Helpers (pixel data generation) ──────────────────────────

/**
 * Generate RGBA pixel buffer for an axial (z) slice.
 * Applies brain window (W:80 L:40 → HU 0..80) and ventricle overlay.
 * Returns Uint8ClampedArray of size X * Y * 4.
 */
export function generateAxialPixels(data, mask, shape, sliceZ, showMask) {
  const [X, Y] = shape;
  const pixels = new Uint8ClampedArray(X * Y * 4);
  const lo = 0, hi = 80;

  for (let y = 0; y < Y; y++) {
    for (let x = 0; x < X; x++) {
      const hu = getVoxel(data, shape, x, y, sliceZ);
      const gray = Math.floor(
        ((Math.min(Math.max(hu, lo), hi) - lo) / (hi - lo)) * 255
      );
      const pixIdx = (y * X + x) * 4;
      const isMask =
        showMask && mask && mask[voxelIndex(shape, x, y, sliceZ)] === 1;

      if (isMask) {
        pixels[pixIdx]     = Math.floor(gray * 0.4 + 88 * 0.6);
        pixels[pixIdx + 1] = Math.floor(gray * 0.4 + 166 * 0.6);
        pixels[pixIdx + 2] = Math.floor(gray * 0.4 + 255 * 0.6);
      } else {
        pixels[pixIdx]     = gray;
        pixels[pixIdx + 1] = gray;
        pixels[pixIdx + 2] = gray;
      }
      pixels[pixIdx + 3] = 255;
    }
  }
  return pixels;
}

/**
 * Generate RGBA pixel buffer for a coronal (y) slice.
 * Z is flipped so inferior is at the bottom of the image.
 * Returns Uint8ClampedArray of size X * Z * 4.
 */
export function generateCoronalPixels(data, mask, shape, sliceY) {
  const [X, Y, Z] = shape;
  const pixels = new Uint8ClampedArray(X * Z * 4);
  const lo = 0, hi = 80;

  for (let z = 0; z < Z; z++) {
    for (let x = 0; x < X; x++) {
      const hu = getVoxel(data, shape, x, sliceY, z);
      const gray = Math.floor(
        ((Math.min(Math.max(hu, lo), hi) - lo) / (hi - lo)) * 255
      );
      // Flip z: z=0 maps to bottom row, z=Z-1 maps to top row
      const dispZ = Z - 1 - z;
      const pixIdx = (dispZ * X + x) * 4;
      const isMask = mask && mask[voxelIndex(shape, x, sliceY, z)] === 1;

      if (isMask) {
        pixels[pixIdx]     = Math.floor(gray * 0.4 + 88 * 0.6);
        pixels[pixIdx + 1] = Math.floor(gray * 0.4 + 166 * 0.6);
        pixels[pixIdx + 2] = Math.floor(gray * 0.4 + 255 * 0.6);
      } else {
        pixels[pixIdx]     = gray;
        pixels[pixIdx + 1] = gray;
        pixels[pixIdx + 2] = gray;
      }
      pixels[pixIdx + 3] = 255;
    }
  }
  return pixels;
}
