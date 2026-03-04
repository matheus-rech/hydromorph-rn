# HydroMorph ↔ NeuroSeg Server Integration Summary

## Overview
This document summarizes the integration between the HydroMorph React Native mobile app and the unified NeuroSeg server deployed on HuggingFace Spaces.

## Server Information
- **Endpoint**: https://mmrech-medsam2-server.hf.space
- **Repository**: https://github.com/matheus-rech/neuroseg-server
- **MCP Server**: https://mmrech-medsam2-server.hf.space/gradio_api/mcp/sse

## Changes Made

### 1. ModelRegistry.js (Updated)
**Location**: `src/models/ModelRegistry.js`

**Changes**:
- Added unified NeuroSeg server endpoint constant: `NEUROSEG_ENDPOINT`
- Updated all model endpoints to point to unified server
- Added new models:
  - `mcp_medsam` — MCP-MedSAM (2D, LLM-guided)
  - `sam_med3d` — SAM-Med3D (3D-aware)
  - `medsam_3d` — MedSAM-3D (full 3D)
  - `tractseg` — TractSeg (MR only, flagged)
  - `nnunet` — nnU-Net (self-configuring)
- Enhanced model configs with:
  - `endpointPath` — specific API path for each model
  - `modality` — CT/MR/any
  - `supports2D` / `supports3D` — capability flags
  - `requiresPrompt` — whether bounding box needed
  - `isNew` / `isDeprecated` — UI flags
  - `warning` — user-facing warnings (e.g., "MR only")
- Added new utility functions:
  - `getNewModels()`, `getDeprecatedModels()`, `getActiveModels()`
  - `getModelsForModality()`, `getCTModels()`, `getMRModels()`
  - `get2DModels()`, `get3DModels()`, `getModelsRequiringPrompt()`
  - `getNPHComparisonSet()` — recommended CT models
  - `getNeuroSegModelSet()` — all unified server models

### 2. Sample Data Configuration (New)
**Location**: `src/config/sampleDataConfig.js` (new file)

**Features**:
- Defines 3 NPH CT scans from HF Datasets
- Pre-configured bounding boxes for each case
- Window/level settings for optimal visualization
- Download functions with progress tracking
- Accessibility checking

**Sample Scans**:
| ID | Name | Description |
|----|------|-------------|
| nph_case_01 | NPH Case 01 | Typical presentation |
| nph_case_02 | NPH Case 02 | Moderate ventriculomegaly |
| nph_case_03 | NPH Case 03 | Severe ventriculomegaly |

### 3. Architecture Documentation (New)
**Location**: `docs/ARCHITECTURE.md`

Complete system architecture documentation including:
- Component diagram
- Data flow (privacy-preserving)
- Pipeline stages
- Model comparison approach
- Clinical thresholds

## Privacy Architecture (Preserved)

```
┌─────────────────┐
│  Patient 3D CT  │ ◄── Full volume (HU) NEVER leaves device
│    Volume       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Find Best      │
│  Ventricle Slice│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Encode as PNG  │ ◄── Anonymized 2D slice
│  (remove PHI)   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│     NeuroSeg Server (HF Spaces)     │
│  • /gradio_api/upload (PNG upload)  │
│  • /gradio_api/call/segment         │
│  • /api/segment_2d or /api/segment_3d│
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  Binary Mask    │ ◄── Returned to device
│  (base64)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Recompute       │
│ Metrics Locally │ ◄── Evans Index, Callosal Angle, Volume
└─────────────────┘
```

## API Endpoints

### Gradio Protocol (Default)
Used by most models for mobile compatibility.

```javascript
// Upload PNG slice
POST /gradio_api/upload

// Call segmentation
POST /gradio_api/call/process_with_status
Body: { data: [file_ref, prompt, modality, windowType] }

// Poll for result
GET /gradio_api/call/process_with_status/{event_id}
```

### Direct JSON API
Used by 3D models and for server-to-server communication.

