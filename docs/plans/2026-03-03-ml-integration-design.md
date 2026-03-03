# ML Integration Design — Phase 1 (Demo-Ready)

Date: 2026-03-03
Author: Matheus Machado Rech
Status: Draft

## Summary

Add real ML model integration infrastructure to HydroMorph with graceful
fallback to existing mocks. The app works identically in "Demo Mode" (mocks)
and is ready to connect to HuggingFace Inference API endpoints when available.

## Decisions (from brainstorming)

| Decision | Choice |
|----------|--------|
| ML approach | Hybrid: on-device (future) + remote API |
| On-device models | U-Net, YOLOvx (Phase 2 — requires Expo dev build + ONNX Runtime) |
| Remote API models | MedSAM2, SAM3 (via HuggingFace Inference API) |
| Model weights | Pre-trained public from HuggingFace |
| Privacy | Anonymized preprocessing (strip NIfTI headers) + opt-in consent |
| Fallback | Automatic — use mocks when API unavailable |

## Architecture

```
UploadScreen (Cloud toggle)
    ↓
ProcessingScreen → Pipeline.js
    ↓
runMultiModelPipeline()
    ├── classical → runPipeline() (unchanged)
    ├── medsam2  → ApiModelProvider.js → HF API (fallback: mock)
    ├── sam3     → ApiModelProvider.js → HF API (fallback: mock)
    ├── yolovx   → MockModelProvider.js (until on-device ready)
    └── (future) → LocalModelProvider.js (ONNX Runtime)
```

### ModelRegistry.js — Extended Config

Each model entry gains:

```js
{
  ...existing,
  provider: 'api' | 'mock' | 'local',  // how to run this model
  endpoint: 'https://...',              // HF Inference API URL (if provider=api)
  fallbackToMock: true,                 // auto-fallback when API fails
}
```

### ApiModelProvider.js — HTTP Client

- Takes model config + volume data
- Strips NIfTI headers client-side (anonymization)
- Sends POST with: voxel data (base64), shape, spacing
- Parses response: segmentation mask + metadata
- Falls back to MockModelProvider when endpoint unreachable
- Implements timeout (30s) and retry (1 retry)
- Returns same result shape as MockModelProvider

### apiConfig.js — Central Config

```js
{
  baseUrl: '',  // empty = demo mode (mocks only)
  timeout: 30000,
  retries: 1,
  cloudEnabled: false,  // user toggle
}
```

### Privacy

- NIfTI header fields (patient name, dates, institution) stripped client-side
- Only raw voxel data + shape + spacing sent to API
- Cloud toggle is opt-in, clearly labeled
- Privacy strip on UploadScreen updates dynamically

## What This Enables

1. **Demo today**: App works with mocks, shows multi-model comparison
2. **Connect later**: Set endpoint URLs in apiConfig, flip cloudEnabled
3. **On-device later**: Add ONNX Runtime in Phase 2 with Expo dev build

## Out of Scope (Phase 2+)

- On-device ONNX inference (requires native modules)
- Custom FastAPI backend
- Model training/fine-tuning
- HuggingFace Spaces setup
- Real-time WebSocket progress
