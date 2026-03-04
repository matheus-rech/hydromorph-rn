# Real ML Model Deployment Design (Revised)

**Date:** 2026-03-04
**Author:** Matheus Machado Rech
**Status:** Active

## Goal

Replace all mock ML model backends (MedSAM2, SAM3/NeuroSAM3, YOLOvx) with real segmentation models. Currently only SAM3 has a partial real integration (API call succeeds but the 3D mask is derived from `opening3D(classicalMask)`, not actual model output).

## Revised Approach

**No wholesale Gradio architecture redesign.** The app stays React Native. Research, training, and fine-tuning happen in Python notebooks (Google Colab). Once models are fine-tuned, they are deployed to HuggingFace Spaces and called via the existing `GradioClient.js` / `ApiModelProvider.js` infrastructure.

## Design Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | App framework | React Native (unchanged) |
| 2 | Deployment platform | HuggingFace Spaces with Gradio |
| 3 | GPU strategy | Mixed CPU/ZeroGPU (free tier) |
| 4 | SAM3 backend | NeuroSAM3 on ZeroGPU (already deployed) |
| 5 | MedSAM2 backend | MedSAM2 fine-tuned on ventricle data, ZeroGPU |
| 6 | YOLOvx backend | SegResNet (MONAI) on CPU (free tier) |
| 7 | Training pipeline | Python notebooks in Google Colab |
| 8 | Client-side API | Existing GradioClient.js + ApiModelProvider.js |

## Architecture

```
┌──────────────────────────────────────────────────┐
│  HydroMorph RN App (React Native, on-device)     │
│                                                  │
│  1. Classical pipeline runs on-device (JS)        │
│  2. Encode representative slice as PNG            │
│  3. Call HF Space API via GradioClient.js         │
│  4. Receive segmentation mask                     │
│  5. Compute all metrics locally                  │
│  6. Display results with React Native UI          │
└──────────┬──────────┬──────────┬─────────────────┘
           │          │          │
     ┌─────▼────┐ ┌───▼────┐ ┌──▼──────────┐
     │ MedSAM2  │ │ SAM3   │ │ SegResNet   │
     │ ZeroGPU  │ │ZeroGPU │ │ CPU (free)  │
     │ .hf.space│ │.hf.spc │ │ .hf.space   │
     └──────────┘ └────────┘ └─────────────┘
```

### Privacy

- Only anonymized 2D PNG slices (brain-windowed, no patient metadata) are sent
- The full 3D patient volume (HU data) NEVER leaves the device
- Metrics are computed entirely on-device from the returned masks

## Research & Training Pipeline (Python/Colab)

All model research and training happens in Jupyter notebooks, separate from the React Native app:

| Notebook | Purpose | Status |
|----------|---------|--------|
| `medsam2_ventricle_inference.ipynb` | MedSAM2 inference on brain CT | Done |
| `medsam2_ventricle_finetuning.ipynb` | Fine-tune MedSAM2 for ventricles | In progress |
| `yolo_ventricle_data_prep.ipynb` | YOLO training data preparation | Done |
| `monai_brain_segmentation.ipynb` | MONAI model survey & benchmarks | Done |

### MedSAM2 Key Findings

- **Architecture**: Treats 3D volumes as "video" — each axial slice is a frame
- **Prompting**: Bounding box on one key slice → propagates forward + backward
- **Predictor**: `build_sam2_video_predictor_npz` for numpy array input (CT NIfTI)
- **Checkpoint**: `MedSAM2_2411.pt` (~150MB), Efficient variant (~72MB, CPU-capable)
- **Training data**: NPZ format with keys: `imgs` (Z,Y,X) [0,255], `gts` (Z,Y,X), `spacing` (3,)
- **Fine-tuning**: Freeze image encoder, train mask decoder + prompt encoder only
- **License**: Apache 2.0 (code), research/education only (weights) — matches our license

### MONAI Survey Results

| Model | Parameters | Size (MB) | CPU Feasible | Best For |
|-------|-----------|-----------|-------------|----------|
| SwinUNETR-Tiny | ~15M | ~57 | Yes (slow) | Accuracy |
| **SegResNet** | **~5M** | **~20** | **Yes (fast)** | **Deployment** |
| UNETR | ~93M | ~350 | No | Research only |
| UNet-3D | ~3M | ~12 | Yes | Baseline |

**Recommendation**: SegResNet for the YOLOvx slot — smallest, fastest on CPU, proven on brain segmentation (BraTS pre-training), runs on free HF CPU Spaces.

