# HydroMorph Architecture

## Overview
HydroMorph is a React Native (Expo) mobile application for hydrocephalus morphometric analysis from head CT scans. It processes NIfTI files to compute clinical metrics: Evans Index, Callosal Angle, and Ventricle Volume.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HYDROMORPH REACT NATIVE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │ UploadScreen │────▶│ProcessingScr │────▶│ResultsScreen │                │
│  └──────────────┘     └──────────────┘     └──────────────┘                │
│         │                    │                      │                       │
│         ▼                    ▼                      ▼                       │
│  ┌──────────────────────────────────────────────────────────────────┐      │
│  │                         PIPELINE.js                               │      │
│  │  ┌────────────────────────────────────────────────────────────┐   │      │
│  │  │  Steps 1-9: Classical Processing (100% On-Device)         │   │      │
│  │  │  • HU Thresholding • Morphological Filtering • Metrics    │   │      │
│  │  └────────────────────────────────────────────────────────────┘   │      │
│  │                              │                                    │      │
│  │                              ▼                                    │      │
│  │  ┌────────────────────────────────────────────────────────────┐   │      │
│  │  │  Steps 10-12: ML Model Inference (Cloud API + Mock)       │   │      │
│  │  │  • MedSAM2 • MCP-MedSAM • SAM-Med3D • SegResNet • etc     │   │      │
│  │  └────────────────────────────────────────────────────────────┘   │      │
│  │                              │                                    │      │
│  │                              ▼                                    │      │
│  │  ┌────────────────────────────────────────────────────────────┐   │      │
│  │  │  Step 13: Multi-Model Comparison                          │   │      │
│  │  │  • Results stored in ResultsStore (module singleton)      │   │      │
│  │  └────────────────────────────────────────────────────────────┘   │      │
│  └──────────────────────────────────────────────────────────────────┘      │
│                                    │                                        │
│         ┌──────────────────────────┼──────────────────────────┐             │
│         ▼                          ▼                          ▼             │
│  ┌──────────────┐          ┌──────────────┐          ┌──────────────┐      │
│  │ModelRegistry │          │ SliceEncoder │          │  GradioClient│      │
│  │  (Config)    │          │ (PNG Encode) │          │ (API Client) │      │
│  └──────────────┘          └──────────────┘          └──────────────┘      │
│         │                          │                          │             │
│         ▼                          ▼                          ▼             │
│  ┌──────────────────────────────────────────────────────────────────┐      │
│  │                     ApiModelProvider.js                           │      │
│  │  ┌────────────────────────────────────────────────────────────┐   │      │
│  │  │  Privacy-Critical Layer:                                   │   │      │
│  │  │  • Full 3D volume NEVER leaves device                      │   │      │
│  │  │  • Only anonymized 2D PNG slices sent to API               │   │      │
│  │  │  • Binary masks transmitted for some models               │   │      │
│  │  └────────────────────────────────────────────────────────────┘   │      │
│  └──────────────────────────────────────────────────────────────────┘      │
│                                    │                                        │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NEUROSEG SERVER (HF Spaces)                         │
│                    https://mmrech-medsam2-server.hf.space                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Unified Multi-Model Server                       │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  Models Available:                                                   │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │   │
│  │  │  MedSAM2    │ │ MCP-MedSAM  │ │ SAM-Med3D   │ │ MedSAM-3D   │    │   │
│  │  │  (2D/3D)    │ │  (2D MCP)   │ │   (3D)      │ │   (3D)      │    │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘    │   │
│  │  ┌─────────────┐ ┌─────────────┐                                     │   │
│  │  │  TractSeg   │ │   nnU-Net   │                                     │   │
│  │  │  (MR only)  │ │  (generic)  │                                     │   │
│  │  └─────────────┘ └─────────────┘                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         MCP Server                                   │   │
│  │  Endpoint: /gradio_api/mcp/sse                                      │   │
│  │  Purpose: LLM tool use (cursor/kimi-claude integration)             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     API Endpoints                                    │   │
│  │  • POST /gradio_api/upload         → Upload PNG slice               │   │
│  │  • POST /gradio_api/call/segment   → Segment endpoint               │   │
│  │  • POST /api/segment_2d            → Direct JSON API (2D)           │   │
│  │  • POST /api/segment_3d            → Direct JSON API (3D)           │   │
│  │  • GET  /api/health                → Health check                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Sample Data (3 NPH CT Scans)                      │   │
│  │  Source: HF Datasets radimagenet/normal-pressure-hydrocephalus      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. UploadScreen.js
- Entry point for the app
- File picker for NIfTI files (.nii/.nii.gz)
- Sample data loader
- Cloud mode toggle (Demo ↔ Live API)
- Connection health checker

### 2. ProcessingScreen.js
- Runs the 13-step pipeline
- Progress indicator
- Error handling
- Navigation to results

### 3. ResultsScreen.js
- Clinical metrics display (Evans Index, Callosal Angle, Ventricle Volume)
- Multi-model comparison view
- Slice visualization with overlays
- Diagnostic interpretation

### 4. Pipeline.js
**Classical Pipeline (Steps 1-9) - On-Device:**
1. Load NIfTI volume
2. Normalize HU values
3. Extract brain mask
4. Window/level adjustment
5. Threshold ventricles
6. Morphological cleaning
7. Compute Evans Index
8. Compute Callosal Angle
9. Compute ventricle volume

