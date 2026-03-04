/**
 * NPH Scoring — Shared computation
 *
 * Centralizes the NPH probability score calculation that was
 * previously duplicated across Pipeline.js, MockModelProvider.js,
 * and ApiModelProvider.js (×2).
 *
 * Author: Matheus Machado Rech
 */

import { isEvansAbnormal, isCallosalAbnormal, isVolumeAbnormal } from './thresholds';

/**
 * Compute NPH (Normal Pressure Hydrocephalus) probability score.
 *
 * @param {number}      evansIndex    Max Evans Index ratio
 * @param {number|null} callosalAngle Callosal angle in degrees (null if unmeasurable)
 * @param {number}      ventVolMl     Ventricle volume in mL
 * @returns {{ nphScore: number, nphPct: number }}
 */
export function computeNphScore(evansIndex, callosalAngle, ventVolMl) {
  let score = 0;
  if (isEvansAbnormal(evansIndex)) score++;
  if (isCallosalAbnormal(callosalAngle)) score++;
  if (isVolumeAbnormal(ventVolMl)) score++;
  return {
    nphScore: score,
    nphPct: Math.round((score / 3) * 100),
  };
}
