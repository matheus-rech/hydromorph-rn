# HydroMorph Multi-Model Segmentation — Production Roadmap

> Last updated: 2026-03-02
> Author: Matheus Machado Rech

---

## 1. Current State

### What is implemented and working

The multi-model segmentation comparison feature ships with four models arranged in a 2x2 grid, each with a distinct color overlay and per-model metrics. The full file inventory:

| File | Role |
|------|------|
| `src/models/ModelRegistry.js` | Model configuration map (id, name, color, colorRgb, isLocal flag) |
| `src/models/MockModelProvider.js` | Perturbation engine: dilate, opening, ellipsoidal approximation |
| `src/models/ResultsStore.js` | Module-level store to avoid serializing ~10 MB typed arrays through React Navigation params |
| `src/components/ModelSliceCard.js` | Compact slice viewer with pure-JS PNG encoder + SVG bounding box overlay |
| `src/components/MetricsComparisonTable.js` | Cross-model table (Evans Index, Callosal Angle, Volume, NPH Score, Time) with threshold highlighting |
| `src/components/ComparisonView.js` | 2x2 grid layout, shared debounced slice slider, bounding box summary |
| `src/pipeline/Pipeline.js` | 13-step orchestrator (`MULTI_MODEL_STEPS`) running classical pipeline then sequential mock generation |

### What is real vs. mocked

| Model | Status | Output Source |
|-------|--------|---------------|
| **Classical (Proprietary)** | REAL | HU thresholding [-5,80] + morphological closing/opening + connected components + central crop |
| **MedSAM2** | MOCK | `dilate3D(classicalMask, shape, 1)` — adds ~5-15% boundary voxels |
| **SAM3** | MOCK | `opening3D(classicalMask, shape, 1)` — removes protrusions, reduces volume ~5-10% |
| **YOLOvx** | MOCK | Per-component axis-aligned ellipsoidal fit (centroid + 0.85x semi-axes) — blobby, detection-style |

All mock outputs recompute real metrics (`computeEvansIndex`, `computeCallosalAngle`, volume) from the perturbed mask, so the comparison table shows plausible cross-model disagreement. Bounding box confidence values are random in `[0.75, 0.95]`.

---

## 2. Why Mocks?

The three ML models are mocked because none of them can run natively in React Native's JavaScript runtime. This is a deliberate architectural decision, not a shortcut.

### Technical constraints

1. **No GPU compute in JS runtime.** React Native (Hermes/JSC) has no access to Metal (iOS) or Vulkan/OpenGL ES (Android) compute shaders. MedSAM2 and SAM3 require matrix multiplication throughput that is 100-1000x slower on CPU-only JS.

2. **Model weight sizes are prohibitive for mobile bundles.**
   - MedSAM2: ~300 MB (ViT-H image encoder + mask decoder)
   - SAM3: ~600 MB+ (multi-scale encoder, heavier decoder)
   - YOLOvx: ~150 MB (volumetric backbone + detection heads)
   - Expo OTA update limit: 50 MB. EAS binary builds still suffer from 1+ GB APK/IPA sizes.

3. **Runtime dependencies are unavailable.** These models require PyTorch, ONNX Runtime, or TensorFlow C++ runtimes. Expo does not bundle these, and bridging them requires native modules that break Expo Go compatibility.

4. **3D volumetric inference is not batch-of-2D.** MedSAM2 and SAM3 operate on 3D volumes (or sliding-window 3D patches), not independent 2D slices. This means the entire volume must reside in GPU VRAM during inference — typically 4-12 GB.

### Strategy Pattern architecture

The mock system was designed as a **provider swap**. `MockModelProvider.js` and a future `ApiModelProvider.js` both implement the same interface:

```
(modelId, volumeData, classicalMask, shape, spacing) → ModelResult
```

Where `ModelResult` contains:
```
{ modelId, ventMask, evansIndex, callosalAngle, ventVolMl, nphScore,
  boundingBoxes, processingTime, colorRgb, ... }
```

The UI components (`ComparisonView`, `ModelSliceCard`, `MetricsComparisonTable`) consume `ModelResult` objects and have **zero knowledge** of whether the mask came from a mock perturbation or a real inference API. Swapping providers requires changing one import in `Pipeline.js`.

---

## 3. Phase 1: API Backend Integration

Goal: Stand up a GPU inference server and create a provider that calls it from the app.

### 3.1 GPU Inference Server