**ML Pipeline (Steps 10-12) - Cloud:**
10. Run MedSAM2 inference
11. Run additional models (MCP-MedSAM, SAM-Med3D, etc.)
12. Aggregate results

**Comparison (Step 13):**
13. Compare classical vs ML outputs

### 5. ModelRegistry.js
Central configuration for all segmentation models:
- `classical`: Local processing
- `medsam2`: MedSAM2 via NeuroSeg server
- `mcp_medsam`: MCP-MedSAM via NeuroSeg server
- `sam_med3d`: SAM-Med3D via NeuroSeg server
- `tractseg`: TractSeg (MR only)
- `segresnet`: SegResNet via NeuroSeg server

### 6. ApiModelProvider.js
Privacy-critical layer:
- Never transmits full 3D HU volume
- Encodes best axial slice to PNG
- Sends only anonymized 2D data to API
- Receives segmentation mask back
- Recomputes metrics locally from mask

### 7. SliceEncoder.js
- `encodeAxialSlicePNG()`: Converts volume slice to PNG base64
- `findBestVentricleSlice()`: Finds slice with most ventricle voxels
- `generateAxialPixels()`: RGBA buffer generation

### 8. GradioClient.js
Gradio protocol implementation:
- `uploadFile()`: POST to /gradio_api/upload
- `callEndpoint()`: Call + SSE polling
- `segmentImage()`: High-level helper
- `checkHealth()`: Space availability check

## Data Flow

### Privacy Architecture
```
┌─────────────────┐
│   Full 3D CT    │◄── Patient data (NEVER leaves device)
│ Volume (HU)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Find Best      │
│  Ventricle Slice│
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Encode as PNG  │────▶│  Anonymized 2D  │───▶ To API
│  (remove PHI)   │     │  Slice Image    │
└─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │  NeuroSeg Server │
                        │  • Segment       │
                        │  • Return mask   │
                        └─────────────────┘
                               │
                               ▼
┌─────────────────┐     ┌─────────────────┐
│ Recompute       │◄────│  Binary Mask    │
│ Metrics Locally │     │  (returned)     │
└─────────────────┘     └─────────────────┘
```

## Model Comparison

Results stored in `ResultsStore.js` (module-level singleton) to avoid passing large typed arrays through React Navigation.

```javascript
// ResultsStore.js pattern
const ResultsStore = {
  classicalMask: Uint8Array,
  mlMasks: {
    medsam2: Uint8Array,
    mcp_medsam: Uint8Array,
    // ...
  },
  metrics: {
    classical: { evansIndex, callosalAngle, ventVolMl },
    ml: { [modelId]: { evansIndex, callosalAngle, ventVolMl } }
  }
};
```

## Clinical Thresholds (thresholds.js)
- Evans Index > 0.3 = abnormal
- Callosal Angle < 90° = abnormal
- Ventricle Volume > 50mL = abnormal

## Configuration

### API Configuration (apiConfig.js)
```javascript
setApiConfig({ cloudEnabled: true });
// Enables live API calls instead of mock data
```

### Model Endpoints (ModelRegistry.js)
Current endpoint: `https://mmrech-medsam2-server.hf.space`

## Feature Flags (Server-Side)
- `ENABLE_MEDSAM2`: Enable MedSAM2 model
- `ENABLE_MCP_MEDSAM`: Enable MCP-MedSAM model
- `ENABLE_SAM_MED3D`: Enable SAM-Med3D model
- `ENABLE_MEDSAM_3D`: Enable MedSAM-3D model
- `ENABLE_TRACTSEG`: Enable TractSeg (MR only)
- `ENABLE_NNUNET`: Enable nnU-Net model

## Files Overview

```
medsam2-server/
├── app.py                    # Main server with Gradio + MCP
├── .github/workflows/        # CI/CD for HF Spaces sync
├── requirements.txt          # Python dependencies
└── config/                   # Model configs (hydra)

hydromorph-rn/
├── App.js                    # Entry point
├── src/
│   ├── screens/
│   │   ├── UploadScreen.js   # File picker + cloud toggle
│   │   ├── ProcessingScreen.js
│   │   └── ResultsScreen.js  # Metrics + comparison
│   ├── pipeline/
│   │   ├── Pipeline.js       # 13-step pipeline
│   │   └── SliceEncoder.js   # PNG encoding
│   ├── models/
│   │   ├── ModelRegistry.js  # Model configs
│   │   ├── ApiModelProvider.js
│   │   ├── MockModelProvider.js
│   │   └── ResultsStore.js   # Data storage
│   ├── api/
│   │   └── GradioClient.js   # Gradio protocol
│   ├── clinical/
│   │   └── thresholds.js     # Clinical values
│   └── config/
│       └── apiConfig.js      # API settings
└── docs/
    └── ARCHITECTURE.md       # This file
```

## MCP Server Integration

The NeuroSeg server exposes an MCP (Model Context Protocol) endpoint:
```
https://mmrech-medsam2-server.hf.space/gradio_api/mcp/sse
```

This allows LLMs (Cursor, Kimi, Claude Desktop) to:
- List available segmentation models
- Segment medical images via tool calls
- Access sample data

## Sample Data

3 NPH CT scans hosted on Hugging Face Datasets:
```
https://huggingface.co/datasets/radimagenet/normal-pressure-hydrocephalus/resolve/main/
├── nph_case_01.nii.gz
├── nph_case_02.nii.gz
└── nph_case_03.nii.gz
```

Pre-configured bounding boxes for optimal segmentation.
