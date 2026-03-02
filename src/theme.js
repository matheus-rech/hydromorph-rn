/**
 * HydroMorph — GitHub Dark Theme
 * Colors, spacing, and typography constants for React Native
 * Author: Matheus Machado Rech
 */

export const colors = {
  // Backgrounds
  bg:       '#0d1117',
  surface:  '#161b22',
  surface2: '#1c2128',

  // Borders
  border:  '#30363d',
  border2: '#21262d',

  // Text
  text:  '#e6edf3',
  muted: '#8b949e',

  // Accent colors
  accent: '#58a6ff',
  cyan:   '#00d4d4',
  orange: '#ff6e40',
  green:  '#3fb950',
  red:    '#f85149',
  yellow: '#d29922',
  purple: '#bc8cff',

  // Semantic
  shadow: 'rgba(0,0,0,0.5)',
  black:  '#000000',
};

export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
};

export const typography = {
  // Font sizes
  xs:    10,
  sm:    11,
  base:  13,
  md:    14,
  lg:    16,
  xl:    18,
  xxl:   22,
  xxxl:  24,
  huge:  28,
  display: 42,

  // Font weights (React Native uses string or numeric)
  regular:   '400',
  medium:    '500',
  semibold:  '600',
  bold:      '700',
  extrabold: '800',
};

/** Convenience: monospace font family */
export const monoFont = {
  fontFamily: 'monospace',
};

/** Common shadow style */
export const shadowStyle = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.4,
  shadowRadius: 6,
  elevation: 4,
};

/** Status color helpers */
export function statusColor(status) {
  switch (status) {
    case 'abnormal': return colors.red;
    case 'moderate': return colors.orange;
    case 'normal':   return colors.green;
    default:         return colors.muted;
  }
}

export function nphLevelColor(score) {
  if (score >= 2) return colors.red;
  if (score === 1) return colors.orange;
  return colors.green;
}

export function nphLevelLabel(score) {
  if (score >= 2) return 'HIGH';
  if (score === 1) return 'MODERATE';
  return 'LOW';
}