- [ ] Set up a FastAPI server with PyTorch + CUDA support
- [ ] Create a `/segment` endpoint accepting:
  ```json
  {
    "model_id": "medsam2",
    "volume_b64_gzip": "<base64-encoded gzip of Float32Array>",
    "shape": [64, 64, 64],
    "spacing": [3.4, 3.4, 3.4],
    "classical_mask_b64_gzip": "<optional, for prompt-based models>"
  }
  ```
- [ ] Return segmentation mask + bounding boxes + confidence scores:
  ```json
  {
    "mask_b64_gzip": "<base64-encoded gzip of Uint8Array>",
    "bounding_boxes": [...],
    "inference_time_ms": 1200,
    "model_version": "medsam2-v1.0"
  }
  ```
- [ ] Add health check endpoint (`GET /health`) returning GPU memory status and loaded models
- [ ] Dockerize with `nvidia/cuda:12.x-cudnn9-runtime-ubuntu22.04` base image
- [ ] Deploy behind HTTPS with TLS termination (nginx or Caddy reverse proxy)
- [ ] Add API key authentication (Bearer token in `Authorization` header)

### 3.2 ApiModelProvider.js (client-side)

- [ ] Create `src/models/ApiModelProvider.js` implementing the same interface as `MockModelProvider.js`:
  ```js
  export async function generateApiResult(modelId, volumeData, classicalMask, shape, spacing) {
    // 1. Gzip compress volumeData (Float32Array → pako.deflate → base64)
    // 2. POST to /segment with model_id
    // 3. Decode response mask (base64 → pako.inflate → Uint8Array)
    // 4. Recompute metrics client-side (Evans, callosal angle, volume)
    // 5. Return ModelResult
  }
  ```
- [ ] Add timeout handling (30s default, configurable per model)
- [ ] Add retry logic with exponential backoff (max 3 retries)
- [ ] Handle network errors gracefully — fall back to mock with a warning badge
- [ ] Add upload progress tracking via `XMLHttpRequest` (fetch does not support upload progress)

### 3.3 Pipeline Integration

- [ ] Add a `USE_API_BACKEND` config flag (environment variable or settings screen)
- [ ] Modify `runMultiModelPipeline()` in `Pipeline.js` to branch:
  ```js
  const provider = USE_API_BACKEND ? generateApiResult : generateMockResult;
  ```
- [ ] Run all 3 ML models in parallel via `Promise.all()` instead of sequential:
  ```js
  const mlResults = await Promise.all(
    mlModelIds.map(id => provider(id, data, ventMask, shape, spacing))
  );
  ```
- [ ] Update `MULTI_MODEL_STEPS` progress reporting to handle parallel execution (show a combined "Running ML models..." step or individual concurrent indicators)

### 3.4 Data Transfer Optimization

- [ ] Compress volumes client-side before upload (pako gzip level 6 — balances speed vs. size)
- [ ] For 64x64x64 Float32 volumes: raw = 1 MB, gzipped ~ 200-400 KB
- [ ] For 256x256x128 Float32 volumes: raw = 32 MB, gzipped ~ 8-15 MB — consider chunked upload
- [ ] Implement server-side mask compression (Uint8 masks compress extremely well, ~95% ratio)
- [ ] Add ETag/If-None-Match caching for repeated analyses of the same volume

---

## 4. Phase 2: Model-Specific Integration

Goal: Get each ML model running on the backend with optimized inference.

### 4.1 MedSAM2 Backend

- [ ] Download MedSAM2 weights from the official repository
- [ ] Implement 3D sliding-window inference (patch size 128x128x128, overlap 0.5)
- [ ] Use the classical mask centroid as a prompt point (MedSAM2 is prompt-based)
- [ ] Test on CT head scans with known ventricle volumes
- [ ] Expected inference time: 2-5s on A100, 8-15s on RTX 3090
- [ ] Expected output characteristics: slight over-segmentation at CSF/parenchyma boundary, smooth contours

### 4.2 SAM3 Backend

- [ ] Download SAM3 weights (check for official 3D medical variant)
- [ ] Implement multi-scale encoder pipeline (SAM3 uses hierarchical features)
- [ ] Evaluate whether automatic mode or prompt mode produces better ventricle segmentation
- [ ] Expected inference time: 5-10s on A100
- [ ] Expected output characteristics: conservative boundaries, smoother than MedSAM2, fewer false positives

### 4.3 YOLOvx Backend

- [ ] Implement or adapt a YOLO-based 3D detection model for ventricle localization
- [ ] Two-stage approach: (1) detect ventricle bounding box, (2) segment within box
- [ ] Output real confidence scores per detected region (replace random mock values)
- [ ] Expected inference time: 0.5-2s on A100 (YOLO is optimized for speed)
- [ ] Expected output characteristics: blobby boundaries, fast, good for screening

