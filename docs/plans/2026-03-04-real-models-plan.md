# Real ML Models — Implementation Plan (Revised)

**Date:** 2026-03-04
**Status:** Active

## Revised Approach

Instead of redesigning the entire Gradio architecture, we:
1. Study MedSAM2 and create our own implementation + fine-tuning pipeline
2. Collect labeled imaging data for YOLOvx training
3. Explore MONAI models for additional segmentation options
4. Deploy fine-tuned models to HuggingFace Spaces and use existing API infrastructure
5. Use real segmented PNG images in the app's sample data

The existing Gradio client architecture (GradioClient.js, ApiModelProvider.js) is kept mostly as-is — it already works for NeuroSAM3.

## MedSAM2 Key Findings

From studying the notebooks and repo:
- **Architecture**: Treats 3D volumes as "video" — each axial slice is a frame
- **Prompting**: Bounding box on one key slice → propagates forward + backward through all slices
- **Two predictors**:
  - `build_sam2_video_predictor_npz` — accepts numpy arrays directly (for CT NIfTI)
  - `build_sam2_video_predictor` — accepts JPEG frame directories
- **Checkpoint**: `MedSAM2_2411.pt` (~149MB) from `wanglab/MedSAM2` on HuggingFace
- **Config**: `configs/sam2.1_hiera_t512.yaml`
- **Training data format**: NPZ files with keys: `imgs` (Z,Y,X) [0,255], `gts` (Z,Y,X), `spacing` (3,)
- **Post-processing**: `getLargestCC()` — keep only largest connected component

### CT Inference Flow (from CT_Lesion_Demo notebook)
1. Load NIfTI → clip to DICOM window → normalize 0-255
2. Resize all slices to 512×512 RGB
3. Normalize with ImageNet mean/std
4. `init_state(images_tensor, video_height, video_width)`
5. `add_new_points_or_box(inference_state, frame_idx=key_slice, obj_id=1, box=bbox)`
6. `propagate_in_video(inference_state)` — forward
7. `propagate_in_video(inference_state, reverse=True)` — backward
8. Threshold at 0.0, take largest connected component
9. Save as NIfTI mask

### Adaptation for Ventricle Segmentation
- **Bounding box source**: Use classical pipeline's ventricle mask to compute bbox on key slice
- **DICOM window**: Brain window (WL=40, WW=80) → clip to [0, 80]
- **Key slice**: Axial slice with maximum ventricle area (from classical pipeline)
- **Fine-tuning data**: NIfTI CT volumes with ventricle ground truth masks (from TotalSegmentator or manual)

## Tasks

### Task 1: Create MedSAM2 Ventricle Inference Notebook
**File:** `notebooks/medsam2_ventricle_inference.ipynb`

Adapt the CT Lesion Demo for brain ventricle segmentation:
- Load a head CT NIfTI volume
- Apply brain window (WL=40, WW=80)
- Use classical pipeline's ventricle mask to derive bounding box prompt
- Run MedSAM2 inference with propagation
- Visualize results (axial slices with overlay)
- Compute Evans Index, Callosal Angle, Volume from the segmented mask
- Compare with classical pipeline results

Dependencies: MedSAM2 repo, checkpoints, sample NIfTI data

### Task 2: Create MedSAM2 Fine-Tuning Notebook
**File:** `notebooks/medsam2_ventricle_finetuning.ipynb`

Create a fine-tuning pipeline for ventricle-specific MedSAM2:
- Data preparation: NIfTI → NPZ format (imgs, gts, spacing)
- Use TotalSegmentator ground truth masks as labels
- Fine-tuning loop based on MedSAM2 repo training scripts
- Validation with Dice score
- Export fine-tuned checkpoint
- Reference: MedSAM2 repo training code + FLARE dataset format

### Task 3: Data Preparation Pipeline for YOLO Training
**File:** `notebooks/yolo_ventricle_data_prep.ipynb`

Collect and prepare labeled data for YOLOvx training:
- Download publicly available brain CT datasets (HuggingFace, no auth needed)
- Extract axial slices as brain-windowed PNGs (WL=40, WW=80, 512×512)
- Generate YOLO bounding box labels from TotalSegmentator ventricle masks
- Organize into YOLO dataset format (images/train, images/val, labels/train, labels/val)
- Write dataset.yaml with 5 NPH classes
- Reference: NPHProject_backup/training/ pipeline

### Task 4: Generate Real Sample Images for the App
**File:** Update `assets/` with real brain-windowed CT PNGs

Using our pipeline:
- Extract representative axial slices from a public brain CT volume
- Apply brain window (WL=40, WW=80) → brain-windowed PNG
- Generate corresponding ventricle overlay images
- Replace or augment the current synthetic 64×64 sample-data.json
- These become the "real" sample images shown in the app

### Task 5: Explore MONAI Models
**File:** `notebooks/monai_brain_segmentation.ipynb`

Survey MONAI's model zoo for brain/ventricle segmentation:
- SwinUNETR (various sizes)
- SegResNet
- Check MONAI Model Zoo for pre-trained brain segmentation models
- Test inference on a sample brain CT
- Compare with MedSAM2 results
- Document findings for future deployment decisions

### Task 6: Update Design Document
**File:** Update `docs/plans/2026-03-04-real-models-design.md`

Revise the design doc with:
- Updated approach (no wholesale Gradio redesign)
- MedSAM2 findings and fine-tuning plan
- MONAI model survey results
- Revised deployment strategy (fine-tune → deploy to HF → use API)
- Real sample image strategy
