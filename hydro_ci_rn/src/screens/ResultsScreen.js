/**
 * ResultsScreen — Full morphometrics results display
 *
 * Sections:
 *   A. NPH Assessment badge
 *   B. Key Metrics (4 cards: Evans, Angle, Volume, NPH%)
 *   C. Axial Slice Viewer with slider and mask toggle
 *   D. Coronal Slice Viewer with callosal angle annotation
 *   E. Detailed Measurements Table
 *   F. Sanity Checks
 *
 * Author: Matheus Machado Rech
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { colors, spacing, radius, typography } from '../theme';
import MetricCard  from '../components/MetricCard';
import NPHBadge    from '../components/NPHBadge';
import SliceViewer from '../components/SliceViewer';
import { runSanityChecks } from '../pipeline/Pipeline';

export default function ResultsScreen({ navigation, route }) {
  const { results, volume } = route.params || {};

  const [currentAxialSlice, setCurrentAxialSlice] = useState(
    results?.evansSlice >= 0 ? results.evansSlice : Math.floor((volume?.shape?.[2] || 1) / 2)
  );
  const [showMask, setShowMask] = useState(true);

  if (!results || !volume) {
    return (
      <View style={styles.errorScreen}>
        <Text style={{ color: colors.red }}>No results to display.</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Upload')}>
          <Text style={{ color: colors.accent, marginTop: 12 }}>← New Scan</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const {
    evansIndex, evansSlice, evansData,
    callosalAngle, callosalSlice, callosalData,
    ventVolMl, ventVolMm3,
    nphScore, nphPct,
    ventCount, brainVoxCount,
    shape, spacing: volSpacing,
    ventMask,
  } = results;

  const { data: volumeData } = volume;

  const Z = shape[2];
  const voxVolMm3 = volSpacing[0] * volSpacing[1] * volSpacing[2];

  const evansStatus  = evansIndex > 0.3     ? 'abnormal' : 'normal';
  const angleStatus  = callosalAngle !== null && callosalAngle < 90 ? 'abnormal' : 'normal';
  const volumeStatus = ventVolMl > 50       ? 'abnormal' : 'normal';
  const nphStatus    = nphScore >= 2        ? 'abnormal' : nphScore === 1 ? 'moderate' : 'normal';

  const warnings = runSanityChecks(results);

  const handleNewScan = useCallback(() => {
    navigation.navigate('Upload');
  }, [navigation]);

  return (
    <View style={styles.screen}>
      {/* Sticky top bar */}
      <View style={styles.topbar}>
        <View style={styles.topbarLeft}>
          <Text style={styles.topbarTitle}>🧠 HydroMorph</Text>
          <View style={styles.topbarBadge}>
            <Text style={styles.topbarBadgeText}>Results</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.newScanBtnTop} onPress={handleNewScan} activeOpacity={0.7}>
          <Text style={styles.newScanBtnTopText}>↩ New Scan</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>

        {/* ── A: NPH Assessment ───────────────────────────────────────────── */}
        <SectionHeader title="NPH Assessment" />
        <NPHBadge nphScore={nphScore} nphPct={nphPct} />

        {/* ── B: Key Metrics ──────────────────────────────────────────────── */}
        <SectionHeader title="Key Metrics" />
        <View style={styles.metricsGrid}>
          <MetricCard
            value={evansIndex !== undefined ? evansIndex.toFixed(3) : '—'}
            label="Evans Index"
            ref=">0.3 = abnormal"
            status={evansStatus}
          />
          <MetricCard
            value={callosalAngle !== null ? `${callosalAngle}°` : '—'}
            label="Callosal Angle"
            ref="<90° = abnormal"
            status={angleStatus}
          />
        </View>
        <View style={[styles.metricsGrid, { marginTop: 12 }]}>
          <MetricCard
            value={`${ventVolMl.toFixed(1)} mL`}
            label="Ventricle Volume"
            ref=">50 mL = abnormal"
            status={volumeStatus}
          />
          <MetricCard
            value={`${nphPct}%`}
            label="NPH Probability"
            ref={`${nphScore}/3 criteria`}
            status={nphStatus}
          />
        </View>

        {/* Reference legend */}
        <View style={styles.refLegend}>
          <RefDot color={colors.green}  label="Normal range" />
          <RefDot color={colors.red}    label="Abnormal range" />
          <RefDot color={colors.accent} label="Ventricle overlay" />
        </View>

        {/* ── C: Axial Slice Viewer ────────────────────────────────────────── */}
        <SectionHeader title="Axial View — Evans Index" />
        <View style={styles.viewerContainer}>
          {/* Viewer header */}
          <View style={styles.viewerHeader}>
            <View>
              <Text style={styles.viewerTitle}>Axial Slice</Text>
              <Text style={styles.viewerTag}>Brain window W:80 L:40</Text>
            </View>
            <TouchableOpacity
              style={[styles.toggleBtn, showMask && styles.toggleBtnActive]}
              onPress={() => setShowMask(!showMask)}
              activeOpacity={0.7}
            >
              <Text style={[styles.toggleBtnText, showMask && styles.toggleBtnTextActive]}>
                {showMask ? 'Hide Overlay' : 'Show Overlay'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Canvas */}
          <View style={styles.canvasWrap}>
            <SliceViewer
              volumeData={volumeData}
              mask={ventMask}
              shape={shape}
              spacing={volSpacing}
              mode="axial"
              sliceIndex={currentAxialSlice}
              showMask={showMask}
              evansData={evansData}
              evansSlice={evansSlice}
            />
          </View>

          {/* Slider controls */}
          <View style={styles.viewerControls}>
            <Text style={styles.sliceLabel}>
              Slice {currentAxialSlice} / {Z - 1}
            </Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={Z - 1}
              step={1}
              value={currentAxialSlice}
              onValueChange={(v) => setCurrentAxialSlice(Math.round(v))}
              minimumTrackTintColor={colors.accent}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.accent}
              accessibilityLabel="Axial slice selector"
            />
            {/* Legend */}
            <View style={styles.legendRow}>
              <LegendDot color={colors.accent} label="Ventricle width (V)" />
              <LegendDot color={colors.orange} label="Skull width (S)" />
            </View>
          </View>
        </View>

        {/* ── D: Coronal Slice Viewer ──────────────────────────────────────── */}
        <SectionHeader title="Coronal View — Callosal Angle" />
        <View style={styles.viewerContainer}>
          <View style={styles.viewerHeader}>
            <View>
              <Text style={styles.viewerTitle}>Coronal Slice</Text>
              <Text style={styles.viewerTag}>Best cross-section</Text>
            </View>
          </View>
          <View style={styles.canvasWrap}>
            {callosalSlice >= 0 ? (
              <SliceViewer
                volumeData={volumeData}
                mask={ventMask}
                shape={shape}
                spacing={volSpacing}
                mode="coronal"
                sliceIndex={callosalSlice}
                showMask={true}
                callosalData={callosalData}
              />
            ) : (
              <View style={styles.noDataBox}>
                <Text style={styles.noDataText}>
                  Could not determine callosal slice
                </Text>
              </View>
            )}
          </View>
          <View style={styles.viewerControls}>
            <View style={styles.legendRow}>
              <LegendDot color={colors.cyan}   label="Vertex" />
              <LegendDot color={colors.orange} label="L/R points" />
              <LegendDot color={`${colors.cyan}80`} label="Angle vectors" />
            </View>
          </View>
        </View>

        {/* ── E: Detailed Measurements Table ──────────────────────────────── */}
        <SectionHeader title="Detailed Measurements" />
        <View style={styles.tableContainer}>
          <MeasurementsTable results={results} voxVolMm3={voxVolMm3} />
        </View>

        {/* ── F: Sanity Checks ────────────────────────────────────────────── */}
        <SectionHeader title="Sanity Checks" />
        {warnings.length === 0 ? (
          <View style={styles.sanityOk}>
            <Text style={styles.sanityOkText}>✓ All measurements within expected ranges</Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {warnings.map((w, i) => (
              <View key={i} style={styles.sanityWarn}>
                <Text style={styles.sanityWarnText}>⚠ {w}</Text>
              </View>
            ))}
          </View>
        )}

        {/* New Scan button */}
        <TouchableOpacity
          style={styles.newScanBtn}
          onPress={handleNewScan}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          <Text style={styles.newScanBtnText}>↩ Analyze New Scan</Text>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerDisclaimer}>⚠ Research use only. Not for clinical diagnosis.</Text>
          <Text style={styles.footerVersion}>HydroMorph v2.0.0</Text>
          <Text style={styles.footerAuthor}>Matheus Machado Rech</Text>
          <Text style={styles.footerRef}>
            Data reference: CADS BrainCT-1mm (CC BY 4.0)
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title }) {
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
    marginBottom: 12,
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

function RefDot({ color, label }) {
  return (
    <View style={refStyles.item}>
      <View style={[refStyles.dot, { backgroundColor: color }]} />
      <Text style={refStyles.label}>{label}</Text>
    </View>
  );
}

const refStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 11,
    color: colors.muted,
  },
});

