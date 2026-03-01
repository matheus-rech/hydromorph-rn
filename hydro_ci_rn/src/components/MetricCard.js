/**
 * MetricCard — Reusable metric display card
 * Shows value, label, reference range, and colored status indicator
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, radius, spacing } from '../theme';

/**
 * @param {string}  value   - displayed value (e.g. "0.312")
 * @param {string}  label   - metric name (e.g. "Evans Index")
 * @param {string}  ref     - reference text (e.g. ">0.3 = abnormal")
 * @param {string}  status  - 'normal' | 'abnormal' | 'moderate'
 */
export default function MetricCard({ value, label, ref: refText, status = 'normal' }) {
  const barColor = statusBarColor(status);
  const valueColor = statusValueColor(status);

  return (
    <View style={[styles.card, { borderColor: colors.border2 }]}>
      {/* Status bar at top */}
      <View style={[styles.statusBar, { backgroundColor: barColor }]} />

      <View style={styles.inner}>
        <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.ref}>{refText}</Text>
      </View>
    </View>
  );
}

function statusBarColor(status) {
  switch (status) {
    case 'abnormal': return colors.red;
    case 'moderate': return colors.orange;
    default:         return colors.green;
  }
}

function statusValueColor(status) {
  switch (status) {
    case 'abnormal': return colors.red;
    case 'moderate': return colors.orange;
    default:         return colors.text;
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    flex: 1,
    minWidth: 140,
  },
  statusBar: {
    height: 2,
    borderRadius: 0,
  },
  inner: {
    padding: spacing.lg,
  },
  value: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    fontFamily: 'monospace',
    marginBottom: 4,
    lineHeight: 28,
  },
  label: {
    fontSize: typography.base,
    color: colors.muted,
    fontWeight: typography.medium,
    marginBottom: 2,
  },
  ref: {
    fontSize: typography.xs,
    color: colors.muted,
    fontFamily: 'monospace',
    opacity: 0.7,
  },
});
