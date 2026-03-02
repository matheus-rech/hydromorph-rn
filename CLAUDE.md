# HydroMorph RN — Claude Code Instructions

## Project Overview

Cross-platform hydrocephalus morphometrics app. Computes Evans Index, Callosal Angle, and Ventricle Volume from NIfTI head CT scans. 100% on-device processing — no patient scan data ever leaves the device.

- **Stack**: React Native (Expo SDK 51), React Navigation v6, react-native-svg
- **Theme**: GitHub dark (`#0d1117` background)
- **Author**: Matheus Machado Rech
- **License**: Research use only — not for clinical diagnosis
- **Version**: 2.0.0

## Tech Stack

| Dependency | Purpose |
|---|---|
| `expo ~51.0.0` | Managed workflow runtime |
| `react-native 0.74.1` | UI framework |
| `@react-navigation/stack ^6.3.20` | Stack navigator (headerless) |
| `react-native-svg 15.2.0` | SVG annotation overlays |
| `pako ^2.1.0` | Gzip decompression for NIfTI files |
| `expo-document-picker` | File selection |
| `expo-file-system` | File I/O |
| `@react-native-community/slider` | UI slider |
| `react-native-reanimated ~3.10.1` | Animations (babel plugin required) |

Babel config uses `babel-preset-expo` + `react-native-reanimated/plugin`.

## Architecture

### Navigation Flow

```
Upload → Processing → Results
```

All screens use `headerShown: false`. Processing screen disables gesture-back.

### Pipeline (9 classical + 4 model steps)

The pipeline runs synchronous JS on the main thread. `await delay()` yields are inserted between steps to allow UI updates (progress indicators). Steps:

1. Parse NIfTI header
2. Build brain mask (HU -5 to 80, closing, largest component)
3. Extract CSF (HU 0 to 22 within brain)
4. Morphological filtering (adaptive opening, skip if spacing < 0.7 or > 2.5mm)
5. Isolate ventricles (central 60% crop, BFS components > 0.5mL)
6. Compute Evans Index
7. Compute Callosal Angle
8. Compute Volume
9. Generate report / NPH score
10-12. Run ML model mocks (MedSAM2, SAM3, YOLOvx)
13. Compare results

### Rendering Pipeline (no Canvas API)

`Morphometrics.js` generates RGBA `Uint8ClampedArray` buffers via `generateAxialPixels()` / `generateCoronalPixels()`. These accept optional `overlayColor = { r, g, b }` for per-model coloring. `SliceViewer.js` encodes buffers to PNG base64 using a pure-JS encoder, displayed via `<Image>`. SVG annotations (Evans lines, Callosal angle) are layered on top.

### Data Flow Between Screens

Large typed arrays (ventricle masks ~10MB each) are stored in `ResultsStore.js` (module-level singleton), NOT passed through React Navigation params (serialization limit ~1MB). Only a boolean flag is passed via navigation to signal data readiness.

## File Map

```
App.js                          Entry point, navigation setup
src/
  theme.js                      GitHub-dark design tokens (colors, spacing, typography, radius)
  screens/
    UploadScreen.js             File picker + sample data loader
    ProcessingScreen.js         Progress UI, runs pipeline
    ResultsScreen.js            Metrics display, tab switching (Detail / Comparison)
  components/
    MetricCard.js               Single metric display card
    NPHBadge.js                 NPH probability badge
    ProgressSteps.js            Step-by-step progress indicator
    SliceViewer.js              CT slice renderer (pure-JS PNG encoder + SVG overlay)
    ModelSliceCard.js           Per-model slice card in comparison view
    MetricsComparisonTable.js   Side-by-side model metrics table
    ComparisonView.js           Multi-model comparison tab
  pipeline/
    NiftiReader.js              NIfTI-1 parser (gzip via pako, endianness, 6 datatypes)
    Morphometrics.js            3D morphological ops, BFS, Evans, Callosal angle, pixel generation
    Pipeline.js                 9-step orchestrator + multi-model pipeline + loaders
  models/
    ModelRegistry.js            Central config for all segmentation models — add new models here
    MockModelProvider.js        Mock perturbation strategies (dilate, opening, ellipsoid)
    ResultsStore.js             Module-level store for multi-model results
assets/
  sample-data.json              Bundled 64x64 CT demo (~430KB, base64 gzip int16)
```

## File Conventions

- **Header comment block**: Every file starts with `/** ... */` containing description and `Author: Matheus Machado Rech`
- **Components**: PascalCase filenames, `export default function ComponentName`
- **Pipeline/Model functions**: camelCase, named exports (`export function runPipeline`)
- **Theme**: Always import from `src/theme.js` — never hardcode colors, spacing, or typography values
- **Styles**: Use `StyleSheet.create()` at the bottom of each component file

## Model System

### ModelRegistry.js — Central Config

Each model entry: `{ id, name, shortName, color, colorRgb, description, isLocal }`.
Current models: `classical` (blue), `medsam2` (green), `sam3` (purple), `yolovx` (orange).
To add a new model, add an entry to `MODEL_CONFIGS` array.

### Model Result Interface

```js
{
  modelId, modelName, modelColor, colorRgb,
  evansIndex, evansSlice, evansData,
  callosalAngle, callosalSlice, callosalData,
  ventVolMl, ventVolMm3,
  nphScore, nphPct,
  ventCount, ventMask, shape, spacing,
  boundingBoxes, processingTime
}
```

### MockModelProvider.js → ApiModelProvider.js

Current mocks perturb the classical mask: MedSAM2 dilates (+5-15%), SAM3 opens (-5-10%), YOLOvx fits ellipsoids. When real backends are ready, create `ApiModelProvider.js` implementing the same `generateMockResult` interface.

## Clinical Thresholds

| Metric | Abnormal Threshold | Notes |
|---|---|---|
| Evans Index | > 0.3 | Ratio of max frontal horn width to max inner skull width |
| Callosal Angle | < 90 degrees | Measured on coronal view at posterior commissure |
| Ventricle Volume | > 50 mL | Total segmented ventricle volume |
| NPH Score | 0-3 | Count of abnormal metrics above |

## Common Commands

```bash
npm install                     # Install dependencies
npx expo start                  # Start dev server (scan QR with Expo Go)
npx expo export --platform web  # Build for web (outputs to dist/)
npx expo start --web            # Start web dev server
```

## CI/CD

- `.github/workflows/deploy-web.yml` — Push to `main` triggers Expo web export and deploys to GitHub Pages
- `.github/workflows/build.yml` — Push to `main` triggers EAS Build for Android APK + iOS (requires `EXPO_TOKEN` secret)

## Rules

1. **NEVER** add network calls that transmit patient scan data — privacy is a core requirement
2. **NEVER** import native modules that break Expo managed workflow
3. **NEVER** "fix" the PNG encoder's store-only deflate (no compression) — it is intentionally uncompressed for speed
4. **DO NOT** pass large data through React Navigation params — use `ResultsStore.js`
5. **DO NOT** hardcode colors — use `src/theme.js` tokens
6. **DO NOT** use Canvas API for rendering — use the RGBA buffer + pure-JS PNG + `<Image>` pattern
7. `performance.now()` is available in Hermes runtime — safe to use for timing
8. Sample data (`assets/sample-data.json`) is 64x64 — full 256x256 volumes may be slow in debug mode
9. Adaptive morphological opening is intentionally skipped for spacing < 0.7mm or > 2.5mm
10. Sanity checks in `Pipeline.js` warn on extreme values — do not remove them
