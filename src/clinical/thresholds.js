/**
 * Clinical Thresholds — Single source of truth
 *
 * All clinical cutoffs used across the app are defined here.
 * Import these instead of hardcoding threshold values.
 *
 * Author: Matheus Machado Rech
 */

export const THRESHOLDS = {
  evansIndex: 0.3,       // Evans Index > 0.3 = abnormal
  callosalAngle: 90,     // Callosal Angle < 90° = abnormal
  ventricleVolume: 50,   // Volume > 50 mL = abnormal
  nphAbnormalCount: 2,   // >= 2 criteria met = high probability
};

export function isEvansAbnormal(value) {
  return value > THRESHOLDS.evansIndex;
}

export function isCallosalAbnormal(value) {
  return value !== null && value < THRESHOLDS.callosalAngle;
}

export function isVolumeAbnormal(value) {
  return value > THRESHOLDS.ventricleVolume;
}
