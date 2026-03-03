/**
 * SliceViewer — CT scan slice renderer
 *
 * Renders a single axial or coronal CT slice with ventricle overlay.
 * Converts raw pixel data (Uint8ClampedArray RGBA) to a base64 PNG
 * using a pure-JS PNG encoder, then displays via <Image>.
 *
 * For axial slices (mode='axial'): renders XY plane at z=sliceIndex
 * For coronal slices (mode='coronal'): renders XZ plane at y=sliceIndex
 *
 * Annotations are drawn as SVG overlays on top of the image.
 *
 * Author: Matheus Machado Rech
 */

import React, { useMemo } from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Svg, { Line, Circle, Text as SvgText } from 'react-native-svg';
import { colors, radius } from '../theme';
import { generateAxialPixels, generateCoronalPixels } from '../pipeline/Morphometrics';
import { encodePNG } from '../utils/PngEncoder';

// ─── SliceViewer component ────────────────────────────────────────────────────

const SCREEN_WIDTH = Dimensions.get('window').width;
const MAX_VIEWER_WIDTH = Math.min(SCREEN_WIDTH - 40, 480);

/**
 * @param {Float32Array}     volumeData      - flat float32 CT data
 * @param {Uint8Array}       mask            - ventricle mask
 * @param {number[]}         shape           - [X, Y, Z]
 * @param {number[]}         spacing         - [sx, sy, sz] mm
 * @param {'axial'|'coronal'} mode
 * @param {number}           sliceIndex      - current slice index
 * @param {boolean}          showMask        - whether to show ventricle overlay
 * @param {Object}           evansData       - Evans annotation data (axial only)
 * @param {Object}           callosalData    - Callosal annotation data (coronal only)
 * @param {number}           evansSlice      - best Evans slice (axial only)
 */
export default function SliceViewer({
  volumeData,
  mask,
  shape,
  spacing,
  mode = 'axial',
  sliceIndex,
  showMask = true,
  evansData,
  callosalData,
  evansSlice,
  overlayColor,
}) {
  const [X, Y, Z] = shape;

  // Image dimensions depend on view mode
  const imgWidth  = mode === 'axial' ? X : X;
  const imgHeight = mode === 'axial' ? Y : Z;

  // Compute display dimensions preserving aspect ratio
  const aspectRatio = imgWidth / imgHeight;
  const displayWidth  = MAX_VIEWER_WIDTH;
  const displayHeight = Math.round(displayWidth / aspectRatio);
  const scale = displayWidth / imgWidth;

  // Generate pixel data for current slice
  const base64Uri = useMemo(() => {
    if (!volumeData || !shape) return null;
    try {
      let pixels;
      if (mode === 'axial') {
        pixels = generateAxialPixels(volumeData, mask, shape, sliceIndex, showMask, overlayColor);
      } else {
        pixels = generateCoronalPixels(volumeData, mask, shape, sliceIndex, overlayColor);
      }
      return 'data:image/png;base64,' + encodePNG(imgWidth, imgHeight, pixels);
    } catch (e) {
      console.warn('SliceViewer: failed to generate pixels', e);
      return null;
    }
  }, [volumeData, mask, shape, sliceIndex, showMask, mode, overlayColor]);

  // Build SVG annotation
  const annotation = useMemo(() => {
    if (mode === 'axial' && evansData && sliceIndex === evansSlice) {
      return buildEvansAnnotation(evansData, evansSlice, scale, displayWidth, displayHeight);
    }
    if (mode === 'coronal' && callosalData && callosalData.vertex) {
      return buildCallosalAnnotation(callosalData, Z, scale, displayWidth, displayHeight);
    }
    return null;
  }, [mode, evansData, callosalData, sliceIndex, evansSlice, scale, displayWidth, displayHeight, Z]);

  if (!base64Uri) {
    return (
      <View style={[styles.placeholder, { width: displayWidth, height: displayHeight }]}>
        <Text style={styles.placeholderText}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, { width: displayWidth, height: displayHeight }]}>
      <Image
        source={{ uri: base64Uri }}
        style={{ width: displayWidth, height: displayHeight }}
        resizeMode="stretch"
      />
      {annotation && (
        <Svg
          style={StyleSheet.absoluteFill}
          width={displayWidth}
          height={displayHeight}
        >
          {annotation}
        </Svg>
      )}
    </View>
  );
}

// ─── Annotation builders ──────────────────────────────────────────────────────

function buildEvansAnnotation(evansData, evansSlice, scale, W, H) {
  if (!evansData || !evansData.perSlice) return null;
  const sliceData = evansData.perSlice.find((s) => s.z === evansSlice);
  if (!sliceData) return null;

  const { ventLeft, ventRight, skullLeft, skullRight } = sliceData;
  const sy = Math.floor(H * 0.4); // draw at ~40% height

  return (
    <>
      {/* Ventricle width line (blue) */}
      <Line
        x1={ventLeft * scale}
        y1={sy}
        x2={ventRight * scale}
        y2={sy}
        stroke={colors.accent}
        strokeWidth={2}
      />
      {/* Skull width line (orange) */}
      <Line
        x1={skullLeft * scale}
        y1={sy + 8}
        x2={skullRight * scale}
        y2={sy + 8}
        stroke={colors.orange}
        strokeWidth={2}
      />
      {/* Labels */}
      <SvgText
        x={ventLeft * scale}
        y={sy - 5}
        fill={colors.accent}
        fontSize={Math.max(10, 12 * scale)}
        fontFamily="monospace"
      >
        V
      </SvgText>
      <SvgText
        x={skullLeft * scale}
        y={sy + 22}
        fill={colors.orange}
        fontSize={Math.max(10, 12 * scale)}
        fontFamily="monospace"
      >
        S
      </SvgText>
    </>
  );
}

function buildCallosalAnnotation(callosalData, Z, scale, W, H) {
  if (!callosalData || !callosalData.vertex) return null;

  const { vertex, leftPt, rightPt, angleDeg } = callosalData;

  // Flip z: z=0 → bottom, z=Z-1 → top
  const vx = vertex.x * scale;
  const vz = (Z - 1 - vertex.z) * scale;
  const lx = leftPt.x * scale;
  const lz = (Z - 1 - leftPt.z) * scale;
  const rx = rightPt.x * scale;
  const rz = (Z - 1 - rightPt.z) * scale;

  return (
    <>
      {/* Dashed lines from vertex to left and right points */}
      <Line
        x1={vx} y1={vz} x2={lx} y2={lz}
        stroke={colors.cyan}
        strokeWidth={2.5}
        strokeDasharray="4 3"
      />
      <Line
        x1={vx} y1={vz} x2={rx} y2={rz}
        stroke={colors.cyan}
        strokeWidth={2.5}
        strokeDasharray="4 3"
      />
      {/* Vertex dot */}
      <Circle cx={vx} cy={vz} r={5} fill={colors.cyan} />
      {/* Left point dot */}
      <Circle cx={lx} cy={lz} r={4} fill={colors.orange} />
      {/* Right point dot */}
      <Circle cx={rx} cy={rz} r={4} fill={colors.orange} />
      {/* Angle label */}
      {angleDeg !== null && (
        <SvgText
          x={vx + 8}
          y={vz - 8}
          fill={colors.cyan}
          fontSize={14}
          fontWeight="bold"
          fontFamily="monospace"
        >
          {angleDeg}°
        </SvgText>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
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
    fontSize: 13,
  },
});
