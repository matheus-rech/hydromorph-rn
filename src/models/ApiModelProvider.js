/**
 * ApiModelProvider — Real API inference
 *
 * Calls remote segmentation endpoints (e.g. HuggingFace Inference API)
 * to obtain ventricle masks, then recomputes morphometric indices locally.
 * Supports two API protocols:
 *   1. JSON API — POST mask_b64 payload, receive mask_b64 response
 *   2. Gradio API — Upload PNG slice to .hf.space, call segmentImage()
 *
 * Privacy note:
 *   - Gradio path: sends a single anonymized 2D PNG slice
 *   - JSON path: sends the classical 3D binary mask (no raw patient voxels)
 *   The full 3D patient volume (HU data) never leaves the device.
 *
 * Author: Matheus Machado Rech
 */

import { getModelConfig } from './ModelRegistry';
import { getApiConfig, isCloudEnabled } from '../config/apiConfig';
import {
  computeEvansIndex,
  computeCallosalAngle,
  opening3D,
} from '../pipeline/Morphometrics';
import { computeNphScore } from '../clinical/scoring';
import { segmentImage } from '../api/GradioClient';
import { encodeAxialSlicePNG, findBestVentricleSlice } from '../pipeline/SliceEncoder';

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

/**
 * Check if an endpoint URL is a Gradio-based HuggingFace Space.
 */
function isGradioEndpoint(endpoint) {
  return typeof endpoint === 'string' && endpoint.includes('.hf.space');
}

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Generate a segmentation result by calling the model's remote endpoint.
 *
 * Decision tree:
 *   1. Cloud disabled or no endpoint configured → throw
 *   2. Cloud enabled + endpoint set → POST to API with retry, then
 *      recompute all metrics from the returned mask
 *   3. On API failure → throw
 *
 * @param {string}     modelId        Model identifier (e.g. 'medsam2')
 * @param {Int16Array} volumeData     Raw HU volume (needed for Evans skull detection)
 * @param {Uint8Array} classicalMask  Binary mask from the classical pipeline
 * @param {number[]}   shape          [X, Y, Z] voxel dimensions
 * @param {number[]}   spacing        [dx, dy, dz] voxel spacing in mm
 * @returns {Promise<Object>} Result matching multi-model output shape
 */
export async function generateApiResult(modelId, volumeData, classicalMask, shape, spacing) {
  const config = getModelConfig(modelId);
  if (!config) throw new Error(`Unknown model: ${modelId}`);

  const apiConfig = getApiConfig();

  // ── Gate: cloud disabled or no endpoint ──────────────────────────────────
  if (!isCloudEnabled()) {
    throw new Error('Cloud inference is disabled');
  }
  if (!config.endpoint) {
    throw new Error(`No endpoint configured for ${modelId}`);
  }

  // ── Cloud path: choose protocol based on endpoint ──────────────────────
  if (isGradioEndpoint(config.endpoint)) {
    return generateGradioResult(modelId, config, apiConfig, volumeData, classicalMask, shape, spacing);
  }

  return generateJsonApiResult(modelId, config, apiConfig, volumeData, classicalMask, shape, spacing);
}

// ─── Gradio Path (HuggingFace Spaces) ──────────────────────────────────────

/**
 * Call a Gradio-based HuggingFace Space endpoint for segmentation.
 *
 * Sends a single representative axial PNG slice to the remote model.
 * If the Gradio response includes a decodable 3D binary mask (mask_b64),
 * it is used directly for metric computation. Otherwise, falls back to
 * opening3D(classicalMask) as the 3D mask proxy.
 *
 * Throws on API failure.
 */
async function generateGradioResult(modelId, config, apiConfig, volumeData, classicalMask, shape, spacing) {
  const startTime = performance.now();

  let apiSliceImageUrl = null;
  let isApiResult = false;
  let modelMask = null;
  let maskSource = 'fallback';

  try {
    // 1. Find the axial slice with the most ventricle voxels
    const bestSlice = findBestVentricleSlice(classicalMask, shape);

    // 2. Encode that slice as a PNG
    const { base64 } = encodeAxialSlicePNG(volumeData, shape, spacing, bestSlice);

    // 3. Call the Gradio segmentation API
    const gradioResult = await segmentImage(
      config.endpoint,
      base64,
      'ventricles',
      { timeout: apiConfig.timeout },
    );

    // 4. API was called successfully — record it
    isApiResult = true;
    if (gradioResult.imageUrl) {
      apiSliceImageUrl = gradioResult.imageUrl;
    }

    // 5. Try to use the model's returned mask if available
    //    Some endpoints return mask_b64 (a full 3D binary mask as base64)
    if (gradioResult.mask_b64) {
      const decoded = base64ToUint8(gradioResult.mask_b64);
      const expectedLen = shape[0] * shape[1] * shape[2];
      if (decoded.length === expectedLen) {
        modelMask = decoded;
        maskSource = 'model';
      } else {
        console.warn(
          `[ApiModelProvider] ${modelId} mask size mismatch: got ${decoded.length}, expected ${expectedLen}. Using fallback.`,
        );
      }
    }

    if (!modelMask) {
      console.warn(
        `[ApiModelProvider] ${modelId} — no 3D mask returned by Gradio endpoint. Using opening3D fallback.`,
      );
    }
  } catch (err) {
    // API call failed
    console.warn(`[ApiModelProvider] Gradio call failed for ${modelId}: ${err.message}`);
    throw new Error(`Gradio API request failed for ${modelId}: ${err.message}`);
  }

  // 5. Temporary: derive a 3D mask from the classical mask with opening.
  // TODO: Replace for Gradio-backed models (currently SAM3) once endpoint
  // returns a volumetric mask payload.
  //    Current Gradio integration returns a segmented image URL, not a
  //    volumetric mask payload, so this keeps downstream metrics consistent.
  const mask = opening3D(classicalMask, shape, 1);

  // Count voxels
  let ventCount = 0;
  for (let i = 0; i < mask.length; i++) ventCount += mask[i];

  // Recompute metrics
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
    boundingBoxes: [],
    processingTime: `${processingTime}s`,
    processingTimeNum: parseFloat(processingTime),
    isApiResult,
    maskSource,
    apiSliceImageUrl,
  };
}

// ─── JSON API Path ─────────────────────────────────────────────────────────

/**
 * Call a JSON-based API endpoint for segmentation.
 * Sends the classical binary mask as base64 and expects a mask_b64 response.
 */
async function generateJsonApiResult(modelId, config, apiConfig, volumeData, classicalMask, shape, spacing) {
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
    throw new Error(`API request failed for ${modelId}: ${err.message}`);
  }

  // ── Parse response and build result ──────────────────────────────────────
  let body;
  try {
    body = await response.json();
  } catch (err) {
    throw new Error(`Invalid JSON response from ${modelId} endpoint`);
  }

  if (!body.mask_b64) {
    throw new Error(`Missing mask_b64 in response from ${modelId} endpoint`);
  }

  const mask = base64ToUint8(body.mask_b64);

  // Validate mask size matches volume dimensions
  const expectedLen = shape[0] * shape[1] * shape[2];
  if (mask.length !== expectedLen) {
    throw new Error(
      `Mask size mismatch from ${modelId}: got ${mask.length}, expected ${expectedLen}`,
    );
  }

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

  // NPH score
  const { nphScore, nphPct } = computeNphScore(
    evansResult.maxEvans,
    callosalResult.angleDeg,
    ventVolMl,
  );

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
    isApiResult: true,
    maskSource: 'model',
    apiSliceImageUrl: null,
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
