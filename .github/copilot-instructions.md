This is a React Native (Expo SDK 51) cross-platform hydrocephalus morphometrics application. It computes Evans Index, Callosal Angle, and Ventricle Volume from NIfTI head CT scans. The classical pipeline runs 100% on-device. ML models call remote HuggingFace Space endpoints but only send anonymized 2D slices or binary masks — the full 3D patient volume (HU data) never leaves the device. Please follow these guidelines when contributing:

## Code Standards

### Required Before Each Commit
- Validate the build with `npx expo export --platform web` (outputs to `dist/`)
- There is no test suite, linter, or formatter configured

### Development Flow
- Install: `npm install`
- Dev server: `npx expo start` (scan QR with Expo Go)
- Web dev: `npx expo start --web`
- Android: `npx expo start --android`
- iOS: `npx expo start --ios`
- Build: `npx expo export --platform web`

## Repository Structure
- `src/pipeline/` — Core processing pipeline (NIfTI parsing, morphometrics, slice encoding)
- `src/clinical/` — Clinical thresholds and NPH scoring logic
- `src/models/` — Model registry, API/mock providers, results store
- `src/api/` — Gradio protocol client for HuggingFace Spaces
- `src/config/` — API and cloud mode configuration
- `src/components/` — React Native UI components (SliceViewer, ComparisonView)
- `src/screens/` — App screens (Upload, Processing, Results)
- `src/utils/` — Utility modules (PngEncoder)
- `src/theme.js` — GitHub-dark design tokens (colors, spacing, typography, radius)
- `assets/` — Sample data, images, and fonts

### Key Files

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
| `src/components/SliceViewer.js` | CT slice renderer (pure-JS PNG encoder + SVG overlay) |
| `src/components/ComparisonView.js` | Multi-model comparison tab (2x2 grid + shared slider) |

## Key Guidelines

1. **NEVER** add network calls that transmit patient scan data (raw HU volumes) — privacy is a core requirement. Only anonymized 2D slices or binary masks may be sent to cloud APIs.
2. **NEVER** import native modules that break the Expo managed workflow
3. **NEVER** "fix" the PNG encoder's store-only deflate (no compression) — it is intentionally uncompressed for speed
4. **DO NOT** pass large data through React Navigation params — use `ResultsStore.js`
5. **DO NOT** hardcode colors — use `src/theme.js` tokens
6. **DO NOT** hardcode clinical thresholds — import helpers (`isEvansAbnormal()`, `isCallosalAbnormal()`, `isVolumeAbnormal()`) from `src/clinical/thresholds.js`
7. **DO NOT** duplicate NPH scoring logic — use `computeNphScore()` from `src/clinical/scoring.js`
8. **DO NOT** use Canvas API for rendering — use the RGBA buffer + pure-JS PNG + `<Image>` pattern
9. Every file starts with a `/** ... */` header comment containing description and `Author: Matheus Machado Rech`
10. Components use PascalCase filenames and `export default function ComponentName`
11. Pipeline/model functions use camelCase and named exports (`export function runPipeline`)
12. Styles use `StyleSheet.create()` at the bottom of each component file
13. Pipeline threshold changes (HU ranges, Evans/Callosal/Volume cutoffs) require clinical review
14. To add a new model, add an entry to `MODEL_CONFIGS` in `src/models/ModelRegistry.js`
