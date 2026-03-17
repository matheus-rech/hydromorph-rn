/**
 * BenchmarkTab — Model performance benchmark visualization
 *
 * Displays horizontal bar chart (Dice scores), scatter plot (Dice vs. time),
 * and summary table comparing all segmentation models against the classical
 * pipeline reference. Uses react-native-svg for chart rendering.
 *
 * Author: Matheus Machado Rech
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Svg, { Rect, Circle, Line, Text as SvgText } from 'react-native-svg';
import { colors, spacing, radius, typography } from '../theme';
import { computeDiceAndIoU, computeVolumeDelta } from '../utils/DiceCalculator';

// ─── Chart dimensions ────────────────────────────────────────────────────────

const BAR_HEIGHT = 28;
const BAR_GAP = 8;
const BAR_CHART_PADDING_LEFT = 90;
const BAR_CHART_PADDING_RIGHT = 56;

// Derive chart width from screen width to avoid clipping on smaller devices.
// Deduct: section paddingHorizontal (spacing.md * 2) + chartWrapper padding (spacing.sm * 2)
const { width: WINDOW_WIDTH } = Dimensions.get('window');
const SCATTER_WIDTH = Math.max(260, WINDOW_WIDTH - (spacing.md * 2 + spacing.sm * 2));
const SCATTER_HEIGHT = 200;
const SCATTER_PADDING = { top: 16, right: 24, bottom: 36, left: 44 };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDice(val) {
  return val.toFixed(2);
}

function formatIoU(val) {
  return val.toFixed(2);
}

function formatTime(seconds) {
  if (seconds < 0.01) return '<0.01s';
  return seconds.toFixed(2) + 's';
}

function formatVolDelta(pct) {
  const sign = pct >= 0 ? '+' : '';
  return sign + pct.toFixed(1) + '%';
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BenchmarkTab({ multiModelResults, classicalResults }) {
  // Compute metrics for all models
  const metrics = useMemo(() => {
    if (!classicalResults || !classicalResults.ventMask) return [];

    const classicalMask = classicalResults.ventMask;
    const classicalVol = classicalResults.ventVolMl || 0;

    const entries = [];

    // Classical is the reference — Dice=1.00, IoU=1.00, delta=0%
    entries.push({
      id: 'classical',
      name: classicalResults.modelName || 'Classical',
      shortName: 'Classical',
      color: classicalResults.modelColor || colors.accent,
      dice: 1.0,
      iou: 1.0,
      volumeDelta: 0,
      time: classicalResults.processingTimeNum || 0,
      volume: classicalVol,
    });

    // ML models
    if (multiModelResults) {
      const modelIds = Object.keys(multiModelResults);
      for (const modelId of modelIds) {
        if (modelId === 'classical') continue;
        const m = multiModelResults[modelId];
        if (!m) continue;

        const modelMask = m.ventMask;
        const modelVol = m.ventVolMl || 0;

        // Use precomputed metrics from pipeline when available (preferred path);
        // fall back to computing them here for backward compatibility.
        let dice, iou;
        if (m.dice !== undefined && m.iou !== undefined) {
          dice = m.dice;
          iou = m.iou;
        } else if (modelMask) {
          ({ dice, iou } = computeDiceAndIoU(classicalMask, modelMask));
        } else {
          dice = 0;
          iou = 0;
        }
        const volDelta = m.volumeDelta !== undefined
          ? m.volumeDelta
          : computeVolumeDelta(classicalVol, modelVol);

        entries.push({
          id: modelId,
          name: m.modelName || modelId,
          shortName: m.modelName || modelId,
          color: m.modelColor || colors.muted,
          dice,
          iou,
          volumeDelta: volDelta,
          time: m.processingTimeNum || 0,
          volume: modelVol,
        });
      }
    }

    // Sort by Dice descending
    entries.sort((a, b) => b.dice - a.dice);
    return entries;
  }, [multiModelResults, classicalResults]);

  // ── Empty state ──────────────────────────────────────────────────────────

  if (!metrics.length) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Model Benchmark</Text>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No model results available</Text>
        </View>
      </View>
    );
  }

  // ── Bar chart dimensions ─────────────────────────────────────────────────

  const barChartHeight = metrics.length * (BAR_HEIGHT + BAR_GAP) + BAR_GAP;
  const barChartWidth = SCATTER_WIDTH + BAR_CHART_PADDING_LEFT;

  // ── Scatter plot scale helpers ───────────────────────────────────────────

  const plotW = SCATTER_WIDTH - SCATTER_PADDING.left - SCATTER_PADDING.right;
  const plotH = SCATTER_HEIGHT - SCATTER_PADDING.top - SCATTER_PADDING.bottom;

  const maxTime = Math.max(...metrics.map((m) => m.time), 1);
  const timeStep = niceStep(maxTime);
  const timeCeil = Math.ceil(maxTime / timeStep) * timeStep;

  function scaleX(t) {
    return SCATTER_PADDING.left + (t / timeCeil) * plotW;
  }
  function scaleY(d) {
    return SCATTER_PADDING.top + (1 - d) * plotH;
  }

  // Y-axis grid values
  const yGridValues = [0.25, 0.5, 0.75, 1.0];

  // X-axis tick values
  const xTicks = [];
  for (let t = 0; t <= timeCeil; t += timeStep) {
    xTicks.push(Math.round(t * 100) / 100);
  }

  return (
    <View style={styles.container}>
      {/* ── Section Header ───────────────────────────────────────────────── */}
      <Text style={styles.heading}>Model Benchmark</Text>

      {/* ── Horizontal Bar Chart ─────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.subHeading}>Dice Coefficient vs. Classical</Text>
        <View style={styles.chartWrapper}>
          <Svg width={barChartWidth} height={barChartHeight}>
            {metrics.map((m, i) => {
              const y = BAR_GAP + i * (BAR_HEIGHT + BAR_GAP);
              const maxBarWidth = barChartWidth - BAR_CHART_PADDING_LEFT - BAR_CHART_PADDING_RIGHT;
              const barWidth = Math.max(m.dice * maxBarWidth, 2);

              return (
                <React.Fragment key={m.id}>
                  {/* Model name label */}
                  <SvgText
                    x={BAR_CHART_PADDING_LEFT - 8}
                    y={y + BAR_HEIGHT / 2 + 4}
                    fill={colors.text}
                    fontSize={typography.sm}
                    fontWeight={typography.medium}
                    textAnchor="end"
                  >
                    {m.shortName}
                  </SvgText>

                  {/* Bar */}
                  <Rect
                    x={BAR_CHART_PADDING_LEFT}
                    y={y}
                    width={barWidth}
                    height={BAR_HEIGHT}
                    rx={4}
                    ry={4}
                    fill={m.color}
                    opacity={0.85}
                  />

                  {/* Dice value label */}
                  <SvgText
                    x={BAR_CHART_PADDING_LEFT + barWidth + 8}
                    y={y + BAR_HEIGHT / 2 + 4}
                    fill={colors.text}
                    fontSize={typography.sm}
                    fontWeight={typography.bold}
                  >
                    {formatDice(m.dice)}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </Svg>
        </View>
      </View>

      {/* ── Scatter Plot ─────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.subHeading}>Dice vs. Inference Time</Text>
        <View style={styles.chartWrapper}>
          <Svg width={SCATTER_WIDTH} height={SCATTER_HEIGHT}>
            {/* Y-axis grid lines + labels */}
            {yGridValues.map((val) => {
              const yPos = scaleY(val);
              return (
                <React.Fragment key={`ygrid-${val}`}>
                  <Line
                    x1={SCATTER_PADDING.left}
                    y1={yPos}
                    x2={SCATTER_WIDTH - SCATTER_PADDING.right}
                    y2={yPos}
                    stroke={colors.border}
                    strokeWidth={0.5}
                    strokeDasharray="4,3"
                  />
                  <SvgText
                    x={SCATTER_PADDING.left - 8}
                    y={yPos + 4}
                    fill={colors.muted}
                    fontSize={typography.xs}
                    textAnchor="end"
                  >
                    {val.toFixed(2)}
                  </SvgText>
                </React.Fragment>
              );
            })}

            {/* X-axis baseline */}
            <Line
              x1={SCATTER_PADDING.left}
              y1={scaleY(0)}
              x2={SCATTER_WIDTH - SCATTER_PADDING.right}
              y2={scaleY(0)}
              stroke={colors.border}
              strokeWidth={1}
            />

            {/* Y-axis line */}
            <Line
              x1={SCATTER_PADDING.left}
              y1={SCATTER_PADDING.top}
              x2={SCATTER_PADDING.left}
              y2={scaleY(0)}
              stroke={colors.border}
              strokeWidth={1}
            />

            {/* X-axis tick labels */}
            {xTicks.map((t) => {
              const xPos = scaleX(t);
              return (
                <SvgText
                  key={`xtick-${t}`}
                  x={xPos}
                  y={scaleY(0) + 16}
                  fill={colors.muted}
                  fontSize={typography.xs}
                  textAnchor="middle"
                >
                  {t.toFixed(1)}
                </SvgText>
              );
            })}

            {/* Axis labels */}
            <SvgText
              x={SCATTER_PADDING.left + plotW / 2}
              y={SCATTER_HEIGHT - 2}
              fill={colors.muted}
              fontSize={typography.xs}
              textAnchor="middle"
            >
              Time (s)
            </SvgText>
            <SvgText
              x={12}
              y={SCATTER_PADDING.top + plotH / 2}
              fill={colors.muted}
              fontSize={typography.xs}
              textAnchor="middle"
              rotation={-90}
              originX={12}
              originY={SCATTER_PADDING.top + plotH / 2}
            >
              Dice
            </SvgText>

            {/* Data points */}
            {metrics.map((m) => (
              <Circle
                key={`dot-${m.id}`}
                cx={scaleX(m.time)}
                cy={scaleY(m.dice)}
                r={8}
                fill={m.color}
                opacity={0.9}
              />
            ))}
          </Svg>
        </View>
      </View>

      {/* ── Summary Table ────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.subHeading}>Summary</Text>
        <View style={styles.table}>
          {/* Header row */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, styles.tableCellModel, styles.tableHeaderText]}>
              Model
            </Text>
            <Text style={[styles.tableCell, styles.tableCellNum, styles.tableHeaderText]}>
              Dice
            </Text>
            <Text style={[styles.tableCell, styles.tableCellNum, styles.tableHeaderText]}>
              IoU
            </Text>
            <Text style={[styles.tableCell, styles.tableCellNum, styles.tableHeaderText]}>
              Time
            </Text>
            <Text style={[styles.tableCell, styles.tableCellNum, styles.tableHeaderText]}>
              Vol Delta
            </Text>
          </View>

          {/* Data rows */}
          {metrics.map((m, i) => {
            const isEven = i % 2 === 0;
            return (
              <View
                key={m.id}
                style={[
                  styles.tableRow,
                  { backgroundColor: isEven ? colors.surface : colors.surface2 },
                ]}
              >
                {/* Left color accent border */}
                <View style={[styles.tableAccent, { backgroundColor: m.color }]} />
                <Text
                  style={[styles.tableCell, styles.tableCellModel, styles.tableCellText]}
                  numberOfLines={1}
                >
                  {m.shortName}
                </Text>
                <Text style={[styles.tableCell, styles.tableCellNum, styles.tableCellText]}>
                  {formatDice(m.dice)}
                </Text>
                <Text style={[styles.tableCell, styles.tableCellNum, styles.tableCellText]}>
                  {formatIoU(m.iou)}
                </Text>
                <Text style={[styles.tableCell, styles.tableCellNum, styles.tableCellText]}>
                  {formatTime(m.time)}
                </Text>
                <Text style={[styles.tableCell, styles.tableCellNum, styles.tableCellText]}>
                  {formatVolDelta(m.volumeDelta)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ─── Utility: compute a "nice" step for axis ticks ───────────────────────────

function niceStep(maxVal) {
  if (maxVal <= 0.1) return 0.02;
  if (maxVal <= 0.5) return 0.1;
  if (maxVal <= 1) return 0.2;
  if (maxVal <= 2) return 0.5;
  if (maxVal <= 5) return 1;
  if (maxVal <= 10) return 2;
  if (maxVal <= 30) return 5;
  if (maxVal <= 60) return 10;
  return Math.ceil(maxVal / 5);
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.md,
  },
  heading: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  subHeading: {
    fontSize: typography.md,
    fontWeight: typography.semibold,
    color: colors.muted,
    marginBottom: spacing.sm,
  },
  section: {
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  chartWrapper: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    overflow: 'hidden',
  },
  emptyContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.md,
  },
  emptyText: {
    fontSize: typography.base,
    color: colors.muted,
  },

  // ── Table ──
  table: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
  },
  tableHeader: {
    backgroundColor: colors.surface2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableHeaderText: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableAccent: {
    width: 3,
    alignSelf: 'stretch',
  },
  tableCell: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  tableCellModel: {
    flex: 2,
  },
  tableCellNum: {
    flex: 1,
    textAlign: 'right',
  },
  tableCellText: {
    fontSize: typography.sm,
    color: colors.text,
  },
});
