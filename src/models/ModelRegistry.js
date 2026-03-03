/**
 * ModelRegistry — Configuration for all segmentation models
 *
 * Each model entry defines display properties, color assignments,
 * and provider configuration used across the comparison UI.
 * Provider types: 'local' (on-device), 'api' (remote), 'mock' (simulated).
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
  },
  {
    id: 'medsam2',
    name: 'MedSAM2',
    shortName: 'MedSAM2',
    color: colors.green,     // #3fb950 — green
    colorRgb: { r: 63, g: 185, b: 80 },
    description: 'Medical Segment Anything Model 2 — slight over-segmentation',
    isLocal: false,
    provider: 'api',
    endpoint: '',
    fallbackToMock: true,
  },
  {
    id: 'sam3',
    name: 'SAM3',
    shortName: 'SAM3',
    color: colors.purple,    // #bc8cff — purple
    colorRgb: { r: 188, g: 140, b: 255 },
    description: 'NeuroSAM3 — text-prompted medical image segmentation',
    isLocal: false,
    provider: 'api',
    endpoint: 'https://mmrech-neurosam3.hf.space',
    fallbackToMock: true,
  },
  {
    id: 'yolovx',
    name: 'YOLOvx',
    shortName: 'YOLOvx',
    color: colors.orange,    // #ff6e40 — orange
    colorRgb: { r: 255, g: 110, b: 64 },
    description: 'YOLO-based volumetric segmentation — fast, blobby output',
    isLocal: false,
    provider: 'mock',
    endpoint: null,
    fallbackToMock: false,
  },
];

const configMap = new Map(MODEL_CONFIGS.map((m) => [m.id, m]));

export function getModelConfig(id) {
  return configMap.get(id) || null;
}

export function getAllModelIds() {
  return MODEL_CONFIGS.map((m) => m.id);
}

export function getMLModelIds() {
  return MODEL_CONFIGS.filter((m) => m.id !== 'classical').map((m) => m.id);
}

export function getAllModelConfigs() {
  return MODEL_CONFIGS;
}

export function getApiModels() {
  return MODEL_CONFIGS.filter((m) => m.provider === 'api');
}

export function getMockModels() {
  return MODEL_CONFIGS.filter((m) => m.provider === 'mock');
}

export function getProviderType(modelId) {
  const config = configMap.get(modelId);
  return config ? config.provider : null;
}

export default MODEL_CONFIGS;