```javascript
// 2D segmentation
POST /api/segment_2d
Body: { model_id, image_b64, prompt, modality }

// 3D segmentation  
POST /api/segment_3d
Body: { model_id, volume_b64, shape, spacing, prompt }

// Health check
GET /api/health
```

## Model Selection Logic

### For NPH/CT Scans (Recommended)
```javascript
import { getNPHComparisonSet } from './src/models/ModelRegistry';

const models = getNPHComparisonSet();
// Returns: [Classical, MedSAM2, MCP-MedSAM, SegResNet, nnU-Net]
```

### All Available Models
```javascript
import { getNeuroSegModelSet } from './src/models/ModelRegistry';

const models = getNeuroSegModelSet();
// Returns: [MedSAM2, MCP-MedSAM, SAM-Med3D, MedSAM-3D, SegResNet, TractSeg, nnU-Net]
```

## Sample Data Integration

### Using Remote Samples (New)
```javascript
import { 
  getDefaultSample, 
  downloadSampleScan 
} from './src/config/sampleDataConfig';

// Get default sample metadata
const sample = getDefaultSample();

// Download for processing
const blob = await downloadSampleScan('nph_case_01', (progress, msg) => {
  console.log(`${progress}%: ${msg}`);
});
```

### Backward Compatibility
The existing bundled sample data in `assets/sample-data.json` continues to work.

## Cloud Mode Toggle

In `UploadScreen.js`, users can toggle between:
- **Demo Mode**: Uses `MockModelProvider` with simulated results
- **Cloud Mode**: Calls NeuroSeg server with real inference

```javascript
// Check cloud status
import { isCloudEnabled } from './src/config/apiConfig';

if (isCloudEnabled()) {
  // Will attempt API calls
}
```

## Error Handling & Fallback

All API models have `fallbackToMock: true`:
1. Attempt API call to NeuroSeg server
2. On failure (network, timeout, error), log warning
3. Fall back to `MockModelProvider` with realistic simulated data
4. UI shows indicator that results are simulated

## Feature Flags (Server-Side)

The NeuroSeg server uses environment variables to enable models:
```bash
ENABLE_MEDSAM2=true
ENABLE_MCP_MEDSAM=true
ENABLE_SAM_MED3D=true
ENABLE_MEDSAM_3D=true
ENABLE_TRACTSEG=false  # MR only
ENABLE_NNUNET=true
```

## Files Modified

| File | Change |
|------|--------|
| `src/models/ModelRegistry.js` | Updated endpoints, added new models |
| `src/config/sampleDataConfig.js` | New file with HF-hosted NPH samples |
| `docs/ARCHITECTURE.md` | New architecture documentation |
| `docs/INTEGRATION_SUMMARY.md` | This file |

## Next Steps

### Required Updates
1. **Pipeline.js**: Update `loadSampleVolume()` to support remote samples
2. **UploadScreen.js**: Add sample selector dropdown for multiple cases
3. **ResultsScreen.js**: Add model capability indicators (2D/3D, prompt required)

### Optional Enhancements
1. **Caching**: Cache downloaded sample scans in AsyncStorage
2. **Offline Mode**: Detect connectivity and auto-switch to demo mode
3. **Model Comparison**: Add per-model accuracy metrics from validation
4. **MCP Integration**: Allow LLM tool use for advanced segmentation

## Validation Checklist

- [ ] Cloud mode toggle works
- [ ] Connection health check passes
- [ ] All API models fall back to mock on failure
- [ ] Sample downloads work from HF Datasets
- [ ] Privacy: No full 3D volume leaves device
- [ ] PNG slice encoding works correctly
- [ ] Metrics recomputed correctly from returned masks
- [ ] Model comparison view shows all models
- [ ] New model badges appear in UI
- [ ] TractSeg warning shown for CT scans

## Support

- **Server Issues**: https://github.com/matheus-rech/neuroseg-server/issues
- **Mobile App Issues**: Local repository
- **HF Space**: https://huggingface.co/spaces/mmrech/medsam2-server
