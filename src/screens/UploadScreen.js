/**
 * UploadScreen — File picker and entry point
 *
 * Allows users to:
 *  1. Pick a NIfTI scan (.nii, .nii.gz) via expo-document-picker
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
import { setApiConfig, isCloudEnabled } from '../config/apiConfig';
import { checkHealth } from '../api/GradioClient';
import { getApiModels } from '../models/ModelRegistry';
import SamplePickerModal from '../components/SamplePickerModal';

export default function UploadScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cloudMode, setCloudMode] = useState(isCloudEnabled());
  const [connectionStatus, setConnectionStatus] = useState(null); // null | 'testing' | 'ok' | 'slow' | 'error'
  const [connectionMsg, setConnectionMsg] = useState('');
  const [showSamplePicker, setShowSamplePicker] = useState(false);

  // ── File picker ────────────────────────────────────────────────────────────

  async function handlePickFile() {
    setError('');
    try {
      const ACCEPTED_EXTENSIONS = [
        '.nii', '.nii.gz',           // NIfTI
      ];

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

      if (!ACCEPTED_EXTENSIONS.some(ext => name.endsWith(ext))) {
        setError('Unsupported format. Accepted: NIfTI (.nii, .nii.gz)');
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

  function handleSample() {
    setError('');
    setShowSamplePicker(true);
  }

  async function handleSampleSelected(sample) {
    setShowSamplePicker(false);
    if (sample.isBundled) {
      await startProcessing({ isSample: true });
    } else {
      await startProcessing({ isSample: true, sampleId: sample.id });
    }
  }

  // ── Shared processing entry ────────────────────────────────────────────────

  async function startProcessing({ uri, fileName, fileSize, isSample, sampleId }) {
    setLoading(true);

    navigation.navigate('Processing', {
      uri,
      fileName: isSample
        ? (sampleId ? `Sample CT — ${sampleId}` : 'Sample CT — Brain Atlas (CC BY 4.0)')
        : fileName,
      fileSize: isSample ? 0 : fileSize,
      isSample: !!isSample,
      sampleId: sampleId || null,
    });

    setLoading(false);
  }

  // ── Cloud mode toggle ─────────────────────────────────────────────────────

  function handleCloudToggle() {
    const newValue = !cloudMode;
    setCloudMode(newValue);
    setApiConfig({ cloudEnabled: newValue });
    if (newValue) {
      testConnection();
    } else {
      setConnectionStatus(null);
      setConnectionMsg('');
    }
  }

  async function testConnection() {
    const apiModels = getApiModels();
    const modelWithEndpoint = apiModels.find((m) => m.endpoint);
    if (!modelWithEndpoint) {
      setConnectionStatus('error');
      setConnectionMsg('No API endpoint configured');
      return;
    }

    setConnectionStatus('testing');
    setConnectionMsg(`Checking ${modelWithEndpoint.name}...`);

    const start = Date.now();
    const result = await checkHealth(modelWithEndpoint.endpoint, 15000);
    const elapsed = Date.now() - start;

    if (result.ok) {
      if (elapsed > 5000) {
        setConnectionStatus('slow');
        setConnectionMsg(`${modelWithEndpoint.name} — cold start (~${Math.ceil(elapsed / 1000)}s)`);
      } else {
        setConnectionStatus('ok');
        setConnectionMsg(`${modelWithEndpoint.name} — connected`);
      }
    } else {
      setConnectionStatus('error');
      setConnectionMsg(`${modelWithEndpoint.name} — ${result.status}`);
    }
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
        accessibilityLabel="Select a NIfTI scan"
      >
        <Text style={styles.dropIcon}>⬆</Text>
        <Text style={styles.dropTitle}>Tap to select a NIfTI scan</Text>
        <Text style={styles.dropHint}>
          NIfTI volumes are processed on-device.{'\n'}Cloud mode optionally compares anonymized model results.
        </Text>
        <View style={styles.formatRow}>
          <View style={styles.formatBadge}>
            <Text style={styles.formatBadgeText}>.nii / .nii.gz</Text>
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
          <Text style={styles.privacyBold}>Privacy-first pipeline</Text>
          {' '}— Classical processing stays on-device; cloud mode sends only anonymized slices or masks.
        </Text>
      </View>

      {/* Cloud mode toggle */}
      <TouchableOpacity
        style={[styles.cloudToggle, cloudMode && styles.cloudToggleActive]}
        onPress={handleCloudToggle}
        activeOpacity={0.7}
      >
        <View style={styles.cloudToggleHeader}>
          <Text style={styles.cloudToggleIcon}>{cloudMode ? '☁' : '🔌'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cloudToggleTitle, cloudMode && styles.cloudToggleTitleActive]}>
              {cloudMode ? 'Cloud Mode' : 'Cloud Disabled'}
            </Text>
            <Text style={[styles.cloudToggleDesc, cloudMode && styles.cloudToggleDescActive]}>
              {cloudMode
                ? 'Sends anonymized data to inference API'
                : 'Cloud inference is disabled'}
            </Text>
          </View>
          <View style={[styles.cloudTogglePill, cloudMode && styles.cloudTogglePillActive]}>
            <Text style={[styles.cloudTogglePillText, cloudMode && styles.cloudTogglePillTextActive]}>
              {cloudMode ? 'ON' : 'OFF'}
            </Text>
          </View>
        </View>
        {cloudMode && (
          <Text style={styles.cloudWarning}>
            ⚠ Anonymized slice data sent to HuggingFace Spaces
          </Text>
        )}
      </TouchableOpacity>

      {/* Connection status (shown when cloud mode is ON) */}
      {cloudMode && connectionStatus && (
        <View style={[
          styles.connectionStatus,
          connectionStatus === 'ok' && styles.connectionOk,
          connectionStatus === 'slow' && styles.connectionSlow,
          connectionStatus === 'error' && styles.connectionError,
          connectionStatus === 'testing' && styles.connectionTesting,
        ]}>
          <Text style={styles.connectionDot}>
            {connectionStatus === 'ok' ? '●' : connectionStatus === 'slow' ? '●' : connectionStatus === 'error' ? '●' : '◌'}
          </Text>
          <Text style={[
            styles.connectionText,
            connectionStatus === 'ok' && { color: colors.green },
            connectionStatus === 'slow' && { color: colors.yellow },
            connectionStatus === 'error' && { color: colors.red },
            connectionStatus === 'testing' && { color: colors.muted },
          ]}>
            {connectionMsg}
          </Text>
          {connectionStatus !== 'testing' && (
            <TouchableOpacity onPress={testConnection} activeOpacity={0.7}>
              <Text style={styles.retestText}>Retest</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

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
          NIfTI · Remote sample CT · Optional cloud comparison
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

      {/* Sample picker modal */}
      <SamplePickerModal
        visible={showSamplePicker}
        onClose={() => setShowSamplePicker(false)}
        onSelect={handleSampleSelected}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    ...Platform.select({
      web: { height: '100vh', maxHeight: '100vh' },
      default: {},
    }),
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

  // Cloud mode toggle
  cloudToggle: {
    marginTop: spacing.sm,
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border2,
    maxWidth: 480,
    width: '100%',
  },
  cloudToggleActive: {
    backgroundColor: 'rgba(210,153,34,0.08)',
    borderColor: 'rgba(210,153,34,0.3)',
  },
  cloudToggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cloudToggleIcon: {
    fontSize: 16,
  },
  cloudToggleTitle: {
    fontSize: 13,
    fontWeight: typography.semibold,
    color: colors.muted,
  },
  cloudToggleTitleActive: {
    color: colors.yellow,
  },
  cloudToggleDesc: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  cloudToggleDescActive: {
    color: 'rgba(210,153,34,0.8)',
  },
  cloudTogglePill: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  cloudTogglePillActive: {
    backgroundColor: 'rgba(210,153,34,0.15)',
    borderColor: 'rgba(210,153,34,0.4)',
  },
  cloudTogglePillText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: typography.semibold,
    color: colors.muted,
  },
  cloudTogglePillTextActive: {
    color: colors.yellow,
  },
  cloudWarning: {
    marginTop: 8,
    fontSize: 11,
    color: colors.yellow,
    opacity: 0.8,
  },

  // Connection status
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    maxWidth: 480,
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border2,
  },
  connectionOk: {
    backgroundColor: 'rgba(63,185,80,0.06)',
    borderColor: 'rgba(63,185,80,0.2)',
  },
  connectionSlow: {
    backgroundColor: 'rgba(210,153,34,0.06)',
    borderColor: 'rgba(210,153,34,0.2)',
  },
  connectionError: {
    backgroundColor: 'rgba(248,81,73,0.06)',
    borderColor: 'rgba(248,81,73,0.2)',
  },
  connectionTesting: {
    backgroundColor: colors.surface,
    borderColor: colors.border2,
  },
  connectionDot: {
    fontSize: 8,
  },
  connectionText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'monospace',
    color: colors.muted,
  },
  retestText: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: typography.medium,
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
