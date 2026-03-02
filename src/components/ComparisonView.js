/**
 * ComparisonView — Main multi-model comparison layout
 *
 * Renders a 2×2 grid of ModelSliceCard components with a shared
 * slice slider, MetricsComparisonTable, and bounding box summary.
 *
 * Author: Matheus Machado Rech
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { colors, spacing as sp, radius, typography } from '../theme';
import { getAllModelConfigs } from '../models/ModelRegistry';
import ModelSliceCard from './ModelSliceCard';
import MetricsComparisonTable from './MetricsComparisonTable';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_GAP = 8;
const GRID_PADDING = sp.lg;

export default function ComparisonView({ multiModelResults, volumeData, shape }) {
  const Z = shape[2];
  const modelConfigs = getAllModelConfigs();

  // Start at middle slice
  const [sliceIndex, setSliceIndex] = useState(Math.floor(Z / 2));

  // Debounced slider: avoid 4 PNG encodes per frame during drag
  const debounceRef = useRef(null);
  const handleSliderChange = useCallback((v) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSliceIndex(Math.round(v));
    }, 50);
  }, []);

  // Compute card width for 2×2 grid
  const availableWidth = Math.min(SCREEN_WIDTH - GRID_PADDING * 2, 560);
  const cardWidth = Math.floor((availableWidth - GRID_GAP) / 2);

  return (
    <View style={styles.container}>
      {/* ── 2×2 Slice Grid ──────────────────────────────────────────────── */}
      <SectionLabel title={`Axial Comparison (Slice ${sliceIndex} / ${Z - 1})`} />
      <View style={styles.grid}>
        {modelConfigs.map((config) => {
          const result = multiModelResults[config.id];
          if (!result) return null;
          return (
            <ModelSliceCard
              key={config.id}
              modelResult={result}
              volumeData={volumeData}
              shape={shape}
              sliceIndex={sliceIndex}
              cardWidth={cardWidth}
            />
          );
        })}
      </View>

      {/* ── Shared Slider ───────────────────────────────────────────────── */}
      <View style={styles.sliderContainer}>
        <Text style={styles.sliceLabel}>
          Slice {sliceIndex} / {Z - 1}
        </Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={Z - 1}
          step={1}
          value={sliceIndex}
          onValueChange={handleSliderChange}
          minimumTrackTintColor={colors.accent}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.accent}
          accessibilityLabel="Comparison slice selector"
        />
      </View>

      {/* ── Metrics Comparison Table ────────────────────────────────────── */}
      <SectionLabel title="Metrics Comparison" />
      <MetricsComparisonTable multiModelResults={multiModelResults} />

      {/* ── Bounding Box Summary ────────────────────────────────────────── */}
      <SectionLabel title="Bounding Boxes" />
      <View style={styles.bboxSummary}>
        {modelConfigs.map((config) => {
          const result = multiModelResults[config.id];
          const count = result?.boundingBoxes?.length || 0;
          return (
            <View key={config.id} style={styles.bboxItem}>
              <View style={[styles.bboxDot, { backgroundColor: config.color }]} />
              <Text style={styles.bboxLabel}>{config.shortName}</Text>
              <Text style={[styles.bboxCount, { color: config.color }]}>
                {count} {count === 1 ? 'region' : 'regions'}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function SectionLabel({ title }) {
  return (
    <View style={sectionStyles.row}>
      <Text style={sectionStyles.text}>{title}</Text>
      <View style={sectionStyles.line} />
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginTop: 8,
  },
  text: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.0,
    color: colors.muted,
    fontWeight: typography.semibold,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border2,
  },
});

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    justifyContent: 'center',
  },
  sliderContainer: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border2,
    borderRadius: radius.md,
    padding: sp.md,
    gap: 6,
    marginTop: 4,
  },
  sliceLabel: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: colors.accent,
    textAlign: 'center',
  },
  slider: {
    width: '100%',
    height: 36,
  },
  bboxSummary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border2,
    borderRadius: radius.md,
    padding: sp.md,
    gap: 8,
  },
  bboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bboxDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bboxLabel: {
    fontSize: 12,
    color: colors.text,
    flex: 1,
  },
  bboxCount: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: typography.medium,
  },
});
