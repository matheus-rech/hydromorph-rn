# HydroMorph — GitHub Copilot Instructions

> These instructions help GitHub Copilot and other AI coding agents understand
> the HydroMorph project structure, conventions, and best practices when
> contributing to this repository.

## Project Overview

HydroMorph is a cross-platform (iOS, Android, Web) hydrocephalus morphometrics app built with React Native and Expo SDK 51. It processes NIfTI CT brain scans to compute clinically relevant hydrocephalus biomarkers: Evans Index, Callosal Angle, Ventricle Volume, and NPH Probability scoring.

**Key Architecture Principles:**
- **Privacy-First**: Classical pipeline runs 100% on-device. ML models only send anonymized 2D PNG slices to cloud APIs — the full 3D patient volume (HU data) never leaves the device.
- **Multi-Model Comparison**: Supports comparison between classical algorithm and multiple ML models via unified NeuroSeg server.
- **Zero Native Dependencies**: Pure JavaScript implementation using managed Expo workflow (no native modules that break Expo Go).

**Tech Stack:**
- React Native (Expo SDK 51)
- React Navigation v6
- react-native-svg for overlays
- pako for NIfTI gzip decompression
- GitHub-dark theme (`#0d1117`)

## Development Commands

```bash
npm install                     # Install dependencies
npx expo start                  # Start dev server (scan QR with Expo Go)
npx expo start --web            # Start web dev server
npx expo start --android        # Android emulator
npx expo start --ios            # iOS simulator
npx expo export --platform web  # Build for web (outputs to dist/)
```

**Note**: There is no test suite, linter, or formatter configured. Babel config uses `babel-preset-expo` + `react-native-reanimated/plugin`.

## Code Conventions

### File Structure
- **Header comment block**: Every file starts with `/** ... */` containing description and `Author: Matheus Machado Rech`
- **Components**: PascalCase filenames, `export default function ComponentName`
- **Pipeline/Model functions**: camelCase, named exports (`export function runPipeline`)
- **Styles**: Use `StyleSheet.create()` at the bottom of each component file

### Theme System
- **ALWAYS** import from `src/theme.js` — never hardcode colors, spacing, or typography values
- Primary background: `#0d1117` (GitHub dark)
- Accent colors come from model registry (blue, green, purple, orange, etc.)

### Clinical Thresholds
- **NEVER hardcode threshold values** — import helpers from `src/clinical/thresholds.js`
  - `isEvansAbnormal()` — Evans Index > 0.3
  - `isCallosalAbnormal()` — Callosal Angle < 90 degrees
  - `isVolumeAbnormal()` — Ventricle Volume > 50 mL
- NPH scoring logic lives in `src/clinical/scoring.js` via `computeNphScore()`

## Architecture Guidelines

### Navigation Flow
```
UploadScreen → ProcessingScreen → ResultsScreen
```
All screens use `headerShown: false`. ProcessingScreen disables gesture-back.

### Pipeline Architecture (9 classical + 4 model steps)
The pipeline runs synchronous JS on the main thread with `await delay()` yields for UI updates:

1. Parse NIfTI header
2. Build brain mask (HU -5 to 80, closing, largest component)
3. Extract CSF (HU 0 to 22 within brain)
4. Morphological filtering (adaptive opening, skip if spacing < 0.7 or > 2.5mm)
5. Isolate ventricles (central 60% crop, BFS components > 0.5mL)
6. Compute Evans Index
7. Compute Callosal Angle
8. Compute Volume
9. Generate report / NPH score
10-12. Run ML models (via NeuroSeg server or mock fallback)
13. Compare results

### Cloud API Integration
ML models use a **two-tier architecture**:
1. **Cloud API first**: Calls NeuroSeg server with anonymized 2D PNG slices
2. **Mock fallback**: Graceful degradation when API is unreachable or cloud mode is off

**Privacy Requirements** (CRITICAL):
- ✅ Send anonymized 2D PNG slices (via `SliceEncoder`)
- ✅ Send binary masks (no HU values)
- ❌ NEVER send full 3D patient volume (HU data) to network

### Rendering Pipeline (No Canvas API)
- `Morphometrics.js` generates RGBA `Uint8ClampedArray` buffers
- `SliceViewer.js` encodes buffers to PNG base64 using pure-JS encoder (`src/utils/PngEncoder.js`)
- **DO NOT "fix" the PNG encoder's store-only deflate** — it is intentionally uncompressed for speed
- Display via `<Image>` with SVG overlays for annotations

