/**
 * ProcessingScreen — Pipeline execution with step-by-step progress
 *
 * Receives navigation params from UploadScreen:
 *   { uri, fileName, fileSize, isSample }
 *
 * Runs the pipeline in the background, updating progress callbacks.
 * On success, navigates to ResultsScreen.
 * On error, navigates back to UploadScreen with an error alert.
 *
 * Author: Matheus Machado Rech
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Alert,
  InteractionManager,
} from 'react-native';
import { colors, spacing, radius, typography } from '../theme';
import { PIPELINE_STEPS, loadNiftiFromUri, loadSampleVolume, runPipeline } from '../pipeline/Pipeline';
import ProgressSteps from '../components/ProgressSteps';

export default function ProcessingScreen({ navigation, route }) {
  const { uri, fileName, fileSize, isSample } = route.params || {};

  const [currentStep, setCurrentStep]   = useState(0);
  const [stepDetail, setStepDetail]     = useState('Initializing pipeline…');
  const [metadata, setMetadata]         = useState(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const didRunRef = useRef(false);

  // ── Pulse animation for brain icon ────────────────────────────────────────
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0,  duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // ── Run pipeline once on mount ────────────────────────────────────────────
  useEffect(() => {
    if (didRunRef.current) return;
    didRunRef.current = true;

    // Defer pipeline start until after the screen transition animation
    InteractionManager.runAfterInteractions(() => {
      runPipelineAsync();
    });
  }, []);

  async function runPipelineAsync() {
    const onProgress = (step, msg) => {
      setCurrentStep(step);
      if (msg) setStepDetail(msg);
    };

    try {
      let volume;

      if (isSample) {
        volume = await loadSampleVolume(onProgress);
      } else {
        volume = await loadNiftiFromUri(uri, fileName, fileSize, onProgress);
      }

      // Update metadata display
      setMetadata({
        shape:    `${volume.shape[0]}×${volume.shape[1]}×${volume.shape[2]}`,
        spacing:  `${volume.spacing[0].toFixed(2)}×${volume.spacing[1].toFixed(2)}×${volume.spacing[2].toFixed(2)} mm`,
        datatype: `INT${volume.header.bitpix}`,
        fileSize: volume.fileSize
          ? `${(volume.fileSize / 1024 / 1024).toFixed(1)} MB`
          : '—',
      });

      const results = await runPipeline(volume, onProgress);

      // Navigate to results
      navigation.replace('Results', { results, volume });

    } catch (err) {
      console.error('Pipeline error:', err);
      Alert.alert(
        'Processing Error',
        err.message || 'An error occurred during processing.',
        [{ text: 'OK', onPress: () => navigation.navigate('Upload') }]
      );
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      {/* Brain animation */}
      <View style={styles.processingHeader}>
        <Animated.View style={[styles.brainRing, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={styles.brainEmoji}>🧠</Text>
        </Animated.View>

        <Text style={styles.processingTitle}>Analyzing your scan…</Text>
        <Text style={styles.processingFilename} numberOfLines={2}>
          {fileName || 'NIfTI volume'}
        </Text>
      </View>

      {/* Volume metadata (shown once parsed) */}
      {metadata && (
        <View style={styles.metadataGrid}>
          <MetaItem label="Shape"    value={metadata.shape} />
          <MetaItem label="Spacing"  value={metadata.spacing} />
          <MetaItem label="Datatype" value={metadata.datatype} />
          <MetaItem label="File size" value={metadata.fileSize} />
        </View>
      )}

      {/* Progress steps */}
      <ProgressSteps
        steps={PIPELINE_STEPS}
        currentStep={currentStep}
        detail={stepDetail}
      />
    </ScrollView>
  );
}

function MetaItem({ label, value }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.huge,
    paddingBottom: spacing.huge,
    gap: spacing.xxl,
  },

  // Processing header
  processingHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  brainRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(88,166,255,0.12)',
    borderWidth: 2,
    borderColor: 'rgba(88,166,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  brainEmoji: {
    fontSize: 36,
  },
  processingTitle: {
    fontSize: typography.xxl,
    fontWeight: typography.semibold,
    color: colors.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  processingFilename: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    maxWidth: 300,
  },

  // Metadata grid
  metadataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
    maxWidth: 480,
  },
  metaItem: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border2,
    borderRadius: radius.sm,
    padding: spacing.md,
    minWidth: '45%',
    flex: 1,
  },
  metaLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: colors.muted,
    fontWeight: typography.semibold,
    marginBottom: 3,
  },
  metaValue: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: colors.cyan,
    fontWeight: typography.medium,
  },
});
