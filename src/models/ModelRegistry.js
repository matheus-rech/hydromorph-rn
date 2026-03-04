/**
 * ModelRegistry — Configuration for all segmentation models
 *
 * Each model entry defines display properties, color assignments,
 * and provider configuration used across the comparison UI.
 * Provider types: 'local' (on-device), 'api' (remote).
 *
 * Updated to connect to unified NeuroSeg server:
 * https://mmrech-medsam2-server.hf.space
 *
 * Author: Matheus Machado Rech
 */

import { colors } from '../theme';

// Unified NeuroSeg Server endpoint
const NEUROSEG_ENDPOINT = 'https://mmrech-medsam2-server.hf.space';

// Legacy endpoints (for reference/migration)
const LEGACY_ENDPOINTS = {
  sam3: 'https://mmrech-neurosam3.hf.space',
};

const MODEL_CONFIGS = [
  {
    id: 'classical',
    name: 'Classical (Proprietary)',
    shortName: 'Classical',
    color: colors.accent,    // #58a6ff — blue
    colorRgb: { r: 88, g: 166, b: 255 },
    description: 'HU thresholding + morphological filtering pipeline',
    isLocal: true,
    provider: 'local',
    endpoint: null,
    fallbackToMock: false,
    modality: 'CT',
    supports2D: true,
    supports3D: true,
  },
  {
    id: 'medsam2',
    name: 'MedSAM2',
    shortName: 'MedSAM2',
    color: colors.green,     // #3fb950 — green
    colorRgb: { r: 63, g: 185, b: 80 },
    description: 'MedSAM2 — video-propagation ventricle segmentation',
    isLocal: false,
    provider: 'api',
    endpoint: NEUROSEG_ENDPOINT,
    endpointPath: '/gradio_api/call/process_with_status',
    fallbackToMock: true,
    modality: 'CT',          // CT preferred, MR supported
    supports2D: true,
    supports3D: true,
    requiresPrompt: true,    // Bounding box prompt required
    defaultPrompt: 'ventricles',
  },
  {
    id: 'mcp_medsam',
    name: 'MCP-MedSAM',
    shortName: 'MCP-MedSAM',
    color: colors.cyan,      // #00d4d4 — cyan
    colorRgb: { r: 0, g: 212, b: 212 },
    description: 'MCP-MedSAM — LLM-guided medical segmentation',
    isLocal: false,
    provider: 'api',
    endpoint: NEUROSEG_ENDPOINT,
    endpointPath: '/gradio_api/call/process_with_status',
    fallbackToMock: true,
    modality: 'CT',
    supports2D: true,
    supports3D: false,       // 2D only
    requiresPrompt: true,
    defaultPrompt: 'ventricles',
    isNew: true,             // Flag for UI highlighting
  },
  {
    id: 'sam_med3d',
    name: 'SAM-Med3D',
    shortName: 'SAM-Med3D',
    color: colors.purple,    // #bc8cff — purple
    colorRgb: { r: 188, g: 140, b: 255 },
    description: 'SAM-Med3D — 3D-aware medical image segmentation',
    isLocal: false,
    provider: 'api',
    endpoint: NEUROSEG_ENDPOINT,
    endpointPath: '/api/segment_3d',  // Uses direct JSON API
    fallbackToMock: true,
    modality: 'CT',
    supports2D: false,       // 3D only
    supports3D: true,
    requiresPrompt: true,
    defaultPrompt: 'ventricles',
    isNew: true,
  },
  {
    id: 'medsam_3d',
    name: 'MedSAM-3D',
    shortName: 'MedSAM-3D',
    color: colors.yellow,    // #d29922 — yellow
    colorRgb: { r: 210, g: 153, b: 34 },
    description: 'MedSAM-3D — full 3D volume segmentation',
    isLocal: false,
    provider: 'api',
    endpoint: NEUROSEG_ENDPOINT,
    endpointPath: '/api/segment_3d',
    fallbackToMock: true,
    modality: 'CT',
    supports2D: false,       // 3D only
    supports3D: true,
    requiresPrompt: true,
    defaultPrompt: 'ventricles',
    isNew: true,
  },
  {
    id: 'segresnet',
    name: 'SegResNet',
    shortName: 'SegResNet',
    color: colors.orange,    // #ff6e40 — orange
    colorRgb: { r: 255, g: 110, b: 64 },
    description: 'SegResNet (MONAI; legacy id: yolovx) — automatic ventricle segmentation',
    isLocal: false,
    provider: 'api',
    endpoint: NEUROSEG_ENDPOINT,
    endpointPath: '/api/segment_2d',
    fallbackToMock: true,
    modality: 'CT',
    supports2D: true,
    supports3D: false,       // 2D only for now
    requiresPrompt: false,   // Automatic segmentation
    isNew: false,
  },
  {
    id: 'tractseg',
    name: 'TractSeg',
    shortName: 'TractSeg',
    color: colors.red,       // #f85149 — red
    colorRgb: { r: 248, g: 81, b: 73 },
    description: 'TractSeg — white matter tract segmentation (MR only)',
    isLocal: false,
    provider: 'api',
    endpoint: NEUROSEG_ENDPOINT,
    endpointPath: '/api/segment_3d',
    fallbackToMock: true,
    modality: 'MR',          // MR only - not for CT
    supports2D: false,
    supports3D: true,
    requiresPrompt: true,
    defaultPrompt: 'tracts',
    isNew: true,
    warning: 'MR only - not suitable for CT scans',  // UI warning
  },
  {
    id: 'nnunet',
    name: 'nnU-Net',
    shortName: 'nnU-Net',
    color: '#a371f7',        // violet
    colorRgb: { r: 163, g: 113, b: 247 },
    description: 'nnU-Net — self-configuring deep learning segmentation',
    isLocal: false,
    provider: 'api',
    endpoint: NEUROSEG_ENDPOINT,
    endpointPath: '/api/segment_2d',
    fallbackToMock: true,
    modality: 'CT',
    supports2D: true,
    supports3D: true,
    requiresPrompt: false,
    isNew: true,
  },
  // Legacy models (for backward compatibility)
  {
    id: 'sam3',
    name: 'SAM3 (Legacy)',
    shortName: 'SAM3',
    color: '#6e7681',        // gray
    colorRgb: { r: 110, g: 118, b: 129 },
    description: 'NeuroSAM3 — text-prompted brain segmentation (legacy endpoint)',
    isLocal: false,
    provider: 'api',
    endpoint: LEGACY_ENDPOINTS.sam3,
    fallbackToMock: true,
    modality: 'CT',
    supports2D: true,
    supports3D: false,
    requiresPrompt: true,
    isDeprecated: true,      // Mark as deprecated
  },
];

