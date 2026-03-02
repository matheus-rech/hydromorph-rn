/**
 * MetricsComparisonTable — Cross-model metrics comparison
 *
 * Renders a table with rows for each metric and columns for each model.
 * Cells crossing clinical thresholds are highlighted in red.
 *
 * Author: Matheus Machado Rech
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, typography } from '../theme';
import { getAllModelConfigs } from '../models/ModelRegistry';

const METRICS = [
  {
    key: 'evansIndex',
    label: 'Evans Index',
    format: (v) => v !== undefined ? v.toFixed(3) : '—',
    isAbnormal: (v) => v > 0.3,
  },
  {
    key: 'callosalAngle',
    label: 'Callosal Angle',
    format: (v) => v !== null && v !== undefined ? `${v}°` : '—',
    isAbnormal: (v) => v !== null && v < 90,
  },
  {
    key: 'ventVolMl',
    label: 'Volume (mL)',
    format: (v) => v !== undefined ? v.toFixed(1) : '—',
    isAbnormal: (v) => v > 50,
  },
  {
    key: 'nphPct',
    label: 'NPH Score',
    format: (v) => v !== undefined ? `${v}%` : '—',
    isAbnormal: (v) => v >= 67,
  },
  {
    key: 'processingTime',
    label: 'Time',
    format: (v) => v || '—',
    isAbnormal: () => false,
  },
];

export default function MetricsComparisonTable({ multiModelResults }) {
  const modelConfigs = getAllModelConfigs();

  return (
    <View style={styles.container}>
      {/* Header row */}
      <View style={[styles.row, styles.headerRow]}>
        <View style={[styles.cell, styles.labelCell]}>
          <Text style={styles.headerText}>Metric</Text>
        </View>
        {modelConfigs.map((config) => (
          <View key={config.id} style={[styles.cell, styles.valueCell]}>
            <View style={styles.headerContent}>
              <View style={[styles.colorDot, { backgroundColor: config.color }]} />
              <Text style={styles.headerText} numberOfLines={1}>{config.shortName}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Metric rows */}
      {METRICS.map((metric, rowIdx) => (
        <View key={metric.key} style={[styles.row, rowIdx % 2 === 1 && styles.altRow]}>
          <View style={[styles.cell, styles.labelCell]}>
            <Text style={styles.labelText}>{metric.label}</Text>
          </View>
          {modelConfigs.map((config) => {
            const result = multiModelResults[config.id];
            if (!result) {
              return (
                <View key={config.id} style={[styles.cell, styles.valueCell]}>
                  <Text style={styles.valueText}>—</Text>
                </View>
              );
            }
            const value = result[metric.key];
            const abnormal = metric.isAbnormal(value);
            return (
              <View key={config.id} style={[styles.cell, styles.valueCell]}>
                <Text
                  style={[
                    styles.valueText,
                    abnormal && styles.abnormalText,
                  ]}
                  numberOfLines={1}
                >
                  {metric.format(value)}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border2,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: `${colors.border2}80`,
  },
  headerRow: {
    backgroundColor: colors.bg,
  },
  altRow: {
    backgroundColor: 'rgba(255,255,255,0.015)',
  },
  cell: {
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  labelCell: {
    flex: 1.2,
  },
  valueCell: {
    flex: 1,
    alignItems: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  colorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  headerText: {
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.muted,
    fontWeight: typography.semibold,
  },
  labelText: {
    fontSize: 11,
    color: colors.text,
  },
  valueText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: colors.text,
  },
  abnormalText: {
    color: colors.red,
    fontWeight: typography.semibold,
  },
});