### 4.4 ONNX Optimization (all models)

- [ ] Convert PyTorch checkpoints to ONNX format (`torch.onnx.export`)
- [ ] Run ONNX graph optimization passes (constant folding, operator fusion)
- [ ] Benchmark ONNX Runtime vs. native PyTorch inference (typically 1.5-3x speedup)
- [ ] Test TensorRT optimization for NVIDIA GPUs (additional 2-5x for supported ops)
- [ ] Profile GPU memory usage per model and determine if multiple models can coexist in VRAM

### 4.5 Batched / Queued Inference

- [ ] Implement a job queue (Redis + Celery or equivalent) for inference requests
- [ ] Support concurrent requests from multiple app instances
- [ ] Add model warm-up on server start (pre-load weights into GPU memory)
- [ ] Implement model multiplexing: load/unload models based on request patterns if VRAM is limited
- [ ] Add request deduplication (same volume hash = cached result)

---

## 5. Phase 3: Advanced Comparison Features

Goal: Move beyond visual comparison to quantitative agreement analysis.

### 5.1 Overlap Metrics

- [ ] Implement Dice Similarity Coefficient (DSC) between each model pair:
  ```
  DSC(A, B) = 2|A ∩ B| / (|A| + |B|)
  ```
- [ ] Implement Jaccard Index (IoU):
  ```
  IoU(A, B) = |A ∩ B| / |A ∪ B|
  ```
- [ ] Implement Hausdorff Distance (95th percentile) for boundary agreement
- [ ] Compute a 4x4 agreement matrix and display as a heatmap component
- [ ] Add per-slice DSC plot (line chart, one color per model pair)

### 5.2 Difference Maps

- [ ] Create `DifferenceMapViewer.js` component showing voxel-level disagreement
- [ ] Color coding:
  - Green: all models agree (intersection)
  - Yellow: 3 of 4 models agree
  - Orange: 2 of 4 models agree
  - Red: only 1 model segments this voxel
- [ ] Overlay difference map on the axial slice viewer
- [ ] Add toggle to switch between individual model overlays and consensus/difference view

### 5.3 Statistical Agreement Analysis

- [ ] Compute Bland-Altman statistics for volume measurements (mean difference, limits of agreement)
- [ ] Compute intraclass correlation coefficient (ICC) across models for each metric
- [ ] Display agreement summary: "All models agree on NPH classification" vs. "Models disagree on Evans Index threshold"
- [ ] Add a "Consensus" result that uses majority vote per voxel (3 of 4 models must agree)

### 5.4 Export / PDF Report

- [ ] Generate a PDF report with:
  - Patient/scan metadata (anonymized)
  - Per-model metrics table
  - Axial slice comparison images (key slices: Evans, callosal angle, max ventricle)
  - Overlap metrics summary
  - Clinical interpretation with disclaimers
- [ ] Use `expo-print` or `react-native-html-to-pdf` for generation
- [ ] Add `expo-sharing` integration for email/AirDrop export
- [ ] Include model version identifiers and processing timestamps in the report

---

## 6. Phase 4: Performance & UX Polish

Goal: Make the comparison view fast and smooth on mid-range devices.

### 6.1 PNG Encoding Optimization

The current pure-JS PNG encoder in `ModelSliceCard.js` runs synchronously on the main thread. With 4 cards updating per slider tick, this causes frame drops.

- [ ] Move PNG encoding to a Web Worker (web) / JSI thread (native)
- [ ] Implement a shared PNG encoder module (currently duplicated between `SliceViewer.js` and `ModelSliceCard.js`)
- [ ] Pre-encode neighboring slices (sliceIndex +/- 2) for instant slider response
- [ ] Consider raw RGBA data URI (`data:image/raw`) + canvas rendering on web to skip PNG encode entirely
- [ ] Benchmark: target < 16ms per card update (60fps) or < 33ms (30fps acceptable)

### 6.2 Lazy Rendering

- [ ] Only render visible `ModelSliceCard` components (if user scrolls the 2x2 grid off-screen)
- [ ] Defer off-screen card rendering with `InteractionManager.runAfterInteractions`
- [ ] Add skeleton placeholders while PNG encodes are in progress
- [ ] Use `React.memo` with custom comparator to prevent unnecessary re-renders when only one model's slice changes

### 6.3 Progressive Loading