function LegendDot({ color, label }) {
  return (
    <View style={legendStyles.item}>
      <View style={[legendStyles.dot, { backgroundColor: color }]} />
      <Text style={legendStyles.label}>{label}</Text>
    </View>
  );
}

const legendStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: {
    fontSize: 11,
    color: colors.muted,
  },
});

function MeasurementsTable({ results, voxVolMm3 }) {
  const {
    evansIndex, evansSlice,
    callosalAngle, callosalSlice,
    ventVolMm3, ventVolMl,
    ventCount, shape, spacing: volSpacing,
  } = results;

  const rows = [
    {
      label: 'Evans Index',
      value: evansIndex.toFixed(4),
      unit: 'ratio',
      abnormal: evansIndex > 0.3,
      status: evansIndex > 0.3 ? 'ABNORMAL' : 'NORMAL',
    },
    {
      label: 'Best Evans Slice',
      value: String(evansSlice),
      unit: 'voxel (axial z)',
      status: '—',
    },
    {
      label: 'Callosal Angle',
      value: callosalAngle !== null ? String(callosalAngle) : 'N/A',
      unit: 'degrees',
      abnormal: callosalAngle !== null && callosalAngle < 90,
      status: callosalAngle !== null
        ? callosalAngle < 90 ? 'ABNORMAL' : 'NORMAL'
        : 'N/A',
    },
    {
      label: 'Callosal Slice',
      value: String(callosalSlice),
      unit: 'voxel (coronal y)',
      status: '—',
    },
    {
      label: 'Ventricle Volume',
      value: ventVolMm3.toFixed(0),
      unit: 'mm³',
      status: '—',
    },
    {
      label: 'Ventricle Volume',
      value: ventVolMl.toFixed(2),
      unit: 'mL',
      abnormal: ventVolMl > 50,
      status: ventVolMl > 50 ? 'ABNORMAL' : 'NORMAL',
    },
    {
      label: 'Ventricle Voxels',
      value: ventCount.toLocaleString(),
      unit: 'voxels',
      status: '—',
    },
    {
      label: 'Voxel Volume',
      value: voxVolMm3.toFixed(4),
      unit: 'mm³',
      status: '—',
    },
    {
      label: 'Volume (X×Y×Z)',
      value: `${shape[0]}×${shape[1]}×${shape[2]}`,
      unit: 'voxels',
      status: '—',
    },
    {
      label: 'Spacing (X×Y×Z)',
      value: `${volSpacing[0].toFixed(3)}×${volSpacing[1].toFixed(3)}×${volSpacing[2].toFixed(3)}`,
      unit: 'mm/voxel',
      status: '—',
    },
  ];

  return (
    <View style={tableStyles.table}>
      {/* Header */}
      <View style={[tableStyles.row, tableStyles.headerRow]}>
        <Text style={[tableStyles.cell, tableStyles.headerCell, { flex: 2 }]}>Measurement</Text>
        <Text style={[tableStyles.cell, tableStyles.headerCell, { flex: 1.5 }]}>Value</Text>
        <Text style={[tableStyles.cell, tableStyles.headerCell, { flex: 1.2 }]}>Unit</Text>
        <Text style={[tableStyles.cell, tableStyles.headerCell, { flex: 1 }]}>Status</Text>
      </View>
      {/* Body */}
      {rows.map((row, i) => (
        <View key={i} style={[tableStyles.row, i % 2 === 1 && tableStyles.altRow]}>
          <Text style={[tableStyles.cell, tableStyles.labelCell, { flex: 2 }]}>{row.label}</Text>
          <Text style={[tableStyles.cell, tableStyles.valueCell, { flex: 1.5 }]}>{row.value}</Text>
          <Text style={[tableStyles.cell, tableStyles.unitCell, { flex: 1.2 }]}>{row.unit}</Text>
          <Text
            style={[
              tableStyles.cell,
              tableStyles.statusCell,
              { flex: 1 },
              row.abnormal ? tableStyles.statusAbnormal : tableStyles.statusNormal,
              row.status === '—' && tableStyles.statusMuted,
            ]}
          >
            {row.status}
          </Text>
        </View>
      ))}
    </View>
  );
}

