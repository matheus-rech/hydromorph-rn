/**
 * Sample Data Configuration for HydroMorph
 * 
 * Defines sample NPH CT scans hosted on HuggingFace Datasets.
 * These can be downloaded for testing without uploading patient data.
 * 
 * Dataset: radimagenet/normal-pressure-hydrocephalus
 * URL: https://huggingface.co/datasets/radimagenet/normal-pressure-hydrocephalus
 * 
 * Pre-configured bounding boxes are provided for optimal ventricle segmentation.
 * 
 * Author: Matheus Machado Rech
 */

// Base URL for HF Dataset files
const HF_DATASET_BASE = 'https://huggingface.co/datasets/radimagenet/normal-pressure-hydrocephalus/resolve/main';

/**
 * Sample NPH CT scan definitions
 * Each entry includes metadata and pre-configured segmentation parameters
 */
export const SAMPLE_SCANS = [
  {
    id: 'nph_case_01',
    name: 'NPH Case 01',
    description: 'Normal Pressure Hydrocephalus - Typical presentation',
    filename: 'nph_case_01.nii.gz',
    url: `${HF_DATASET_BASE}/nph_case_01.nii.gz`,
    size: '4.2 MB', // Approximate
    modality: 'CT',
    diagnosis: 'NPH',
    // Pre-configured bounding boxes for ventricle segmentation
    // Format: { min_x, min_y, min_z, max_x, max_y, max_z } in voxel coordinates
    defaultBoundingBox: {
      min: [80, 60, 40],
      max: [140, 120, 80],
    },
    // Suggested window/level for optimal visualization
    window: {
      center: 40,  // WL
      width: 80,   // WW
    },
  },
  {
    id: 'nph_case_02',
    name: 'NPH Case 02',
    description: 'Normal Pressure Hydrocephalus - Moderate ventriculomegaly',
    filename: 'nph_case_02.nii.gz',
    url: `${HF_DATASET_BASE}/nph_case_02.nii.gz`,
    size: '4.1 MB',
    modality: 'CT',
    diagnosis: 'NPH',
    defaultBoundingBox: {
      min: [75, 55, 35],
      max: [145, 125, 85],
    },
    window: {
      center: 40,
      width: 80,
    },
  },
  {
    id: 'nph_case_03',
    name: 'NPH Case 03',
    description: 'Normal Pressure Hydrocephalus - Severe ventriculomegaly',
    filename: 'nph_case_03.nii.gz',
    url: `${HF_DATASET_BASE}/nph_case_03.nii.gz`,
    size: '4.3 MB',
    modality: 'CT',
    diagnosis: 'NPH',
    defaultBoundingBox: {
      min: [70, 50, 30],
      max: [150, 130, 90],
    },
    window: {
      center: 40,
      width: 80,
    },
  },
];

/**
 * Default sample to use for "Try with Sample" button
 */
export const DEFAULT_SAMPLE_ID = 'nph_case_01';

/**
 * Get sample by ID
 * @param {string} id - Sample ID
 * @returns {Object|null} Sample configuration or null
 */
export function getSampleById(id) {
  return SAMPLE_SCANS.find(s => s.id === id) || null;
}

/**
 * Get default sample configuration
 * @returns {Object} Default sample
 */
export function getDefaultSample() {
  return getSampleById(DEFAULT_SAMPLE_ID);
}

/**
 * Get all available sample IDs
 * @returns {string[]} Array of sample IDs
 */
export function getSampleIds() {
  return SAMPLE_SCANS.map(s => s.id);
}

/**
 * Get all sample configurations
 * @returns {Object[]} Array of sample configurations
 */
export function getAllSamples() {
  return [...SAMPLE_SCANS];
}

/**
 * Download a sample scan from HF Datasets
 * Note: In React Native, this would use fetch/blob
 * 
 * @param {string} sampleId - Sample ID to download
 * @param {Function} onProgress - Progress callback (percent, message)
 * @returns {Promise<Blob>} Downloaded file blob
 */
export async function downloadSampleScan(sampleId, onProgress = () => {}) {
  const sample = getSampleById(sampleId);
  if (!sample) {
    throw new Error(`Unknown sample ID: ${sampleId}`);
  }

  onProgress(0, `Downloading ${sample.name}...`);

  try {
    const response = await fetch(sample.url, {
      method: 'GET',
      // HF Datasets supports range requests for large files
      headers: {
        'Accept': 'application/gzip, application/octet-stream',
      },
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    // Get total size if available
    const contentLength = response.headers.get('content-length');
    const totalSize = contentLength ? parseInt(contentLength, 10) : null;

    // For React Native, we can just return the blob
    // Progress tracking would require a streaming approach
    const blob = await response.blob();
    
    onProgress(100, 'Download complete');
    return blob;

  } catch (error) {
    throw new Error(`Failed to download sample ${sampleId}: ${error.message}`);
  }
}

/**
 * Check if a sample scan is accessible
 * @param {string} sampleId - Sample ID to check
 * @returns {Promise<boolean>} True if accessible
 */
export async function checkSampleAccessibility(sampleId) {
  const sample = getSampleById(sampleId);
  if (!sample) return false;

  try {
    const response = await fetch(sample.url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Sample scan metadata for UI display
 * Returns lightweight info without download URLs
 */
export function getSampleMetadata() {
  return SAMPLE_SCANS.map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    size: s.size,
    modality: s.modality,
    diagnosis: s.diagnosis,
  }));
}

export default {
  SAMPLE_SCANS,
  DEFAULT_SAMPLE_ID,
  getSampleById,
  getDefaultSample,
  getSampleIds,
  getAllSamples,
  downloadSampleScan,
  checkSampleAccessibility,
  getSampleMetadata,
};