- [ ] Show the classical result immediately while ML models process in background
- [ ] Animate ML model cards from placeholder to rendered state
- [ ] Add per-model loading spinners with estimated time remaining
- [ ] Update `ProcessingScreen` progress bar to show parallel model execution

### 6.4 Caching

- [ ] Cache rendered PNG data URIs keyed by `(modelId, sliceIndex)` using an LRU map (max ~100 entries, ~20 MB)
- [ ] Cache API inference results keyed by volume hash + model ID
- [ ] Persist cache across sessions using `expo-file-system` (write masks to temp files)
- [ ] Add cache invalidation when model versions change

### 6.5 Offline Mode

- [ ] Detect network availability before attempting API calls
- [ ] Fall back to mock provider with clear "MOCK" badge on each card
- [ ] Queue API requests for when connectivity returns (optional)
- [ ] Store last successful real results for comparison against current mock results

---

## 7. Phase 5: Clinical Validation

Goal: Validate that multi-model comparison adds clinical value before any deployment.

### 7.1 Ground Truth Comparison

- [ ] Assemble a validation dataset (minimum 30 CT scans with expert manual segmentations)
- [ ] Compute DSC, Hausdorff Distance, and volume correlation against ground truth for each model
- [ ] Report per-model accuracy metrics and confidence intervals
- [ ] Identify failure modes per model (e.g., MedSAM2 over-segments in cases with periventricular leukomalacia)

### 7.2 Inter-Rater Reliability

- [ ] Have 2+ neuroradiologists independently assess NPH likelihood on the same scans
- [ ] Compare model consensus with expert consensus (Cohen's kappa, Fleiss' kappa)
- [ ] Measure whether multi-model agreement correlates with diagnostic confidence

### 7.3 IRB and Regulatory Considerations

- [ ] This tool is NOT a medical device — the "Research Use Only" disclaimer must persist
- [ ] Do not store any patient-identifiable data in the app or on the inference server
- [ ] Volume data sent to the API backend must be anonymized (strip NIfTI header extensions containing patient info)
- [ ] If pursuing clinical use: FDA 510(k) or De Novo classification would be required (Class II SaMD)
- [ ] Document intended use, limitations, and known failure modes in user-facing materials

### 7.4 Testing Protocol

- [ ] Unit tests for `ApiModelProvider.js` (mock HTTP responses, verify mask decoding)
- [ ] Integration test: run full `runMultiModelPipeline()` with sample data, verify all 4 results have valid shapes
- [ ] Visual regression tests for `ComparisonView` (snapshot comparison)
- [ ] End-to-end test: upload NIfTI, verify all 4 model cards render, verify metrics table populates
- [ ] Stress test: 256x256x256 volume to verify memory limits and performance thresholds

---

## 8. Architecture Decision Records

### ADR-001: Module-Level Store Instead of React Context or Redux

**Decision:** Use a plain JS module (`ResultsStore.js`) with `get/set/clear` functions.

**Context:** Each `ModelResult` contains a `ventMask` (`Uint8Array`) of size `X * Y * Z` (e.g., 262,144 bytes for 64^3, up to 16 MB for 256^3). With 4 models, this is 40-65 MB of typed array data.

**Why not React Navigation params?** Navigation params are serialized with `JSON.stringify`. Typed arrays serialize as `{"0":0,"1":1,...}` — a 262,144-element object that crashes the serializer.

**Why not React Context?** Setting 40 MB of state in Context triggers a full re-render of every consumer. The comparison view only needs to read data once on mount.

**Why not Redux?** Adding Redux for a single data-passing need is excessive. The store has no subscribers, no reducers, no middleware — it is a cache, not state management.

**Consequences:** Data is not reactive. If the store is updated after mount, components will not re-render. This is acceptable because results are computed once and displayed statically.

### ADR-002: Mock Perturbation Strategies

**Decision:** Each mock model applies a distinct morphological operation to the classical mask to simulate characteristic segmentation behaviors.

**Rationale:**
- **MedSAM2 → dilate:** Foundation models tend to over-segment slightly at tissue boundaries. Dilation by 1 voxel adds a realistic ~5-15% volume increase.
- **SAM3 → opening:** Conservative models smooth boundaries and remove small protrusions. Morphological opening (erode then dilate) achieves this naturally.
- **YOLOvx → ellipsoidal fit:** Detection-based models produce blobby, axis-aligned segmentations. Fitting an ellipsoid to each connected component simulates this behavior.

**Consequences:** Mock outputs are deterministic given the same classical mask. Volume differences are physiologically plausible. The metrics table shows realistic cross-model disagreement patterns without requiring network access or GPU compute.

