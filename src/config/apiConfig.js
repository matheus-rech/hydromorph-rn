/**
 * apiConfig — Module-level configuration for ML model API endpoints
 *
 * Stores cloud inference settings. Cloud mode is opt-in;
 * defaults to demo mode (mocks only, no network calls).
 *
 * Author: Matheus Machado Rech
 */

let _config = {
  cloudEnabled: true,  // real endpoints configured; toggle off via UploadScreen
  baseUrl: '',         // base URL for inference API (empty = per-model endpoints)
  timeout: 60000,      // 60s — HF Spaces cold start can take ~30s
  retries: 1,          // 1 retry on failure
};

export function getApiConfig() {
  return { ..._config };
}

export function setApiConfig(partial) {
  _config = { ..._config, ...partial };
}

export function isCloudEnabled() {
  return _config.cloudEnabled;
}