### YOLO Training Data

- 5 classes: ventricle(0), sylvian_fissure(1), tight_convexity(2), pvh(3), skull_inner(4)
- CT-safe augmentations: `fliplr=0.0`, `mosaic=0.0`, `mixup=0.0`, `hsv_h=0.0`, `hsv_s=0.0`
- Auto-labeled: ventricle (from masks) and skull_inner (from bone thresholding)
- Manual annotation needed: sylvian_fissure, tight_convexity, pvh

## HF Space Backends

### MedSAM2 Space (`mmrech-medsam2.hf.space`)

- **Model**: MedSAM2 fine-tuned on ventricle data
- **Hardware**: ZeroGPU (free, cold start ~30s)
- **Inference**: Bounding box prompt from classical pipeline → propagate through volume
- **Status**: Existing Space has a bug (`mcp_server=True` in Gradio 3.38.0) — easy fix

### NeuroSAM3 Space (`mmrech-neurosam3.hf.space`)

- **Model**: Already deployed with `process_with_status` endpoint
- **Hardware**: ZeroGPU (already configured)
- **Status**: Partially working — API calls succeed but mask is derived from classical pipeline

### SegResNet Space (`mmrech-segresnet-ventricle.hf.space`)

- **Model**: MONAI SegResNet (~20MB), fine-tuned on ventricle data
- **Hardware**: CPU (free tier) — no cold start, no GPU quota
- **Inference**: Fully automatic (no prompting needed)
- **Status**: Not yet created — pending fine-tuning

## ModelRegistry.js Changes (when ready)

```javascript
{
  id: 'medsam2',
  provider: 'api',
  endpoint: 'https://mmrech-medsam2.hf.space',  // was ''
  fallbackToMock: true,
},
{
  id: 'sam3',
  provider: 'api',
  endpoint: 'https://mmrech-neurosam3.hf.space', // unchanged
  fallbackToMock: true,
},
{
  id: 'yolovx',
  provider: 'api',                                // was 'mock'
  endpoint: 'https://mmrech-segresnet-ventricle.hf.space',
  fallbackToMock: true,                            // was false
},
```

## Implementation Phases

### Phase 1: Research & Training (current)
- Study MedSAM2 architecture and inference flow
- Survey MONAI models for brain segmentation
- Prepare YOLO training data pipeline
- Fine-tune MedSAM2 on ventricle-labeled CT data
- Generate real sample images for the app

### Phase 2: Deploy Models to HF Spaces
- Fix existing `mmrech-medsam2.hf.space` (remove `mcp_server=True` bug)
- Deploy fine-tuned MedSAM2 checkpoint
- Create `mmrech-segresnet-ventricle.hf.space` with SegResNet
- Update NeuroSAM3 Space to return actual model masks (not `opening3D` workaround)

### Phase 3: React Native Integration
- Update `ModelRegistry.js` endpoints
- Update `ApiModelProvider.js` to use real returned masks instead of `opening3D(classicalMask)`
- Remove mock fallback workarounds where real backends are stable
- End-to-end testing

Each phase keeps `fallbackToMock: true` so the app remains functional when Spaces are down.

## NPHProject_backup Assessment

Examined `/Users/matheusrech/MEGA/NPHProject_backup/` — previous Python-based version.

**Useful resources:**
- `hydrocephalus_pipeline.py` — Python Evans Index + Callosal Angle implementations (reference)
- `training/` scripts — YOLO training pipeline with CT-safe augmentation constraints
- `api.py` patterns — FastAPI file handling, NIfTI processing reference

**Not directly usable:**
- `best.pt` — Only 39 labeled images from 1 volume, only ventricle class works
- YOLO outputs bounding boxes (not segmentation masks) — reinforces SegResNet choice

## Deployment Cost

| Model | Space Type | Monthly Cost |
|-------|-----------|-------------|
| SegResNet (MONAI) | CPU Basic | $0 (free) |
| MedSAM2 Fine-tuned | ZeroGPU | $0 (quota)* |
| MedSAM2 Efficient | CPU Basic | $0 (free) |
| NeuroSAM3 | ZeroGPU | $0 (quota)* |

\* ZeroGPU has ~300s/day GPU quota on free tier. $9/month for higher quota if needed.

## Error Handling

- API timeout → fall back to mock (existing `fallbackToMock` behavior)
- Space sleeping → show "waking up model..." status, retry after cold start
- All API failures gracefully degrade to mock results
