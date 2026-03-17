/**
 * ModelRegistry — Configuration for all segmentation models
 *
 * Each model entry defines display properties, color assignments,
 * and provider configuration used across the comparison UI.
 * Provider types: 'local' (on-device), 'api' (remote).
 *
 * 6 curated models: Classical, SAM3, BiomedParse, SegVol, VISTA3D, Rep-MedSAM
 *
 * Author: Matheus Machado Rech
 */

import { colors } from '../theme';

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
    id: 'sam3',
    name: 'SAM3 (Meta)',
    shortName: 'SAM3',
    color: colors.red,       // #f85149 — red
    colorRgb: { r: 248, g: 81, b: 73 },
    description: 'SAM3 — text-prompted brain segmentation',
    isLocal: false,
    provider: 'api',
    endpoint: 'https://mmrech-neurosam3.hf.space',
    fallbackToMock: true,
    modality: 'CT',
    supports2D: true,
    supports3D: false,
    requiresPrompt: true,
    defaultPrompt: 'ventricles',
  },
  {
    id: 'biomedparse',
    name: 'BiomedParse (Microsoft)',
    shortName: 'BiomedParse',
    color: colors.green,     // #3fb950 — green
    colorRgb: { r: 63, g: 185, b: 80 },
    description: 'BiomedParse — text-prompted foundation model (Microsoft)',
    isLocal: false,
    provider: 'api',
    endpoint: 'https://mmrech-biomedparse.hf.space',
    fallbackToMock: true,
    modality: 'CT',
    supports2D: true,
    supports3D: true,
    requiresPrompt: true,
    defaultPrompt: 'ventricles',
    isNew: true,
  },
  {
    id: 'segvol',
    name: 'SegVol (BAAI)',
    shortName: 'SegVol',
    color: colors.purple,    // #bc8cff — purple
    colorRgb: { r: 188, g: 140, b: 255 },
    description: 'SegVol — native 3D volumetric segmentation (BAAI)',
    isLocal: false,
    provider: 'api',
    endpoint: 'https://mmrech-segvol.hf.space',
    fallbackToMock: true,
    modality: 'CT',
    supports2D: false,
    supports3D: true,
    requiresPrompt: true,
    defaultPrompt: 'lateral ventricles',
    isNew: true,
  },
  {
    id: 'vista3d',
    name: 'VISTA3D (NVIDIA/MONAI)',
    shortName: 'VISTA3D',
    color: colors.orange,    // #ff6e40 — orange
    colorRgb: { r: 255, g: 110, b: 64 },
    description: 'VISTA3D — auto + interactive 3D segmentation (NVIDIA MONAI)',
    isLocal: false,
    provider: 'api',
    endpoint: 'https://mmrech-vista3d.hf.space',
    fallbackToMock: true,
    modality: 'CT',
    supports2D: false,
    supports3D: true,
    requiresPrompt: false,
    isNew: true,
  },
  {
    id: 'repmedsam',
    name: 'Rep-MedSAM',
    shortName: 'Rep-MedSAM',
    color: colors.cyan,      // #00d4d4 — cyan
    colorRgb: { r: 0, g: 212, b: 212 },
    description: 'Rep-MedSAM — lightweight edge MedSAM (ONNX on-device)',
    isLocal: true,
    provider: 'local',
    endpoint: null,
    fallbackToMock: true,
    modality: 'CT',
    supports2D: true,
    supports3D: false,
    requiresPrompt: true,
    defaultPrompt: 'ventricles',
    isNew: true,
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
  return [...MODEL_CONFIGS];
}

// ==================== Filtered Getters ====================

/**
 * Returns IDs for API-backed ML models that have a configured endpoint.
 */
export function getApiModelIds() {
  return MODEL_CONFIGS
    .filter((m) => m.id !== 'classical' && m.provider === 'api' && m.endpoint)
    .map((m) => m.id);
}

/**
 * @deprecated Use getApiModelIds() instead.
 * Returns IDs for API-backed ML models with configured endpoints.
 * Kept as a compatibility alias for existing callers.
 */
export function getMLModelIds() {
  return getApiModelIds();
}
export function getNonClassicalModelIds() {
  return MODEL_CONFIGS
    .filter((m) => m.id !== 'classical')
    .map((m) => m.id);
}

export function getApiModels() {
  return MODEL_CONFIGS.filter((m) => m.provider === 'api');
}

export function getLocalModels() {
  return MODEL_CONFIGS.filter((m) => m.provider === 'local');
}

export function getNewModels() {
  return MODEL_CONFIGS.filter((m) => m.isNew === true);
}

export function getActiveModels() {
  return MODEL_CONFIGS.map(m => ({ ...m }));
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

export function getModelWarning(modelId) {
  const config = configMap.get(modelId);
  return config ? config.warning : null;
}

// ==================== Comparison Sets ====================

/**
 * Get recommended models for NPH/CT comparison
 * All 6 models are CT-compatible and relevant for NPH analysis
 */
export function getNPHComparisonSet() {
  return MODEL_CONFIGS.map(m => ({ ...m }));
}

export default MODEL_CONFIGS;