const configMap = new Map(MODEL_CONFIGS.map((m) => [m.id, m]));

// ==================== Core Getters ====================

export function getModelConfig(id) {
  return configMap.get(id) || null;
}

export function getAllModelIds() {
  return MODEL_CONFIGS.map((m) => m.id);
}

export function getAllModelConfigs() {
  return MODEL_CONFIGS;
}

// ==================== Filtered Getters ====================

export function getMLModelIds() {
  // API-backed models require configured endpoints to be runnable.
  return MODEL_CONFIGS
    .filter((m) => m.id !== 'classical' && (m.provider !== 'api' || m.endpoint))
    .map((m) => m.id);
}

export function getApiModels() {
  return MODEL_CONFIGS.filter((m) => m.provider === 'api');
}

export function getLocalModels() {
  return MODEL_CONFIGS.filter((m) => m.provider === 'local');
}

export function getMockModels() {
  return MODEL_CONFIGS.filter((m) => m.provider === 'mock');
}

export function getNewModels() {
  return MODEL_CONFIGS.filter((m) => m.isNew === true);
}

export function getDeprecatedModels() {
  return MODEL_CONFIGS.filter((m) => m.isDeprecated === true);
}

export function getActiveModels() {
  return MODEL_CONFIGS.filter((m) => !m.isDeprecated);
}

// ==================== Modality Filters ====================

export function getModelsForModality(modality) {
  return MODEL_CONFIGS.filter((m) => 
    m.modality === modality || m.modality === 'any'
  );
}

export function getCTModels() {
  return MODEL_CONFIGS.filter((m) => 
    m.modality === 'CT' || m.modality === 'any'
  );
}

export function getMRModels() {
  return MODEL_CONFIGS.filter((m) => 
    m.modality === 'MR' || m.modality === 'any'
  );
}

// ==================== Capability Filters ====================

export function get2DModels() {
  return MODEL_CONFIGS.filter((m) => m.supports2D);
}

export function get3DModels() {
  return MODEL_CONFIGS.filter((m) => m.supports3D);
}

export function getModelsRequiringPrompt() {
  return MODEL_CONFIGS.filter((m) => m.requiresPrompt);
}

// ==================== Server Config ====================

export function getNeuroSegEndpoint() {
  return NEUROSEG_ENDPOINT;
}

export function getUnifiedModels() {
  return MODEL_CONFIGS.filter((m) => 
    m.endpoint === NEUROSEG_ENDPOINT && !m.isDeprecated
  );
}

// ==================== Provider Utilities ====================

export function getProviderType(modelId) {
  const config = configMap.get(modelId);
  return config ? config.provider : null;
}

export function isLocalModel(modelId) {
  const config = configMap.get(modelId);
  return config ? config.provider === 'local' : false;
}

export function isApiModel(modelId) {
  const config = configMap.get(modelId);
  return config ? config.provider === 'api' : false;
}

export function isMockModel(modelId) {
  const config = configMap.get(modelId);
  return config ? config.provider === 'mock' : false;
}

// ==================== Feature Checks ====================

export function supports2D(modelId) {
  const config = configMap.get(modelId);
  return config ? config.supports2D : false;
}

export function supports3D(modelId) {
  const config = configMap.get(modelId);
  return config ? config.supports3D : false;
}

export function requiresPrompt(modelId) {
  const config = configMap.get(modelId);
  return config ? config.requiresPrompt : false;
}

export function getDefaultPrompt(modelId) {
  const config = configMap.get(modelId);
  return config ? config.defaultPrompt : null;
}

export function isNewModel(modelId) {
  const config = configMap.get(modelId);
  return config ? config.isNew : false;
}

export function isDeprecated(modelId) {
  const config = configMap.get(modelId);
  return config ? config.isDeprecated : false;
}

export function getModelWarning(modelId) {
  const config = configMap.get(modelId);
  return config ? config.warning : null;
}

// ==================== Comparison Sets ====================

/**
 * Get recommended models for NPH/CT comparison
 * Returns the best performing CT-compatible models
 */
export function getNPHComparisonSet() {
  return [
    getModelConfig('classical'),
    getModelConfig('medsam2'),
    getModelConfig('mcp_medsam'),
    getModelConfig('segresnet'),
    getModelConfig('nnunet'),
  ].filter(Boolean);
}

/**
 * Get all models available on the unified NeuroSeg server
 */
export function getNeuroSegModelSet() {
  return [
    getModelConfig('medsam2'),
    getModelConfig('mcp_medsam'),
    getModelConfig('sam_med3d'),
    getModelConfig('medsam_3d'),
    getModelConfig('segresnet'),
    getModelConfig('tractseg'),
    getModelConfig('nnunet'),
  ].filter(Boolean);
}

export default MODEL_CONFIGS;
