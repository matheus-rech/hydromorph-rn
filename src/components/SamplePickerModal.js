/**
 * SamplePickerModal — Modal overlay for selecting sample CT scans
 *
 * Displays a list of available NPH samples (bundled + remote HF datasets)
 * with severity badges, size indicators, and source tags.
 *
 * Author: Matheus Machado Rech
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { colors, spacing, radius, typography } from '../theme';
import { getSampleMetadata } from '../config/sampleDataConfig';

const SEVERITY_COLORS = {
  mild:     colors.green,
  moderate: colors.yellow,
  severe:   colors.red,
};

export default function SamplePickerModal({ visible, onClose, onSelect }) {
  const samples = getSampleMetadata();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Sample CT Scans</Text>
              <Text style={styles.subtitle}>Select a case to analyze</Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Sample list */}
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {samples.map((sample) => {
              const sevColor = SEVERITY_COLORS[sample.severity] || colors.muted;
              return (
                <TouchableOpacity
                  key={sample.id}
                  style={styles.sampleCard}
                  onPress={() => onSelect(sample)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardRow}>
                    <View style={styles.cardInfo}>
                      <Text style={styles.sampleName}>{sample.name}</Text>
                      <Text style={styles.sampleDesc}>{sample.description}</Text>
                    </View>
                    <View style={styles.cardBadges}>
                      {/* Format badge */}
                      {sample.is2D && (
                        <View style={[styles.badge, { backgroundColor: `${colors.cyan}15`, borderColor: `${colors.cyan}40` }]}>
                          <Text style={[styles.badgeText, { color: colors.cyan }]}>2D</Text>
                        </View>
                      )}
                      {/* Severity badge */}
                      <View style={[styles.badge, { backgroundColor: `${sevColor}15`, borderColor: `${sevColor}40` }]}>
                        <Text style={[styles.badgeText, { color: sevColor }]}>
                          {sample.severity.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.cardMeta}>
                    <Text style={styles.metaText}>{sample.size}</Text>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={[
                      styles.metaText,
                      sample.isBundled && { color: colors.green },
                    ]}>
                      {sample.isBundled ? 'Bundled — instant' : sample.is2D ? 'Model API only' : 'Remote (HF Dataset)'}
                    </Text>
                    {sample.hasGroundTruth && (
                      <>
                        <Text style={styles.metaDot}>·</Text>
                        <Text style={[styles.metaText, { color: colors.green }]}>GT mask</Text>
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Footer note */}
          <Text style={styles.footerNote}>
            Remote scans download from HuggingFace · Bundled scan loads instantly
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
    maxWidth: 440,
    maxHeight: '80%',
    overflow: 'hidden',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border2,
  },
  title: {
    fontSize: typography.xl,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.sm,
    color: colors.muted,
    marginTop: 2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: typography.semibold,
  },

  // List
  list: {
    flexShrink: 1,
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },

  // Sample card
  sampleCard: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border2,
    padding: spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  cardInfo: {
    flex: 1,
  },
  sampleName: {
    fontSize: typography.md,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  sampleDesc: {
    fontSize: typography.sm,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 16,
  },
  cardBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: typography.semibold,
    letterSpacing: 0.5,
  },

  // Card meta row
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  metaText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: colors.muted,
  },
  metaDot: {
    fontSize: 11,
    color: colors.muted,
    opacity: 0.5,
  },

  // Footer
  footerNote: {
    fontSize: 10,
    color: colors.muted,
    textAlign: 'center',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border2,
    opacity: 0.7,
  },
});
