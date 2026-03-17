# Benchmark and Model Overhaul Design

## Goal

Replace 9 models with 6 curated ones. Add a benchmark tab that compares segmentation quality and speed across models. Add an offline ONNX model for edge inference.

## The 6-Model Roster

| Model | Paradigm | Provider | Color | Status |
|---|---|---|---|---|
| Classical | HU threshold + morphology | `local` | blue `#58a6ff` | Keep |
| SAM3 (Meta) | Text-prompted mask generation | `api` | red `#f85149` | Promote from deprecated |
| BiomedParse (Microsoft) | Text-prompted foundation model | `api` | green `#3fb950` | New |
| SegVol (BAAI) | Native 3D volumetric | `api` | purple `#bc8cff` | New |
| VISTA3D (NVIDIA/MONAI) | Auto + interactive 3D | `api` | orange `#ff6e40` | New |
| Rep-MedSAM | Lightweight edge MedSAM (ONNX) | `local` | cyan `#00d4d4` | New |

**Removed**: medsam2, mcp_medsam, sam_med3d, medsam_3d, segresnet, tractseg, nnunet.

**Why these 6**: Each represents a distinct paradigm. Classical is deterministic and explainable. SAM3 and BiomedParse both use text prompts but differ architecturally. SegVol processes volumes natively in 3D. VISTA3D combines automatic and interactive segmentation. Rep-MedSAM runs on-device without network access.

## Benchmark Tab

A new tab on ResultsScreen, alongside Metrics and Comparison.

### Metrics

- **Dice coefficient**: each model's mask vs Classical as reference.
- **IoU**: secondary overlap metric.
- **Inference time**: wall-clock milliseconds from call start to mask received.
- **Volume delta**: percentage difference in ventricle volume vs Classical.

All masks already exist in `ResultsStore.js` after pipeline execution. The benchmark computes Dice and IoU by iterating voxel-by-voxel over stored `Uint8Array` masks. No extra inference is needed.

### UI

- **Top**: horizontal bar chart of Dice scores, sorted descending, color-coded per model.
- **Bottom**: scatter plot with inference time on X and Dice on Y. Each dot is a model. Top-left is ideal (fast and accurate).
- **Below**: summary table with all metrics.

## Offline ONNX Model (Rep-MedSAM)

Rep-MedSAM replaces MedSAM's ViT encoder with RepViT, a mobile-friendly CNN. It achieves near-MedSAM quality at sub-second inference on CPU.

### Integration

- Add `onnxruntime-react-native` (Expo-compatible).
- Bundle the ONNX model file (~25MB) in `assets/models/`.
- New `src/models/OnnxModelProvider.js` loads the model and runs inference on a single 2D slice.
- Input: 256x256 PNG slice + bounding box prompt derived from classical ventricle detection.
- Output: binary mask `Uint8Array`.
- Target: under 1 second on modern phones.
- Fully on-device. No network calls. Consistent with the app's privacy guarantee.

## API Endpoints

| Model | Space | Input | Output |
|---|---|---|---|
| SAM3 | `mmrech-neurosam3.hf.space` | Gradio: PNG + text prompt | overlay + mask_b64 |
| BiomedParse | `mmrech-biomedparse.hf.space` | Gradio: PNG + text "ventricles" | overlay + mask_b64 |
| SegVol | `mmrech-segvol.hf.space` | Gradio: PNG + text "lateral ventricles" | 3D mask_b64 |
| VISTA3D | `mmrech-vista3d.hf.space` | Gradio: PNG + auto mode | overlay + mask_b64 |

All use the existing `GradioClient.js` protocol: upload, call, SSE poll.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/models/ModelRegistry.js` | Rewrite | 6 model configs replacing 9 |
| `src/models/OnnxModelProvider.js` | New | ONNX Runtime inference for Rep-MedSAM |
| `src/models/ApiModelProvider.js` | Edit | Remove legacy paths, simplify |
| `src/models/MockModelProvider.js` | Edit | Update mock strategies for new models |
| `src/components/BenchmarkTab.js` | New | Dice bar chart + speed scatter + table |
| `src/utils/DiceCalculator.js` | New | Voxel-wise Dice and IoU computation |
| `src/screens/ResultsScreen.js` | Edit | Add Benchmark tab |
| `src/models/ResultsStore.js` | Edit | Store timing data per model |
| `package.json` | Edit | Add onnxruntime-react-native |

## Implementation Order (3 PRs)

### PR 1: Model Registry Cleanup + Benchmark UI

1. Rewrite `ModelRegistry.js` with 6 models.
2. Create `DiceCalculator.js` for voxel-wise overlap metrics.
3. Create `BenchmarkTab.js` with bar chart and scatter plot.
4. Wire BenchmarkTab into ResultsScreen.
5. Update `MockModelProvider.js` for new model fallbacks.

### PR 2: New API Models (BiomedParse, SegVol, VISTA3D)

1. Deploy 3 HuggingFace Spaces (server-side, outside this repo).
2. Update `ApiModelProvider.js` for new endpoints.
3. Promote SAM3 from deprecated to active.
4. Test with real API calls.

### PR 3: Offline ONNX Model (Rep-MedSAM)

1. Add `onnxruntime-react-native` dependency.
2. Bundle ONNX model weights in assets.
3. Create `OnnxModelProvider.js`.
4. Wire into `Pipeline.js` as a local provider.
