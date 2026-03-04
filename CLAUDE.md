# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cross-platform hydrocephalus morphometrics app. Computes Evans Index, Callosal Angle, and Ventricle Volume from NIfTI head CT scans. The classical pipeline runs 100% on-device. ML models call remote HuggingFace Space endpoints but only send anonymized 2D slices or binary masks — the full 3D patient volume (HU data) never leaves the device.

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
10-12. Run ML models (MedSAM2, SAM3, SegResNet) — cloud API or mock fallback
13. Compare results

### Cloud Mode & API Integration

ML models use a two-tier architecture: **cloud API first, mock fallback second**.

- `src/config/apiConfig.js` — Module-level config (`cloudEnabled`, `timeout`, `retries`). Cloud is enabled by default. UploadScreen provides a toggle.
- `src/api/GradioClient.js` — Gradio protocol client (upload → call → SSE poll) for HuggingFace Spaces.
- `src/models/ApiModelProvider.js` — Orchestrates remote inference. Two API protocols:
  - **Gradio path** (`.hf.space` endpoints): sends a single anonymized 2D PNG slice via `SliceEncoder`, receives segmentation overlay + optional 3D mask (`mask_b64`).
  - **JSON path**: sends the classical binary mask as base64, receives a refined mask.
- Results include `maskSource: 'model' | 'fallback'` to distinguish real API masks from `opening3D(classicalMask)` fallback.
- Models with `fallbackToMock: true` gracefully degrade to `MockModelProvider` when the API is unreachable or cloud mode is off.

**Privacy guarantee**: Only anonymized 2D PNG slices (Gradio path) or binary masks (JSON path) are transmitted. The full 3D HU volume never leaves the device.

### Rendering Pipeline (no Canvas API)

`Morphometrics.js` generates RGBA `Uint8ClampedArray` buffers via `generateAxialPixels()` / `generateCoronalPixels()`. These accept optional `overlayColor = { r, g, b }` for per-model coloring. `SliceViewer.js` encodes buffers to PNG base64 using a pure-JS encoder (`src/utils/PngEncoder.js`, intentionally uncompressed for speed), displayed via `<Image>`. SVG annotations (Evans lines, Callosal angle) are layered on top.

### Data Flow Between Screens

Large typed arrays (ventricle masks ~10MB each) are stored in `ResultsStore.js` (module-level singleton), NOT passed through React Navigation params (serialization limit ~1MB). Only a boolean flag is passed via navigation to signal data readiness.

## Key Files

| File | Purpose |
|---|---|
| `src/pipeline/Pipeline.js` | 9-step orchestrator + multi-model pipeline + sample/NIfTI loaders |
| `src/pipeline/Morphometrics.js` | 3D morphological ops, BFS, Evans, Callosal angle, pixel generation |
| `src/pipeline/NiftiReader.js` | NIfTI-1 parser (gzip via pako, endianness, 6 datatypes) |
| `src/pipeline/SliceEncoder.js` | Encodes axial slices to PNG for API upload; finds best ventricle slice |
| `src/clinical/thresholds.js` | Single source of truth for all clinical cutoffs + helper functions |
| `src/clinical/scoring.js` | Shared `computeNphScore()` used by Pipeline, MockModelProvider, ApiModelProvider |
| `src/config/apiConfig.js` | Cloud mode toggle, timeout, retry config |
| `src/api/GradioClient.js` | Gradio protocol client (upload, call, SSE poll, health check) |
| `src/models/ModelRegistry.js` | Central config for all segmentation models — add new models here |
| `src/models/ApiModelProvider.js` | Remote inference with Gradio/JSON protocols + mock fallback |
| `src/models/MockModelProvider.js` | Mock perturbation strategies (dilate, opening, ellipsoid) |
| `src/models/ResultsStore.js` | Module-level store for multi-model results |
| `src/utils/PngEncoder.js` | Pure-JS PNG encoder (store-only deflate, no native deps) |
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

Each model in `ModelRegistry.js` has: `{ id, name, shortName, color, colorRgb, description, isLocal, provider, endpoint, fallbackToMock }`.

| Model | ID | Color | Provider | Endpoint |
|---|---|---|---|---|
| Classical (Proprietary) | `classical` | blue `#58a6ff` | `local` | — |
| MedSAM2 | `medsam2` | green `#3fb950` | `api` | `''` (not deployed yet, falls back to mock) |
| NeuroSAM3 | `sam3` | purple `#bc8cff` | `api` | `https://mmrech-neurosam3.hf.space` |
| SegResNet (MONAI) | `yolovx` | orange `#ff6e40` | `api` | `''` (not deployed yet, falls back to mock) |

To add a new model: add an entry to `MODEL_CONFIGS` array in `ModelRegistry.js`. Set `provider: 'api'` with an `endpoint` URL for cloud inference, or `provider: 'local'` for on-device. Set `fallbackToMock: true` for graceful degradation.

Mock providers perturb the classical mask: MedSAM2 dilates (+5-15%), SAM3 opens (-5-10%), SegResNet fits ellipsoids.

## Clinical Thresholds

All clinical cutoffs are centralized in `src/clinical/thresholds.js`. **Never hardcode threshold values** — import `isEvansAbnormal()`, `isCallosalAbnormal()`, `isVolumeAbnormal()` from there. NPH scoring logic is in `src/clinical/scoring.js` via `computeNphScore()`.

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

1. **NEVER** add network calls that transmit patient scan data (raw HU volumes) — privacy is a core requirement. Only anonymized 2D slices or binary masks may be sent to cloud APIs.
2. **NEVER** import native modules that break Expo managed workflow
3. **NEVER** "fix" the PNG encoder's store-only deflate (no compression) — it is intentionally uncompressed for speed
4. **DO NOT** pass large data through React Navigation params — use `ResultsStore.js`
5. **DO NOT** hardcode colors — use `src/theme.js` tokens
6. **DO NOT** hardcode clinical thresholds — use `src/clinical/thresholds.js` helpers
7. **DO NOT** duplicate NPH scoring logic — use `computeNphScore()` from `src/clinical/scoring.js`
8. **DO NOT** use Canvas API for rendering — use the RGBA buffer + pure-JS PNG + `<Image>` pattern
9. `performance.now()` is available in Hermes runtime — safe to use for timing
10. Sample data (`assets/sample-data.json`) is 64x64 — full 256x256 volumes may be slow in debug mode
11. Adaptive morphological opening is intentionally skipped for spacing < 0.7mm or > 2.5mm
12. Sanity checks in `Pipeline.js` warn on extreme values — do not remove them
13. Pipeline threshold changes (HU ranges, Evans/Callosal/Volume cutoffs) require clinical review
