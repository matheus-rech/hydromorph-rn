/**
 * ProgressSteps — Pipeline step checklist with status indicators
 * Supports: pending, active (spinning), done states
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, typography, spacing, radius } from '../theme';

/**
 * @param {string[]} steps        - array of step label strings
 * @param {number}   currentStep  - index of currently active step (0-based)
 * @param {string}   detail       - detail message shown below steps
 */
export default function ProgressSteps({ steps, currentStep, detail }) {
  return (
    <View style={styles.container}>
      <View style={styles.stepList}>
        {steps.map((step, i) => {
          const isDone   = i < currentStep;
          const isActive = i === currentStep;
          return (
            <StepRow
              key={i}
              label={step}
              isDone={isDone}
              isActive={isActive}
            />
          );
        })}
      </View>
      {!!detail && (
        <View style={styles.detailBox}>
          <Text style={styles.detailText} numberOfLines={3}>{detail}</Text>
        </View>
      )}
    </View>
  );
}

function StepRow({ label, isDone, isActive }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive) {
      Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spin.stopAnimation();
      spin.setValue(0);
    }
  }, [isActive]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  let icon, iconColor, rowStyle, textStyle;

  if (isDone) {
    icon = '✓';
    iconColor = colors.green;
    rowStyle = styles.rowDone;
    textStyle = styles.textDone;
  } else if (isActive) {
    icon = '◉';
    iconColor = colors.accent;
    rowStyle = styles.rowActive;
    textStyle = styles.textActive;
  } else {
    icon = '○';
    iconColor = colors.muted;
    rowStyle = styles.rowPending;
    textStyle = styles.textPending;
  }

  return (
    <View style={[styles.row, rowStyle]}>
      {isActive ? (
        <Animated.Text style={[styles.icon, { color: iconColor, transform: [{ rotate }] }]}>
          {icon}
        </Animated.Text>
      ) : (
        <Text style={[styles.icon, { color: iconColor }]}>{icon}</Text>
      )}
      <Text style={[styles.stepLabel, textStyle]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border2,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignSelf: 'center',
  },
  stepList: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
  },
  rowPending: {},
  rowActive: {
    backgroundColor: 'rgba(88,166,255,0.07)',
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
    paddingLeft: 8,
  },
  rowDone: {},
  icon: {
    fontFamily: 'monospace',
    fontSize: 14,
    width: 18,
    textAlign: 'center',
  },
  stepLabel: {
    fontSize: typography.md,
    flex: 1,
  },
  textPending: {
    color: colors.muted,
  },
  textActive: {
    color: colors.accent,
    fontWeight: typography.medium,
  },
  textDone: {
    color: colors.green,
  },
  detailBox: {
    marginTop: 12,
    padding: 8,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border2,
    minHeight: 36,
  },
  detailText: {
    fontFamily: 'monospace',
    fontSize: typography.sm,
    color: colors.muted,
  },
});
