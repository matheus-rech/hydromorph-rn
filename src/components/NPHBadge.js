/**
 * NPHBadge — NPH Probability assessment badge
 * Shows LOW / MODERATE / HIGH with percentage and criteria score
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, radius, spacing } from '../theme';
import { nphLevelColor, nphLevelLabel } from '../theme';

/**
 * @param {number} nphScore  - 0, 1, 2, or 3 criteria met
 * @param {number} nphPct    - 0, 33, 67, or 100
 */
export default function NPHBadge({ nphScore, nphPct }) {
  const level = nphLevelLabel(nphScore);
  const color = nphLevelColor(nphScore);

  const bgColor = `${color}15`;       // ~8% opacity
  const borderColor = `${color}50`;   // ~30% opacity

  return (
    <View style={[styles.badge, { backgroundColor: bgColor, borderColor }]}>
      <Text style={[styles.label, { color }]}>{level}</Text>
      <Text style={[styles.sub, { color }]}>NPH PROBABILITY</Text>
      <Text style={[styles.pct, { color }]}>{nphPct}%</Text>
      <Text style={[styles.score, { color }]}>{nphScore}/3 criteria met</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xxl,
    alignItems: 'center',
  },
  label: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1.5,
    lineHeight: 32,
    marginBottom: 4,
  },
  sub: {
    fontSize: typography.xs,
    letterSpacing: 1.2,
    fontWeight: typography.semibold,
    opacity: 0.7,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  pct: {
    fontFamily: 'monospace',
    fontSize: 48,
    fontWeight: typography.bold,
    lineHeight: 52,
    marginBottom: 4,
  },
  score: {
    fontSize: typography.md,
    opacity: 0.75,
  },
});
