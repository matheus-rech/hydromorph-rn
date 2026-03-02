# HydroMorph

![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android%20%7C%20Web-blue)
![Expo SDK](https://img.shields.io/badge/Expo%20SDK-51-000020?logo=expo)
![Version](https://img.shields.io/badge/version-2.0.0-58a6ff)
![License](https://img.shields.io/badge/license-Research%20Only-d29922)

**Cross-platform hydrocephalus morphometrics app (iOS + Android + Web).**

HydroMorph processes NIfTI CT brain scans entirely on-device to compute clinically relevant hydrocephalus biomarkers -- Evans Index, Callosal Angle, Ventricle Volume, and NPH Probability scoring. Version 2.0 introduces multi-model comparison, placing four segmentation approaches side by side in a synchronized 2x2 grid. No data ever leaves the device.

<!-- Screenshots: Upload screen (dark UI, file picker), Processing screen (9-step progress),
     Results screen (metric cards + slice viewer), Comparison view (2x2 grid with color-coded overlays) -->

---

## Features

- **9-Step Classical Pipeline** -- NIfTI parsing, brain masking, CSF extraction, morphological filtering, ventricle isolation, Evans Index, Callosal Angle, Volume computation, NPH scoring
- **Multi-Model Comparison** -- Side-by-side 2x2 grid comparing Classical, MedSAM2, SAM3, and YOLOvx segmentations with synchronized slice navigation, shared slider, metrics comparison table, and bounding box overlays
- **100% On-Device Privacy** -- All processing runs locally; zero network calls, zero data exfiltration
- **Clinical Metrics** -- Evans Index (threshold 0.3), Callosal Angle (threshold 90 degrees), Ventricle Volume (threshold 50 mL), NPH probability scoring (LOW / MODERATE / HIGH)
- **NIfTI-1 Support** -- Gzip decompression (via pako), endianness handling, 6 data types
- **GitHub-Dark UI** -- Purpose-built dark theme (`#0d1117`) with status-colored metric cards
- **Cross-Platform** -- Single codebase targeting iOS, Android, and Web via Expo

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/<your-username>/hydromorph-rn.git
cd hydromorph-rn
npm install

# Start development server
npx expo start

# Scan the QR code with Expo Go on your phone,
# or press 'w' for web, 'a' for Android emulator, 'i' for iOS simulator
```

A bundled 64x64 CT demo (`assets/sample-data.json`, ~430 KB) is included so you can test immediately without a real NIfTI file.

---

## Deploy Options

### Option A: Web App via GitHub Pages (easiest)

1. Push to a GitHub repository on `main`
2. Go to **Settings > Pages > Source: GitHub Actions**
3. The `deploy-web.yml` workflow runs automatically
4. Live at `https://<username>.github.io/<repo-name>/` in ~2 minutes

### Option B: Native Builds via Expo EAS

1. Create an [Expo account](https://expo.dev/signup) and generate an access token
2. In your GitHub repo: **Settings > Secrets > Actions** -- add `EXPO_TOKEN`
3. Push to `main` -- the `build.yml` workflow builds Android APK + iOS simulator build
4. Download artifacts from [expo.dev](https://expo.dev) builds dashboard

### Option C: Local Development

```bash
npx expo start            # Development server
npx expo start --web      # Web only
npx expo start --android  # Android emulator
npx expo start --ios      # iOS simulator
```

---

## Multi-Model Comparison

Version 2.0 introduces a model comparison framework. Four segmentation approaches run on the same scan and display results in a synchronized 2x2 grid:

| Model | Color | Status | Description |
|-------|-------|--------|-------------|
| **Classical (Proprietary)** | `#58a6ff` Blue | Active | HU thresholding + morphological filtering pipeline |
| **MedSAM2** | `#3fb950` Green | Mock | Medical Segment Anything Model 2 -- slight over-segmentation |
| **SAM3** | `#bc8cff` Purple | Mock | Segment Anything Model 3 -- conservative, smoother boundaries |
| **YOLOvx** | `#ff6e40` Orange | Mock | YOLO-based volumetric segmentation -- fast, blobby output |

The Classical pipeline is fully implemented with real on-device processing. The three ML models currently use mock providers (`MockModelProvider.js`) that generate synthetic segmentation masks with model-characteristic patterns (over-segmentation, smooth boundaries, blobby output).

**Migration path:** When real model backends become available, replace the mock provider with actual inference calls. The `ModelRegistry.js` config supports `isLocal` flags and can be extended with endpoint/provider fields. The comparison UI, metrics table, and color scheme are model-agnostic and require no changes.

---

## Architecture

```
                        Upload Screen
                             |
                     NIfTI file or sample data
                             |
                      Processing Screen
                             |
              +--------------+--------------+
              |                             |
       Classical Pipeline            ML Model Mocks
       (9 real steps)              (MedSAM2, SAM3, YOLOvx)
              |                             |
              +--------+   +---------------+
                       |   |
                  ResultsStore
                       |
              +--------+--------+
              |                 |
        Results Screen    Comparison View
       (single model)     (2x2 grid + table)
```

**Data flow:**

1. **Upload** -- User picks a `.nii` / `.nii.gz` file or loads bundled sample data
2. **Parse** -- `NiftiReader.js` decompresses (pako), reads header, extracts voxel data
3. **Pipeline** -- `Pipeline.js` orchestrates 9 steps through `Morphometrics.js` (brain mask, CSF, closing/opening, BFS component analysis, Evans Index, Callosal Angle, volume)
4. **Mock Models** -- `MockModelProvider.js` generates synthetic masks for the 3 ML models with characteristic distortions
5. **Results** -- `ResultsStore.js` aggregates all model outputs; `ResultsScreen.js` renders metric cards + slice viewer; `ComparisonView.js` renders the 2x2 comparison grid

---

## Clinical Thresholds

| Metric | Threshold | Interpretation |
|--------|-----------|----------------|
| **Evans Index** | 0.3 | Ratio of maximum frontal horn width to maximum inner skull diameter. Values >= 0.3 suggest ventriculomegaly |
| **Callosal Angle** | 90 degrees | Angle measured at the corpus callosum on coronal view. Values < 90 degrees associated with NPH |
| **Ventricle Volume** | 50 mL | Total CSF ventricle volume. Values >= 50 mL suggest ventricular enlargement |
| **NPH Score** | 0-3 | Composite of above metrics. 0 = LOW, 1 = MODERATE, >= 2 = HIGH probability |

**Processing parameters:**
- Brain mask HU range: [-5, 80]
- CSF mask HU range: [0, 22]
- Adaptive morphological opening: skipped when voxel spacing < 0.7 mm or > 2.5 mm

---

## Project Structure

```
hydromorph-rn/
├── App.js                              # Entry point, Stack Navigator (Upload > Processing > Results)
├── src/
│   ├── models/
│   │   ├── ModelRegistry.js            # Model configs: id, name, color, description, isLocal
│   │   ├── MockModelProvider.js        # Synthetic mask generator for ML models
│   │   └── ResultsStore.js             # Aggregates results from all models
│   ├── pipeline/
│   │   ├── NiftiReader.js              # NIfTI-1 parser (gzip via pako, endianness, 6 datatypes)
│   │   ├── Morphometrics.js            # 3D morphological ops, BFS components, Evans, callosal angle
│   │   └── Pipeline.js                 # 9-step orchestrator + multi-model coordination
│   ├── screens/
│   │   ├── UploadScreen.js             # File picker + sample data loader
│   │   ├── ProcessingScreen.js         # Step progress indicators + metadata display
│   │   └── ResultsScreen.js            # Metric cards, slice viewers, comparison toggle
│   ├── components/
│   │   ├── ComparisonView.js           # 2x2 grid layout with shared slider
│   │   ├── MetricCard.js               # Status-colored metric display card
│   │   ├── MetricsComparisonTable.js   # Side-by-side metrics for all models
│   │   ├── ModelSliceCard.js           # Single model tile in comparison grid
│   │   ├── NPHBadge.js                # LOW / MODERATE / HIGH probability badge
│   │   ├── ProgressSteps.js            # Animated step indicators
│   │   └── SliceViewer.js              # PNG renderer + SVG overlays + bounding boxes
│   └── theme.js                        # GitHub-dark design tokens (colors, spacing, typography)
├── assets/
│   ├── sample-data.json                # Bundled 64x64 CT demo (~430 KB)
│   ├── icon.png                        # App icon
│   ├── adaptive-icon.png               # Android adaptive icon
│   ├── splash.png                      # Splash screen
│   └── favicon.png                     # Web favicon
├── app.json                            # Expo configuration
├── eas.json                            # EAS Build profiles (preview + production)
├── babel.config.js                     # Babel configuration
├── package.json                        # Dependencies and scripts
└── .github/workflows/
    ├── deploy-web.yml                  # Expo web export -> GitHub Pages
    ├── build.yml                       # EAS Build -> Android APK + iOS
    └── agentic.md                      # GitHub Agentic Workflows (issue triage, CI, PR review)
```

---

## CI/CD

Two GitHub Actions workflows run on every push to `main`:

| Workflow | File | Output |
|----------|------|--------|
| **Web Deploy** | `deploy-web.yml` | Expo web export deployed to GitHub Pages |
| **Native Build** | `build.yml` | EAS Build producing Android APK + iOS simulator build |

The web deploy requires no secrets. Native builds require an `EXPO_TOKEN` secret -- without it, only the web deploy runs (sufficient for conference demos and browser-based access).

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `expo` | ~51.0.0 | Framework and build tooling |
| `react` / `react-native` | 18.2.0 / 0.74.1 | UI runtime |
| `@react-navigation/native` + `stack` | ^6.x | Screen navigation |
| `pako` | ^2.1.0 | Gzip decompression for NIfTI files |
| `expo-document-picker` | ~12.0.2 | Native file selection |
| `expo-file-system` | ~17.0.1 | File I/O |
| `react-native-svg` | 15.2.0 | SVG overlays on slice viewers |
| `@react-native-community/slider` | 4.5.3 | Slice navigation slider |
| `react-native-reanimated` | ~3.10.1 | Smooth animations |

---

## Roadmap

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the full development roadmap, including:

- Real ML model integration (MedSAM2, SAM3, YOLOvx backends)
- ONNX Runtime on-device inference
- DICOM support
- Export to PDF/CSV
- Multi-language support

---

## References

- **CADS BrainCT-1mm** -- Sample data reference dataset. Licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Evans, W.A. (1942). An encephalographic ratio for estimating ventricular enlargement and cerebral atrophy. *Archives of Neurology and Psychiatry*, 47(6), 931-937.
- Ishii, K. et al. (2008). Clinical impact of the callosal angle in the diagnosis of idiopathic normal pressure hydrocephalus. *European Radiology*, 18(11), 2678-2683.

---

## Author

**Matheus Machado Rech**

---

## License

**Research use only.** This application is intended for research and educational purposes. It is **not** validated for clinical diagnosis or medical decision-making. Always consult qualified medical professionals for clinical assessments.
