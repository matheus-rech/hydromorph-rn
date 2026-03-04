/**
 * SamplePickerModal — Modal overlay for selecting sample CT scans
 *
 * Displays a visual grid of available NPH samples (bundled + remote HF datasets)
 * with CT thumbnail images, severity badges, size indicators, and source tags.
 *
 * Author: Matheus Machado Rech
 */

import React from 'react';
import {
  View,
  Text,
  Image,
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

const NUM_COLUMNS = 2;
const CARD_GAP = spacing.sm;

export default function SamplePickerModal({ visible, onClose, onSelect }) {
  const samples = getSampleMetadata();

  // Build rows of 2 for the grid
  const rows = [];
  for (let i = 0; i < samples.length; i += NUM_COLUMNS) {
    rows.push(samples.slice(i, i + NUM_COLUMNS));
  }

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

          {/* Sample grid */}
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {rows.map((row, rowIdx) => (
              <View key={rowIdx} style={styles.gridRow}>
                {row.map((sample) => {
                  const sevColor = SEVERITY_COLORS[sample.severity] || colors.muted;
                  return (
                    <TouchableOpacity
                      key={sample.id}
                      style={styles.sampleCard}
                      onPress={() => onSelect(sample)}
                      activeOpacity={0.7}
                    >
                      {/* Thumbnail */}
                      <View style={styles.thumbnailContainer}>
                        <Image
                          source={sample.thumbnail}
                          style={styles.thumbnail}
                          resizeMode="cover"
                        />
                        {/* Overlay badges on thumbnail */}
                        <View style={styles.thumbnailBadges}>
                          {sample.is2D && (
                            <View style={[styles.badge, { backgroundColor: `${colors.cyan}30`, borderColor: `${colors.cyan}60` }]}>
                              <Text style={[styles.badgeText, { color: colors.cyan }]}>2D</Text>
                            </View>
                          )}
                          <View style={[styles.badge, { backgroundColor: `${sevColor}30`, borderColor: `${sevColor}60` }]}>
                            <Text style={[styles.badgeText, { color: sevColor }]}>
                              {sample.severity.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Card info below thumbnail */}
                      <View style={styles.cardInfo}>
                        <Text style={styles.sampleName} numberOfLines={1}>
                          {sample.name}
                        </Text>
                        <View style={styles.cardMeta}>
                          <Text style={styles.metaText}>{sample.size}</Text>
                          <Text style={styles.metaDot}>·</Text>
                          <Text
                            style={[
                              styles.metaText,
                              sample.isBundled && { color: colors.green },
                            ]}
                            numberOfLines={1}
                          >
                            {sample.isBundled ? 'Bundled — instant' : 'Remote'}
                          </Text>
                          {sample.hasGroundTruth && (
                            <>
                              <Text style={styles.metaDot}>·</Text>
                              <Text style={[styles.metaText, { color: colors.green }]}>GT</Text>
                            </>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                {/* Fill empty space if odd number of items in last row */}
                {row.length < NUM_COLUMNS && <View style={styles.sampleCardPlaceholder} />}
              </View>
            ))}
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
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
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

  // Grid
  list: {
    flexShrink: 1,
  },
  listContent: {
    padding: spacing.md,
    gap: CARD_GAP,
  },
  gridRow: {
    flexDirection: 'row',
    gap: CARD_GAP,
  },

  // Sample card (grid item)
  sampleCard: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border2,
    overflow: 'hidden',
  },
  sampleCardPlaceholder: {
    flex: 1,
  },

  // Thumbnail
  thumbnailContainer: {
    aspectRatio: 1,
    backgroundColor: colors.bg,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailBadges: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    flexDirection: 'row',
    gap: 4,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: typography.bold,
    letterSpacing: 0.5,
  },

  // Card info (below thumbnail)
  cardInfo: {
    padding: spacing.sm,
  },
  sampleName: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: colors.muted,
  },
  metaDot: {
    fontSize: 9,
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
