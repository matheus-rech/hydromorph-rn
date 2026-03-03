# NeuroSAM3 Integration + Bug Fixes — Implementation Plan

Date: 2026-03-03
Depends on: ML integration (completed)

## Context

The user's own NeuroSAM3 model is deployed on HuggingFace Spaces at:
`https://mmrech-neurosam3.hf.space/`

The Gradio API provides these key endpoints:
- `/process_with_status` — single-image segmentation (file upload + text prompt + modality + windowing)
- `/process_and_store_mask` + `/export_last_mask_nifti` — process then export binary mask as NIfTI

Integration approach: For each axial slice, convert the volume data to a PNG image, upload to the Gradio API with prompt "ventricles", retrieve the segmented mask, then reconstruct a 3D mask for our morphometrics pipeline.

The Gradio client API uses multipart file uploads and returns file URLs — different from the JSON+base64 approach currently in `ApiModelProvider.js`.

---

## Task 1: Fix web scrolling on all screens

**Files**: `src/screens/ResultsScreen.js`, `src/screens/UploadScreen.js`, `src/screens/ProcessingScreen.js`

**Problem**: User reports "app is not scrolling down" on web. The `contentContainerStyle` on `ScrollView` uses `flexGrow: 1` which on react-native-web can prevent scrolling when content exceeds viewport — the content container stretches to contain all children but the ScrollView doesn't detect overflow.

**Fix**:
1. In `ResultsScreen.js`: Remove `flexGrow: 1` from `content` style (line 701). The footer will naturally push to the bottom of content. The `screen` style already has `height: '100vh'` on web.
2. In `ProcessingScreen.js`: Same fix — check `content` style for `flexGrow: 1` and remove it. Add web-specific `height: '100vh'` and `overflow: 'hidden'` to the outer container style if missing.
3. In `UploadScreen.js`: Same fix — ensure the outer container constrains height on web, and remove `flexGrow: 1` from scroll content if present.

**Acceptance**:
- All three screens scroll on web when content exceeds viewport
- Native behavior unchanged (flex:1 still works)
- No visual regressions

---

## Task 2: Create Gradio API client module

**Files**: `src/api/GradioClient.js` (NEW)

Create a lightweight Gradio API client that:
1. Takes the HF Space base URL
2. Uploads files via multipart form (using React Native's `FormData`)
3. Calls `/process_and_store_mask` with parameters: `image_file` (PNG blob), `prompt_text` ("ventricles"), `modality` ("CT"), `window_type` ("Brain (Grey Matter)")
4. Calls `/export_last_mask_nifti` to get the binary mask as a NIfTI file
5. Downloads the NIfTI file and returns the raw buffer

Gradio API calling convention:
- POST to `{base_url}/gradio_api/call/{endpoint_name}` with form data
- Response is an event stream; parse for `data:` lines containing the result
- OR use the simpler `/api/{endpoint_name}` direct call format

Key functions:
```
export async function segmentSlice(baseUrl, imageBlob, prompt, modality, windowType, timeout)
  → returns { maskImageUrl, status }

export async function segmentAndExportMask(baseUrl, imageBlob, prompt, modality, windowType, timeout)
  → returns { niftiBuffer, status }
```

Include:
- Timeout via AbortController
- Error handling with descriptive messages
- Status parsing from Gradio response

**No mock fallback in this module** — that stays in ApiModelProvider.

---

## Task 3: Add slice-to-PNG conversion helper

**Files**: `src/pipeline/SliceEncoder.js` (NEW)

Create a helper that converts a volume axial slice to a PNG image suitable for uploading to the Gradio API.

The app already has a pure-JS PNG encoder in `SliceViewer.js` — extract and reuse that logic:
1. Use `generateAxialPixels(volumeData, null, shape, spacing, sliceIndex, false)` from Morphometrics.js to get RGBA buffer (grayscale CT, no mask overlay)
2. Encode RGBA buffer to PNG using the existing `encodePNG()` from SliceViewer.js
3. Return as a Blob/base64 suitable for FormData upload

Key function:
```
export function encodeAxialSlicePNG(volumeData, shape, spacing, sliceIndex)
  → returns { base64, width, height }
```

Must NOT duplicate the PNG encoder — import/refactor from SliceViewer.js.

---

## Task 4: Wire NeuroSAM3 into ApiModelProvider

**Files**: `src/models/ApiModelProvider.js`, `src/models/ModelRegistry.js`

Adapt `generateApiResult()` to use the Gradio API for the `sam3` model:

1. Update ModelRegistry: Set `sam3.endpoint` to `https://mmrech-neurosam3.hf.space`
2. In ApiModelProvider, detect that the endpoint is a Gradio Space (URL contains `.hf.space`)
3. For Gradio endpoints:
   - Select a representative axial slice (the one with most ventricle voxels from classical mask)
   - Convert to PNG using SliceEncoder
   - Call GradioClient.segmentSlice()
   - Get back segmented image
   - Extract binary mask from the segmented image (threshold colored overlay pixels)
   - For a 2D demo: apply the 2D mask to the same slice, then extrapolate to 3D (or just use the classical mask with perturbation based on the 2D result's coverage ratio)
4. Fall back to mock if Gradio is unavailable

For the demo, the most practical approach:
- Send ONE representative slice to NeuroSAM3
- Show the real segmentation result for that slice
- Use the classical 3D mask (slightly perturbed) for the 3D metrics
- Display a "Real API" badge when cloud mode is active

This keeps the demo fast (one API call) while showing real model output.

**Acceptance**:
- Toggle cloud mode ON → SAM3 card shows real segmentation from HF Space
- Toggle cloud mode OFF → SAM3 uses mock as before
- Pipeline doesn't hang if HF Space is cold-starting (timeout + fallback)

---

## Task 5: Update UploadScreen cloud toggle UX

**Files**: `src/screens/UploadScreen.js`, `src/config/apiConfig.js`

Enhance the existing cloud toggle:
1. When toggling ON, show the specific model that will use the API ("NeuroSAM3 via HuggingFace")
2. Add a small "Test Connection" button that pings the HF Space health endpoint
3. Show connection status: "Connected" (green), "Cold start (~30s)" (yellow), "Unavailable" (red)

**Acceptance**:
- Cloud toggle shows which model uses the API
- Connection test works and shows status
- Graceful handling of HF Space cold starts

---

## Execution Order

```
Task 1 (scroll fix) ─── independent, do first
Task 2 (GradioClient) ──┐
Task 3 (SliceEncoder) ───┼── Task 4 (Wire into ApiModelProvider)
                         └── Task 5 (UX improvements)
```

Task 1 is independent — fix first.
Tasks 2 and 3 are independent of each other — can be done in sequence.
Task 4 depends on 2 and 3.
Task 5 depends on 2 (for connection test).