const tableStyles = StyleSheet.create({
  table: {
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
    paddingVertical: 9,
    paddingHorizontal: 10,
    fontSize: 12,
  },
  headerCell: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: colors.muted,
    fontWeight: typography.semibold,
  },
  labelCell: {
    color: colors.text,
  },
  valueCell: {
    color: colors.text,
    fontFamily: 'monospace',
  },
  unitCell: {
    color: colors.muted,
    fontSize: 11,
  },
  statusCell: {
    fontFamily: 'monospace',
    fontWeight: typography.semibold,
    fontSize: 11,
  },
  statusAbnormal: {
    color: colors.red,
  },
  statusNormal: {
    color: colors.green,
  },
  statusMuted: {
    color: colors.muted,
  },
});

// ─── Main styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  errorScreen: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Sticky topbar
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(13,17,23,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: colors.border2,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  topbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topbarTitle: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  topbarBadge: {
    backgroundColor: 'rgba(88,166,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(88,166,255,0.3)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  topbarBadgeText: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: colors.accent,
  },
  newScanBtnTop: {
    borderWidth: 1,
    borderColor: 'rgba(248,81,73,0.3)',
    backgroundColor: 'rgba(248,81,73,0.05)',
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newScanBtnTopText: {
    color: colors.red,
    fontSize: 12,
    fontWeight: typography.medium,
  },

  // Scroll content
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.huge,
    gap: 8,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },

  // Metrics grid
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
  },

  // Reference legend
  refLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border2,
    borderRadius: radius.md,
    padding: 12,
    marginTop: 4,
  },

  // Viewer
  viewerContainer: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border2,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border2,
  },
  viewerTitle: {
    fontSize: 13,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  viewerTag: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: colors.muted,
    marginTop: 2,
  },
  toggleBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 5,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(88,166,255,0.1)',
  },
  toggleBtnText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: typography.medium,
  },
  toggleBtnTextActive: {
    color: colors.accent,
  },
  canvasWrap: {
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  viewerControls: {
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border2,
    gap: 8,
  },
  sliceLabel: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: colors.accent,
    textAlign: 'center',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 16,
    paddingVertical: 4,
  },

  // Table
  tableContainer: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },

  // Sanity checks
  sanityOk: {
    backgroundColor: 'rgba(63,185,80,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(63,185,80,0.2)',
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  sanityOkText: {
    color: colors.green,
    fontSize: typography.md,
    fontWeight: typography.medium,
  },
  sanityWarn: {
    backgroundColor: 'rgba(210,153,34,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(210,153,34,0.2)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  sanityWarnText: {
    color: colors.yellow,
    fontSize: 13,
    lineHeight: 20,
  },

  // No data placeholder
  noDataBox: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: {
    color: colors.muted,
    fontSize: 13,
  },

  // New scan button
  newScanBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  newScanBtnText: {
    color: colors.bg,
    fontSize: 16,
    fontWeight: typography.semibold,
  },

  // Footer
  footer: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border2,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    gap: 4,
    marginTop: spacing.lg,
  },
  footerDisclaimer: {
    color: colors.orange,
    fontWeight: typography.semibold,
    fontSize: 12,
    marginBottom: 4,
  },
  footerVersion: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: colors.muted,
    opacity: 0.6,
  },
  footerAuthor: {
    color: colors.muted,
    fontSize: 11,
  },
  footerRef: {
    color: colors.muted,
    fontSize: 10,
    opacity: 0.6,
    textAlign: 'center',
  },
});
