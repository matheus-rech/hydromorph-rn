# HydroMorph

![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android%20%7C%20Web-blue)
![Expo SDK](https://img.shields.io/badge/Expo%20SDK-51-000020?logo=expo)
![Version](https://img.shields.io/badge/version-2.1.0-58a6ff)
![License](https://img.shields.io/badge/license-Research%20Only-d29922)

**Cross-platform hydrocephalus morphometrics app (iOS + Android + Web).**

HydroMorph processes NIfTI CT brain scans to compute clinically relevant hydrocephalus biomarkers -- Evans Index, Callosal Angle, Ventricle Volume, and NPH Probability scoring. The classical pipeline runs 100% on-device for maximum privacy. Version 2.1 adds cloud-based ML model inference via the unified [NeuroSeg server](https://huggingface.co/spaces/mmrech/medsam2-server), supporting multiple state-of-the-art segmentation models (MedSAM2, MCP-MedSAM, SAM-Med3D, SegResNet, nnU-Net) with privacy-preserving 2D slice transmission.

<!-- Screenshots: Upload screen (dark UI, file picker), Processing screen (9-step progress),
     Results screen (metric cards + slice viewer), Comparison view (2x2 grid with color-coded overlays) -->

---

## Features

- **9-Step Classical Pipeline** -- NIfTI parsing, brain masking, CSF extraction, morphological filtering, ventricle isolation, Evans Index, Callosal Angle, Volume computation, NPH scoring (100% on-device)
- **Multi-Model Comparison** -- Side-by-side comparison of Classical + up to 6 ML models via unified NeuroSeg server
- **Privacy-First Architecture** -- Full 3D volume never leaves device; only anonymized 2D PNG slices sent to cloud APIs
- **Cloud Mode Toggle** -- Switch between on-device demo and live ML inference with connection health checks
- **Sample NPH Cases** -- 3 pre-configured NPH CT scans from HF Datasets for testing
- **Clinical Metrics** -- Evans Index (threshold 0.3), Callosal Angle (threshold 90°), Ventricle Volume (threshold 50 mL), NPH probability scoring (LOW / MODERATE / HIGH)
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

Version 2.1 integrates with the unified [NeuroSeg server](https://huggingface.co/spaces/mmrech/medsam2-server) for real ML model inference:

| Model | Color | Type | Modality | Description |
|-------|-------|------|----------|-------------|
| **Classical (Proprietary)** | `#58a6ff` Blue | Local | CT | HU thresholding + morphological filtering pipeline |
| **MedSAM2** | `#3fb950` Green | API | CT/MR | Video-propagation ventricle segmentation |
| **MCP-MedSAM** | `#00d4d4` Cyan | API | CT | LLM-guided medical segmentation |
| **SAM-Med3D** | `#bc8cff` Purple | API | CT | 3D-aware medical image segmentation |
| **MedSAM-3D** | `#d29922` Yellow | API | CT | Full 3D volume segmentation |
| **SegResNet** | `#ff6e40` Orange | API | CT | MONAI automatic ventricle segmentation |
| **nnU-Net** | `#a371f7` Violet | API | CT | Self-configuring deep learning |
| **TractSeg** | `#f85149` Red | API | MR | White matter tract segmentation (MR only) |

### Cloud Mode Toggle

In the Upload screen, users can toggle between:
- **Demo Mode** (🔌): Uses `MockModelProvider` with simulated results, 100% offline
- **Cloud Mode** (☁️): Calls NeuroSeg server with real inference, sends anonymized 2D slices

The connection health is automatically tested when Cloud Mode is enabled.

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
   Classical Pipeline            ML Model Inference
   (9 real steps, local)        (NeuroSeg server)
          |                             |
          +--------+   +---------------+
                   |   |
              ResultsStore
                   |
          +--------+--------+
          |                 |
    Results Screen    Comparison View
   (single model)     (model grid + table)
```

### Data Flow (Privacy-Preserving)

```
┌─────────────────┐
│  Patient 3D CT  │ ◄── Full volume (HU) NEVER leaves device
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Find best axial │
│ ventricle slice │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Encode as PNG   │ ◄── Anonymized 2D slice only
│ (remove PHI)    │
└────────┬────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│  NeuroSeg Server (HuggingFace Spaces)      │
│  https://mmrech-medsam2-server.hf.space    │
└────────┬───────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  Binary Mask    │ ◄── Returned to device
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Recompute       │
│ Metrics Locally │ ◄── Evans Index, Callosal Angle, Volume
└─────────────────┘
```

**Key Privacy Guarantees:**
- Full 3D patient volume (HU data) never leaves the device
- Only anonymized 2D PNG slices transmitted to cloud APIs
- Binary masks can also be transmitted (no raw voxel values)
- All metric computation happens locally from returned masks

---

## Clinical Thresholds

| Metric | Threshold | Interpretation |
|--------|-----------|----------------|
| **Evans Index** | 0.3 | Ratio of maximum frontal horn width to maximum inner skull diameter. Values >= 0.3 suggest ventriculomegaly |
| **Callosal Angle** | 90° | Angle measured at the corpus callosum on coronal view. Values < 90° associated with NPH |
| **Ventricle Volume** | 50 mL | Total CSF ventricle volume. Values >= 50 mL suggest ventricular enlargement |
| **NPH Score** | 0-3 | Composite of above metrics. 0 = LOW, 1 = MODERATE, >= 2 = HIGH probability |

**Processing parameters:**
- Brain mask HU range: [-5, 80]
- CSF mask HU range: [0, 22]
- Adaptive morphological opening: skipped when voxel spacing < 0.7 mm or > 2.5 mm

---

## NeuroSeg Server Integration

### Server Details
- **Endpoint**: https://mmrech-medsam2-server.hf.space
- **Repository**: https://github.com/matheus-rech/neuroseg-server
- **MCP Server**: https://mmrech-medsam2-server.hf.space/gradio_api/mcp/sse

### Sample Data
3 NPH CT scans hosted on Hugging Face Datasets:
- `nph_case_01.nii.gz` — Typical NPH presentation
- `nph_case_02.nii.gz` — Moderate ventriculomegaly
- `nph_case_03.nii.gz` — Severe ventriculomegaly

### API Protocols
1. **Gradio Protocol** — Upload PNG → Call endpoint → Poll SSE for result
2. **Direct JSON API** — POST base64 data, receive JSON response

See [`docs/INTEGRATION_SUMMARY.md`](docs/INTEGRATION_SUMMARY.md) for full integration details.

---

## Project Structure

```
hydromorph-rn/
├── App.js                              # Entry point, Stack Navigator
├── src/
│   ├── models/
│   │   ├── ModelRegistry.js            # Model configs with NeuroSeg endpoints
│   │   ├── ApiModelProvider.js         # Cloud inference with privacy layer
│   │   ├── MockModelProvider.js        # Simulated results for demo mode
│   │   └── ResultsStore.js             # Aggregates results from all models
│   ├── api/
│   │   └── GradioClient.js             # HuggingFace Spaces Gradio protocol
│   ├── pipeline/
│   │   ├── NiftiReader.js              # NIfTI-1 parser
│   │   ├── Morphometrics.js            # 3D morphological ops, metrics
│   │   ├── Pipeline.js                 # 9-step orchestrator
│   │   └── SliceEncoder.js             # PNG encoding for API transmission
│   ├── screens/
│   │   ├── UploadScreen.js             # File picker, cloud toggle, sample loader
│   │   ├── ProcessingScreen.js         # Step progress indicators
│   │   └── ResultsScreen.js            # Metric cards, slice viewers, comparison
│   ├── components/
│   │   ├── ComparisonView.js           # Model comparison grid
│   │   ├── MetricCard.js               # Status-colored metric display
│   │   ├── MetricsComparisonTable.js   # Side-by-side metrics table
│   │   └── SliceViewer.js              # PNG renderer + SVG overlays
│   ├── config/
│   │   ├── apiConfig.js                # Cloud mode configuration
│   │   └── sampleDataConfig.js         # HF-hosted NPH sample definitions
│   ├── clinical/
│   │   ├── thresholds.js               # Clinical threshold values
│   │   └── scoring.js                  # NPH probability scoring
│   └── theme.js                        # GitHub-dark design tokens
├── assets/
│   ├── sample-data.json                # Bundled 64x64 CT demo
│   └── ...
├── docs/
│   ├── ARCHITECTURE.md                 # System architecture documentation
│   └── INTEGRATION_SUMMARY.md          # NeuroSeg integration guide
└── .github/workflows/
    ├── deploy-web.yml                  # Expo web → GitHub Pages
    └── build.yml                       # EAS Build → Android + iOS
```

---

## CI/CD

Two GitHub Actions workflows run on every push to `main`:

| Workflow | File | Output |
|----------|------|--------|
| **Web Deploy** | `deploy-web.yml` | Expo web export deployed to GitHub Pages |
| **Native Build** | `build.yml` | EAS Build producing Android APK + iOS simulator build |

The web deploy requires no secrets. Native builds require an `EXPO_TOKEN` secret.

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

- ✅ Real ML model integration (NeuroSeg server)
- 🔄 ONNX Runtime on-device inference
- 🔄 DICOM support
- 🔄 Export to PDF/CSV
- 🔄 Multi-language support

---

## References

- **NeuroSeg Server** -- Unified segmentation model server. [HF Space](https://huggingface.co/spaces/mmrech/medsam2-server) | [GitHub](https://github.com/matheus-rech/neuroseg-server)
- **CADS BrainCT-1mm** -- Sample data reference dataset. Licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **RadImageNet NPH Dataset** -- Normal Pressure Hydrocephalus CT scans. [HF Datasets](https://huggingface.co/datasets/radimagenet/normal-pressure-hydrocephalus)
- Evans, W.A. (1942). An encephalographic ratio for estimating ventricular enlargement and cerebral atrophy. *Archives of Neurology and Psychiatry*, 47(6), 931-937.
- Ishii, K. et al. (2008). Clinical impact of the callosal angle in the diagnosis of idiopathic normal pressure hydrocephalus. *European Radiology*, 18(11), 2678-2683.

---

## Author

**Matheus Machado Rech**

---

## License

**Research use only.** This application is intended for research and educational purposes. It is **not** validated for clinical diagnosis or medical decision-making. Always consult qualified medical professionals for clinical assessments.
