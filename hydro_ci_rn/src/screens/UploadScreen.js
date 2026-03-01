/**
 * UploadScreen — File picker and entry point
 *
 * Allows users to:
 *  1. Pick a NIfTI file (.nii / .nii.gz) via expo-document-picker
 *  2. Load the bundled sample CT scan
 *
 * Author: Matheus Machado Rech
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { colors, spacing, radius, typography } from '../theme';

export default function UploadScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── File picker ────────────────────────────────────────────────────────────

  async function handlePickFile() {
    setError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: Platform.OS === 'ios'
          ? ['public.data', 'org.gnu.gnu-zip-archive']
          : ['*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      const name  = (asset.name || '').toLowerCase();

      if (!name.endsWith('.nii') && !name.endsWith('.nii.gz')) {
        setError('Please select a NIfTI file (.nii or .nii.gz)');
        return;
      }

      await startProcessing({
        uri:      asset.uri,
        fileName: asset.name,
        fileSize: asset.size || 0,
        isSample: false,
      });
    } catch (err) {
      if (err.code === 'DOCUMENT_PICKER_CANCELED') return;
      setError(err.message || 'Failed to pick file.');
    }
  }

  // ── Sample data ────────────────────────────────────────────────────────────

  async function handleSample() {
    setError('');
    await startProcessing({ isSample: true });
  }

  // ── Shared processing entry ────────────────────────────────────────────────

  async function startProcessing({ uri, fileName, fileSize, isSample }) {
    setLoading(true);

    navigation.navigate('Processing', {
      uri,
      fileName: isSample ? 'Sample CT — CADS BrainCT-1mm Subject 155' : fileName,
      fileSize: isSample ? 0 : fileSize,
      isSample: !!isSample,
    });

    setLoading(false);
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoMark}>
          <Text style={styles.logoIcon}>🧠</Text>
        </View>
        <Text style={styles.appTitle}>HydroMorph</Text>
        <Text style={styles.appSubtitle}>Hydrocephalus Morphometrics Pipeline</Text>
      </View>

      {/* Drop Zone / File Picker */}
      <TouchableOpacity
        style={styles.dropZone}
        onPress={handlePickFile}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Select a NIfTI head CT scan"
      >
        <Text style={styles.dropIcon}>⬆</Text>
        <Text style={styles.dropTitle}>Tap to select a head CT scan</Text>
        <Text style={styles.dropHint}>
          Processes entirely on-device.{'\n'}No data ever leaves your device.
        </Text>
        <View style={styles.formatRow}>
          <View style={styles.formatBadge}>
            <Text style={styles.formatBadgeText}>.nii</Text>
          </View>
          <View style={styles.formatBadge}>
            <Text style={styles.formatBadgeText}>.nii.gz</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Error */}
      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Privacy strip */}
      <View style={styles.privacyStrip}>
        <Text style={styles.privacyIcon}>🔒</Text>
        <Text style={styles.privacyText}>
          <Text style={styles.privacyBold}>100% On-Device</Text>
          {' '}— All processing happens locally. Zero server uploads.
        </Text>
      </View>

      {/* Sample data button */}
      <TouchableOpacity
        style={styles.sampleBtn}
        onPress={handleSample}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Try with sample CT scan"
      >
        <Text style={styles.sampleBtnIcon}>📂</Text>
        <Text style={styles.sampleBtnText}>Try with sample CT scan</Text>
      </TouchableOpacity>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerLine}>
          Supports NIfTI-1 format · Head CT in Hounsfield Units
        </Text>
        <Text style={styles.footerLine}>
          Built by{' '}
          <Text style={{ color: colors.accent, fontWeight: typography.semibold }}>
            Matheus Machado Rech
          </Text>
        </Text>
        <Text style={styles.footerDisclaimer}>
          Research use only · Not for clinical diagnosis
        </Text>
      </View>
    </ScrollView>
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
    justifyContent: 'center',
    padding: spacing.xl,
    paddingTop: spacing.huge,
    paddingBottom: spacing.huge,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: spacing.huge,
  },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(88,166,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(88,166,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoIcon: {
    fontSize: 32,
  },
  appTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  appSubtitle: {
    color: colors.muted,
    fontSize: typography.sm,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: typography.medium,
  },

  // Drop zone
  dropZone: {
    width: '100%',
    maxWidth: 480,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.huge,
    alignItems: 'center',
    backgroundColor: colors.surface,
    minHeight: 220,
    justifyContent: 'center',
  },
  dropIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  dropTitle: {
    fontSize: typography.xl,
    fontWeight: typography.semibold,
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  dropHint: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  formatRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  formatBadge: {
    backgroundColor: 'rgba(88,166,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(88,166,255,0.25)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  formatBadgeText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: colors.accent,
    letterSpacing: 0.5,
  },

  // Error
  errorBox: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: 'rgba(248,81,73,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(248,81,73,0.3)',
    borderRadius: radius.md,
    maxWidth: 480,
    width: '100%',
  },
  errorText: {
    color: colors.red,
    fontSize: typography.base,
    textAlign: 'center',
  },

  // Privacy strip
  privacyStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: spacing.xl,
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: 'rgba(63,185,80,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(63,185,80,0.2)',
    maxWidth: 480,
    width: '100%',
  },
  privacyIcon: {
    fontSize: 16,
  },
  privacyText: {
    color: colors.green,
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
  },
  privacyBold: {
    fontWeight: typography.semibold,
  },

  // Sample button
  sampleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    padding: 14,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: 'rgba(88,166,255,0.08)',
    maxWidth: 480,
    width: '100%',
    minHeight: 48,
  },
  sampleBtnIcon: {
    fontSize: 16,
  },
  sampleBtnText: {
    color: colors.accent,
    fontSize: typography.md,
    fontWeight: typography.medium,
  },

  // Footer
  footer: {
    marginTop: spacing.huge,
    alignItems: 'center',
  },
  footerLine: {
    color: colors.muted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 22,
  },
  footerDisclaimer: {
    color: colors.muted,
    fontSize: 11,
    textAlign: 'center',
    opacity: 0.5,
    marginTop: 4,
  },
});
