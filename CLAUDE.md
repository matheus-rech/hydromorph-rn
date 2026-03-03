# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cross-platform hydrocephalus morphometrics app. Computes Evans Index, Callosal Angle, and Ventricle Volume from NIfTI head CT scans. 100% on-device processing — no patient scan data ever leaves the device.

- **Stack**: React Native (Expo SDK 51), React Navigation v6, react-native-svg
- **Theme**: GitHub dark (`#0d1117` background)
- **Version**: 2.0.0
- **License**: Research use only — not for clinical diagnosis

## Commands

```bash
npm install                     # Install dependencies
npx expo start                  # Start dev server (scan QR with Expo Go)
npx expo start --web            # Start web dev server
npx expo start --android        # Android emulator
npx expo start --ios            # iOS simulator
npx expo export --platform web  # Build for web (outputs to dist/)
```

There is no test suite, linter, or formatter configured. Babel config uses `babel-preset-expo` + `react-native-reanimated/plugin`.

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

`Morphometrics.js` generates RGBA `Uint8ClampedArray` buffers via `generateAxialPixels()` / `generateCoronalPixels()`. These accept optional `overlayColor = { r, g, b }` for per-model coloring. `SliceViewer.js` encodes buffers to PNG base64 using a pure-JS encoder (intentionally uncompressed for speed), displayed via `<Image>`. SVG annotations (Evans lines, Callosal angle) are layered on top.

### Data Flow Between Screens

Large typed arrays (ventricle masks ~10MB each) are stored in `ResultsStore.js` (module-level singleton), NOT passed through React Navigation params (serialization limit ~1MB). Only a boolean flag is passed via navigation to signal data readiness.

## Key Files

| File | Purpose |
|---|---|
| `src/pipeline/Pipeline.js` | 9-step orchestrator + multi-model pipeline + sample/NIfTI loaders |
| `src/pipeline/Morphometrics.js` | 3D morphological ops, BFS, Evans, Callosal angle, pixel generation |
| `src/pipeline/NiftiReader.js` | NIfTI-1 parser (gzip via pako, endianness, 6 datatypes) |
| `src/models/ModelRegistry.js` | Central config for all segmentation models — add new models here |
| `src/models/MockModelProvider.js` | Mock perturbation strategies (dilate, opening, ellipsoid) |
| `src/models/ResultsStore.js` | Module-level store for multi-model results |
| `src/theme.js` | GitHub-dark design tokens (colors, spacing, typography, radius) |
| `src/components/SliceViewer.js` | CT slice renderer (pure-JS PNG encoder + SVG overlay) |
| `src/components/ComparisonView.js` | Multi-model comparison tab (2x2 grid + shared slider) |

## File Conventions

- **Header comment block**: Every file starts with `/** ... */` containing description and `Author: Matheus Machado Rech`
- **Components**: PascalCase filenames, `export default function ComponentName`
- **Pipeline/Model functions**: camelCase, named exports (`export function runPipeline`)
- **Theme**: Always import from `src/theme.js` — never hardcode colors, spacing, or typography values
- **Styles**: Use `StyleSheet.create()` at the bottom of each component file

## Model System

Each model entry in `ModelRegistry.js`: `{ id, name, shortName, color, colorRgb, description, isLocal }`.
Current models: `classical` (blue), `medsam2` (green), `sam3` (purple), `yolovx` (orange).
To add a new model, add an entry to `MODEL_CONFIGS` array.

Current mocks perturb the classical mask: MedSAM2 dilates (+5-15%), SAM3 opens (-5-10%), YOLOvx fits ellipsoids. When real backends are ready, create `ApiModelProvider.js` implementing the same `generateMockResult` interface.

## Clinical Thresholds

| Metric | Abnormal Threshold | Notes |
|---|---|---|
| Evans Index | > 0.3 | Ratio of max frontal horn width to max inner skull width |
| Callosal Angle | < 90 degrees | Measured on coronal view at posterior commissure |
| Ventricle Volume | > 50 mL | Total segmented ventricle volume |
| NPH Score | 0-3 | Count of abnormal metrics above |

## CI/CD

- `.github/workflows/deploy-web.yml` — Push to `main` triggers Expo web export and deploys to GitHub Pages
- `.github/workflows/build.yml` — Push to `main` triggers EAS Build for Android APK + iOS (requires `EXPO_TOKEN` secret)
- `.github/workflows/agentic.md` — GitHub Agentic Workflows config (issue triage, CI failure analysis, PR review)

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
11. Pipeline threshold changes (HU ranges, Evans/Callosal/Volume cutoffs) require clinical review
