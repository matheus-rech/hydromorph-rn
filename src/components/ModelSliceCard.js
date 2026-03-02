/**
 * ModelSliceCard — Compact slice viewer for the 2×2 comparison grid
 *
 * Renders a single model's axial slice with colored overlay and
 * bounding box SVG annotations. Used inside ComparisonView.
 *
 * Author: Matheus Machado Rech
 */

import React, { useMemo } from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
} from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { colors, radius, typography } from '../theme';
import { generateAxialPixels } from '../pipeline/Morphometrics';

// ─── Pure-JS minimal PNG encoder (same as SliceViewer) ────────────────────────

function encodePNG(width, height, rgba) {
  const crcTable = buildCrcTable();

  function crc32(data) {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ data[i]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function buildCrcTable() {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      t[n] = c;
    }
    return t;
  }

  function adler32(data) {
    let a = 1, b = 0;
    for (let i = 0; i < data.length; i++) {
      a = (a + data[i]) % 65521;
      b = (b + a) % 65521;
    }
    return ((b << 16) | a) >>> 0;
  }

  function u32be(n) {
    return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
  }

  function chunk(type, data) {
    const typeBytes = type.split('').map((c) => c.charCodeAt(0));
    const len = u32be(data.length);
    const crcData = new Uint8Array(typeBytes.length + data.length);
    crcData.set(typeBytes, 0);
    crcData.set(data, typeBytes.length);
    const checksum = u32be(crc32(crcData));
    return [...len, ...typeBytes, ...data, ...checksum];
  }

  const rawRGB = [];
  for (let y = 0; y < height; y++) {
    rawRGB.push(0);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      rawRGB.push(rgba[i], rgba[i + 1], rgba[i + 2]);
    }
  }
  const rawRGBu8 = new Uint8Array(rawRGB);
  const adl2 = adler32(rawRGBu8);

  const BSIZE = 65535;
  const rgbBlocks = [];
  let pos2 = 0;
  while (pos2 < rawRGBu8.length) {
    const end = Math.min(pos2 + BSIZE, rawRGBu8.length);
    const last = end >= rawRGBu8.length ? 1 : 0;
    const sl = rawRGBu8.subarray(pos2, end);
    const len = sl.length;
    const nlen = (~len) & 0xffff;
    rgbBlocks.push(last | 0);
    rgbBlocks.push(len & 0xff, (len >> 8) & 0xff);
    rgbBlocks.push(nlen & 0xff, (nlen >> 8) & 0xff);
    for (let i = 0; i < sl.length; i++) rgbBlocks.push(sl[i]);
    pos2 = end;
  }

  const ihdrFull = new Uint8Array([...u32be(width), ...u32be(height), 8, 2, 0, 0, 0]);
  const zlibRGB = [
    0x78, 0x01,
    ...rgbBlocks,
    (adl2 >>> 24) & 0xff, (adl2 >>> 16) & 0xff, (adl2 >>> 8) & 0xff, adl2 & 0xff,
  ];

  const pngBytes = [
    137, 80, 78, 71, 13, 10, 26, 10,
    ...chunk('IHDR', Array.from(ihdrFull)),
    ...chunk('IDAT', zlibRGB),
    ...chunk('IEND', []),
  ];

  let binary = '';
  for (let i = 0; i < pngBytes.length; i++) {
    binary += String.fromCharCode(pngBytes[i]);
  }
  return 'data:image/png;base64,' + btoa(binary);
}

// ─── ModelSliceCard ──────────────────────────────────────────────────────────

export default function ModelSliceCard({
  modelResult,
  volumeData,
  shape,
  sliceIndex,
  cardWidth,
}) {
  const { modelId, modelName, modelColor, colorRgb, ventMask, boundingBoxes } = modelResult;
  const [X, Y] = shape;

  const displayWidth = cardWidth;
  const aspectRatio = X / Y;
  const displayHeight = Math.round(displayWidth / aspectRatio);
  const scale = displayWidth / X;

  const base64Uri = useMemo(() => {
    if (!volumeData || !shape || !ventMask) return null;
    try {
      const pixels = generateAxialPixels(
        volumeData, ventMask, shape, sliceIndex, true, colorRgb
      );
      return encodePNG(X, Y, pixels);
    } catch (e) {
      console.warn(`ModelSliceCard [${modelId}]: failed to render`, e);
      return null;
    }
  }, [volumeData, ventMask, shape, sliceIndex, colorRgb]);

  // Filter bounding boxes visible on this slice
  const visibleBoxes = useMemo(() => {
    if (!boundingBoxes) return [];
    return boundingBoxes.filter(
      (bb) => sliceIndex >= bb.minZ && sliceIndex <= bb.maxZ
    );
  }, [boundingBoxes, sliceIndex]);

  return (
    <View style={[styles.card, { width: displayWidth, borderTopColor: modelColor }]}>
      {/* Model name badge */}
      <View style={[styles.badge, { backgroundColor: modelColor + '20', borderColor: modelColor + '40' }]}>
        <View style={[styles.badgeDot, { backgroundColor: modelColor }]} />
        <Text style={[styles.badgeText, { color: modelColor }]}>{modelName}</Text>
      </View>

      {/* Slice image */}
      <View style={[styles.imageWrap, { width: displayWidth, height: displayHeight }]}>
        {base64Uri ? (
          <Image
            source={{ uri: base64Uri }}
            style={{ width: displayWidth, height: displayHeight }}
            resizeMode="stretch"
          />
        ) : (
          <View style={[styles.placeholder, { width: displayWidth, height: displayHeight }]}>
            <Text style={styles.placeholderText}>...</Text>
          </View>
        )}

        {/* Bounding box SVG overlays */}
        {visibleBoxes.length > 0 && (
          <Svg
            style={StyleSheet.absoluteFill}
            width={displayWidth}
            height={displayHeight}
          >
            {visibleBoxes.map((bb, i) => (
              <React.Fragment key={i}>
                <Rect
                  x={bb.minX * scale}
                  y={bb.minY * scale}
                  width={(bb.maxX - bb.minX) * scale}
                  height={(bb.maxY - bb.minY) * scale}
                  stroke={modelColor}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  fill="none"
                />
                <SvgText
                  x={bb.minX * scale + 2}
                  y={bb.minY * scale - 3}
                  fill={modelColor}
                  fontSize={8}
                  fontFamily="monospace"
                >
                  {(bb.confidence * 100).toFixed(0)}%
                </SvgText>
              </React.Fragment>
            ))}
          </Svg>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border2,
    borderTopWidth: 3,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border2,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: typography.semibold,
    fontFamily: 'monospace',
  },
  imageWrap: {
    backgroundColor: '#000',
    position: 'relative',
  },
  placeholder: {
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: colors.muted,
    fontSize: 11,
  },
});
