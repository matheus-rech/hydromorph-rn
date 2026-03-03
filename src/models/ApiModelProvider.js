/**
 * ApiModelProvider — Real API inference with automatic mock fallback
 *
 * Calls remote segmentation endpoints (e.g. HuggingFace Inference API)
 * to obtain ventricle masks, then recomputes morphometric indices locally.
 * Falls back to MockModelProvider when the API is unavailable or when
 * cloud mode is disabled.
 *
 * Privacy note: only the classical binary mask is transmitted — raw
 * patient scan voxel data never leaves the device.
 *
 * Author: Matheus Machado Rech
 */

import { getModelConfig } from './ModelRegistry';
import { generateMockResult } from './MockModelProvider';
import { getApiConfig, isCloudEnabled } from '../config/apiConfig';
import {
  computeEvansIndex,
  computeCallosalAngle,
} from '../pipeline/Morphometrics';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Convert Uint8Array to base64 string.
 * Works in React Native (Hermes runtime has btoa).
 */
function uint8ToBase64(uint8) {
  let binary = '';
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to Uint8Array.
 */
function base64ToUint8(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Fetch with timeout using AbortController.
 */
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Wait for the given number of milliseconds.
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Generate a segmentation result by calling the model's remote endpoint.
 *
 * Decision tree:
 *   1. Cloud disabled or no endpoint configured → fallback to mock (or throw)
 *   2. Cloud enabled + endpoint set → POST to API with retry, then
 *      recompute all metrics from the returned mask
 *   3. On API failure → fallback to mock if config allows, else throw
 *
 * @param {string}     modelId        Model identifier (e.g. 'medsam2')
 * @param {Int16Array} volumeData     Raw HU volume (needed for Evans skull detection)
 * @param {Uint8Array} classicalMask  Binary mask from the classical pipeline
 * @param {number[]}   shape          [X, Y, Z] voxel dimensions
 * @param {number[]}   spacing        [dx, dy, dz] voxel spacing in mm
 * @returns {Promise<Object>} Result matching MockModelProvider output shape
 */
export async function generateApiResult(modelId, volumeData, classicalMask, shape, spacing) {
  const config = getModelConfig(modelId);
  if (!config) throw new Error(`Unknown model: ${modelId}`);

  const apiConfig = getApiConfig();

  // ── Gate: cloud disabled or no endpoint ──────────────────────────────────
  if (!isCloudEnabled() || !config.endpoint) {
    if (config.fallbackToMock) {
      return generateMockResult(modelId, volumeData, classicalMask, shape, spacing);
    }
    throw new Error(`No endpoint configured for ${modelId}`);
  }

  // ── Cloud path: call remote API ──────────────────────────────────────────
  const startTime = performance.now();

  const payload = {
    model_id: modelId,
    shape: shape,
    spacing: spacing,
    mask_b64: uint8ToBase64(classicalMask),
    volume_shape: shape,
  };

  const fetchOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };

  let response;
  try {
    response = await attemptFetch(config.endpoint, fetchOptions, apiConfig.timeout);
  } catch (err) {
    // Both attempts failed
    if (config.fallbackToMock) {
      return generateMockResult(modelId, volumeData, classicalMask, shape, spacing);
    }
    throw new Error(`API request failed for ${modelId}: ${err.message}`);
  }

  // ── Parse response and build result ──────────────────────────────────────
  let body;
  try {
    body = await response.json();
  } catch (err) {
    if (config.fallbackToMock) {
      return generateMockResult(modelId, volumeData, classicalMask, shape, spacing);
    }
    throw new Error(`Invalid JSON response from ${modelId} endpoint`);
  }

  if (!body.mask_b64) {
    if (config.fallbackToMock) {
      return generateMockResult(modelId, volumeData, classicalMask, shape, spacing);
    }
    throw new Error(`Missing mask_b64 in response from ${modelId} endpoint`);
  }

  const mask = base64ToUint8(body.mask_b64);

  // Count voxels
  let ventCount = 0;
  for (let i = 0; i < mask.length; i++) ventCount += mask[i];

  // Recompute metrics using existing pipeline functions
  const evansResult = computeEvansIndex(volumeData, mask, shape, spacing);
  const callosalResult = computeCallosalAngle(mask, shape, spacing);

  // Volume
  const voxelVol = spacing[0] * spacing[1] * spacing[2];
  const ventVolMm3 = ventCount * voxelVol;
  const ventVolMl = ventVolMm3 / 1000;

  // NPH score (same logic as MockModelProvider)
  let nphScore = 0;
  if (evansResult.maxEvans > 0.3) nphScore++;
  if (callosalResult.angleDeg !== null && callosalResult.angleDeg < 90) nphScore++;
  if (ventVolMl > 50) nphScore++;
  const nphPct = Math.round((nphScore / 3) * 100);

  // Bounding boxes from API response (default to empty array)
  const boundingBoxes = body.bounding_boxes || [];

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

// ─── Retry Logic ─────────────────────────────────────────────────────────────

/**
 * Attempt a fetch with one retry. On first failure, wait 1 second and
 * try once more. Throws on second failure.
 */
async function attemptFetch(url, options, timeoutMs) {
  try {
    const response = await fetchWithTimeout(url, options, timeoutMs);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response;
  } catch (firstError) {
    // Wait 1 second before retry
    await delay(1000);
    const response = await fetchWithTimeout(url, options, timeoutMs);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response;
  }
}