### Data Flow Between Screens
- Large typed arrays (~10MB ventricle masks) stored in `ResultsStore.js` (module-level singleton)
- **DO NOT** pass large data through React Navigation params (serialization limit ~1MB)
- Only pass boolean flags via navigation to signal data readiness

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/pipeline/Pipeline.js` | 9-step orchestrator + multi-model pipeline |
| `src/pipeline/Morphometrics.js` | 3D morphological ops, BFS, Evans, Callosal angle |
| `src/pipeline/NiftiReader.js` | NIfTI-1 parser (gzip, endianness, 6 datatypes) |
| `src/pipeline/SliceEncoder.js` | Encodes axial slices to PNG for API upload |
| `src/clinical/thresholds.js` | Single source of truth for clinical cutoffs |
| `src/clinical/scoring.js` | Shared `computeNphScore()` implementation |
| `src/config/apiConfig.js` | Cloud mode toggle, timeout, retry config |
| `src/api/GradioClient.js` | Gradio protocol client for HuggingFace Spaces |
| `src/models/ModelRegistry.js` | Central config for all segmentation models |
| `src/models/ApiModelProvider.js` | Remote inference with Gradio/JSON protocols |
| `src/models/MockModelProvider.js` | Mock perturbation strategies |
| `src/models/ResultsStore.js` | Module-level store for multi-model results |
| `src/utils/PngEncoder.js` | Pure-JS PNG encoder (store-only deflate) |
| `src/theme.js` | GitHub-dark design tokens |
| `src/components/SliceViewer.js` | CT slice renderer with SVG overlay |
| `src/components/ComparisonView.js` | Multi-model comparison 2x2 grid |

## Model System

Each model in `ModelRegistry.js` has: `{ id, name, shortName, color, colorRgb, description, isLocal, provider, endpoint, fallbackToMock }`.

**Current Models**  
The authoritative list of models (including IDs, colors, and endpoints) lives in `src/models/ModelRegistry.js`. As of this writing, the registered model IDs are:
- `classical`
- `sam3`
- `biomedparse`
- `segvol`
- `vista3d`
- `repmedsam`

**To add a new model:**
1. Add entry to `MODEL_CONFIGS` array in `ModelRegistry.js`
2. Set `provider: 'api'` with `endpoint` URL for cloud inference
3. Set `provider: 'local'` for on-device processing
4. Set `fallbackToMock: true` for graceful degradation

## Critical Rules

### Security & Privacy
1. **NEVER** add network calls that transmit patient scan data (raw HU volumes) — privacy is a core requirement
2. **ONLY** anonymized 2D PNG slices or binary masks may be sent to cloud APIs
3. **NEVER** commit secrets or API keys — use environment variables

### Code Quality
4. **NEVER** import native modules that break Expo managed workflow
5. **DO NOT** pass large data through React Navigation params — use `ResultsStore.js`
6. **DO NOT** hardcode colors — use `src/theme.js` tokens
7. **DO NOT** hardcode clinical thresholds — use `src/clinical/thresholds.js` helpers
8. **DO NOT** duplicate NPH scoring logic — use `computeNphScore()` from `src/clinical/scoring.js`

### Implementation Details
9. **DO NOT** use Canvas API for rendering — use RGBA buffer + pure-JS PNG + `<Image>` pattern
10. **DO NOT** "fix" PNG encoder's store-only deflate (no compression) — intentionally uncompressed for speed
11. `performance.now()` is available in Hermes runtime — safe to use for timing
12. Sample data (`assets/sample-data.json`) is 64x64 — full 256x256 volumes may be slow in debug mode
13. Adaptive morphological opening is intentionally skipped for spacing < 0.7mm or > 2.5mm
14. Sanity checks in `Pipeline.js` warn on extreme values — do not remove them

### Clinical Requirements
15. Pipeline threshold changes (HU ranges, Evans/Callosal/Volume cutoffs) require clinical review
16. All biomarkers must match validated reference ranges:
    - Brain mask: HU [-5, 80]
    - CSF mask: HU [0, 22]
    - Evans Index: > 0.3 abnormal
    - Callosal Angle: < 90° abnormal
    - Ventricle Volume: > 50 mL abnormal

## CI/CD

- `.github/workflows/deploy-web.yml` — Push to `main` triggers Expo web export and deploys to GitHub Pages
- `.github/workflows/build.yml` — Push to `main` triggers EAS Build for Android APK + iOS (requires `EXPO_TOKEN` secret)
- `.github/workflows/agentic.md` — GitHub Agentic Workflows config (issue triage, CI failure analysis, PR review)

## Common Tasks

### Adding a New ML Model
1. Add entry to `MODEL_CONFIGS` in `src/models/ModelRegistry.js`
2. Specify color, endpoint, provider type
3. Test with `fallbackToMock: true` first
4. Verify privacy — only 2D slices/masks transmitted

### Modifying Pipeline Thresholds
1. **STOP**: Clinical validation required
2. Update `src/clinical/thresholds.js` if changing cutoffs
3. Update `src/pipeline/Morphometrics.js` if changing HU ranges
4. Document rationale in PR description
5. Test with sample data before and after

### Debugging Rendering Issues
1. Check `src/utils/PngEncoder.js` — should produce valid PNG
2. Verify RGBA buffer dimensions match expected size
3. Check `SliceViewer.js` base64 encoding
4. Inspect SVG overlay coordinate system
5. Never switch to Canvas API — not available in React Native

### Fixing API Integration Issues
1. Test `GradioClient.js` health check first
2. Verify endpoint URLs in `ModelRegistry.js`
3. Check `SliceEncoder.js` produces valid PNG
4. Ensure `ApiModelProvider.js` handles errors gracefully
5. Verify mock fallback works when API unavailable

## Resources

- **Repository**: https://github.com/matheus-rech/hydromorph-rn
- **NeuroSeg Server**: https://huggingface.co/spaces/mmrech/medsam2-server
- **Sample Data**: Hosted on HuggingFace Datasets (NPH CT scans)
- **Documentation**: See `docs/ARCHITECTURE.md` and `docs/INTEGRATION_SUMMARY.md`
- **CLAUDE.md**: Comprehensive development guide (this file is the source of truth for all conventions)

## License

Research use only — not for clinical diagnosis. Always consult qualified medical professionals for clinical assessments.