### ADR-003: Pure-JS PNG Encoding

**Decision:** Encode slice images as PNG entirely in JavaScript using a manual implementation (CRC32 + Adler32 + uncompressed DEFLATE blocks).

**Context:** React Native's `<Image>` component requires a URI source. On web, we could use `<canvas>`, but React Native does not have a canvas API. Options considered:
1. **expo-image-manipulator** — requires writing to disk, async, slow for real-time slider updates.
2. **react-native-skia** — excellent but adds a 5 MB native dependency and breaks Expo Go.
3. **Pure-JS PNG** — no dependencies, works everywhere, outputs `data:image/png;base64,...` URIs.

**Trade-off:** The encoder produces uncompressed PNGs (DEFLATE store blocks, no LZ77). A 64x64 RGB image is ~12 KB as uncompressed PNG vs. ~4 KB compressed. For 256x256, this becomes ~192 KB vs. ~50 KB. Acceptable for base64 data URIs but worth optimizing in Phase 4.

**Consequences:** PNG encoding is the primary performance bottleneck. Four 64x64 encodes take ~8ms total (fine). Four 256x256 encodes take ~80-120ms (causes frame drops during slider drag). The debounced slider (50ms timeout in `ComparisonView.js`) mitigates this but does not eliminate it.

### ADR-004: Sequential Mock Execution (Current) vs. Parallel API Execution (Future)

**Decision:** Mock models run sequentially in `runMultiModelPipeline()`. Real API calls should run in parallel.

**Rationale:** Sequential execution allows the progress UI to show one model at a time (steps 9, 10, 11 in `MULTI_MODEL_STEPS`). Mocks use simulated delays (700ms-3500ms), so total mock time is ~6.2s — acceptable for a demo.

**Future change:** When using `ApiModelProvider`, all 3 API calls should fire via `Promise.all()` since they are independent. The server handles them concurrently (or queues them). Expected total wall time drops from `sum(model_times)` to `max(model_times)`.

**Progress UI impact:** With parallel execution, individual step progress becomes harder to display. Options: (a) show a combined "Running ML models..." step with a spinner, (b) show 3 concurrent progress bars, (c) update each model's card individually as results arrive using `Promise.allSettled()` + incremental state updates.

---

## Appendix: Quick Reference

### Provider Interface Contract

Any model provider (mock or API) must return a `ModelResult` matching this shape:

```js
{
  modelId: string,           // 'medsam2' | 'sam3' | 'yolovx'
  modelName: string,         // Display name
  modelColor: string,        // Hex color from ModelRegistry
  colorRgb: { r, g, b },    // RGB for overlay rendering
  evansIndex: number,        // 0.0 - 1.0
  evansSlice: number,        // Axial slice index of max Evans
  evansData: object,         // Full Evans computation result
  callosalAngle: number|null,// Degrees, null if not computable
  callosalSlice: number,     // Coronal slice index
  callosalData: object,      // Full callosal computation result
  ventVolMl: number,         // Ventricle volume in mL
  ventVolMm3: number,        // Ventricle volume in mm^3
  nphScore: number,          // 0, 1, 2, or 3
  nphPct: number,            // 0, 33, 67, or 100
  ventCount: number,         // Total segmented voxels
  ventMask: Uint8Array,      // Binary mask, length = X*Y*Z
  shape: [X, Y, Z],         // Volume dimensions
  spacing: [sx, sy, sz],    // Voxel size in mm
  boundingBoxes: Array<{     // Per-component bounding boxes
    minX, maxX, minY, maxY, minZ, maxZ: number,
    volumeMl: number,
    confidence: number       // 0.0 - 1.0
  }>,
  processingTime: string,    // e.g. '2.3s'
  processingTimeNum: number, // e.g. 2.3
}
```

### Clinical Thresholds (used in MetricsComparisonTable)

| Metric | Abnormal Threshold | Interpretation |
|--------|-------------------|----------------|
| Evans Index | > 0.3 | Ventriculomegaly |
| Callosal Angle | < 90 degrees | Suggestive of NPH |
| Ventricle Volume | > 50 mL | Enlarged ventricles |
| NPH Score | >= 67% | High probability of NPH |

### Color Assignments

| Model | Color | Hex |
|-------|-------|-----|
| Classical | Blue | `#58a6ff` |
| MedSAM2 | Green | `#3fb950` |
| SAM3 | Purple | `#bc8cff` |
| YOLOvx | Orange | `#ff6e40` |
