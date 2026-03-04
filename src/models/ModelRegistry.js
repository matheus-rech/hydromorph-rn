/**
 * ModelRegistry — Configuration for all segmentation models
 *
 * Each model entry defines display properties, color assignments,
 * and provider configuration used across the comparison UI.
 * Provider types: 'local' (on-device), 'api' (remote).
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
    description: 'MedSAM2 — video-propagation ventricle segmentation',
    isLocal: false,
    provider: 'api',
    endpoint: '',
    fallbackToMock: false,
  },
  {
    id: 'sam3',
    name: 'SAM3',
    shortName: 'SAM3',
    color: colors.purple,    // #bc8cff — purple
    colorRgb: { r: 188, g: 140, b: 255 },
    description: 'NeuroSAM3 — text-prompted brain segmentation',
    isLocal: false,
    provider: 'api',
    endpoint: 'https://mmrech-neurosam3.hf.space',
    fallbackToMock: false,
  },
  {
    id: 'yolovx',
    name: 'SegResNet',
    shortName: 'SegResNet',
    color: colors.orange,    // #ff6e40 — orange
    colorRgb: { r: 255, g: 110, b: 64 },
    description: 'SegResNet (MONAI) — automatic ventricle segmentation',
    isLocal: false,
    provider: 'api',
    endpoint: '', // TODO: set real YOLOvx deployment endpoint
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
  return MODEL_CONFIGS
    // API-backed models require configured endpoints to be runnable.
    .filter((m) => m.id !== 'classical' && (m.provider !== 'api' || m.endpoint))
    .map((m) => m.id);
}

export function getAllModelConfigs() {
  return MODEL_CONFIGS;
}

export function getApiModels() {
  return MODEL_CONFIGS.filter((m) => m.provider === 'api');
}

export function getProviderType(modelId) {
  const config = configMap.get(modelId);
  return config ? config.provider : null;
}

export default MODEL_CONFIGS;
