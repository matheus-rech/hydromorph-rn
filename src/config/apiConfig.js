/**
 * apiConfig — Module-level configuration for ML model API endpoints
 *
 * Stores cloud inference settings. Cloud mode is opt-in;
 * defaults to demo mode (mocks only, no network calls).
 *
 * Author: Matheus Machado Rech
 */

let _config = {
  cloudEnabled: false, // user must explicitly enable
  baseUrl: '',         // base URL for inference API (empty = demo mode)
  timeout: 30000,      // 30s request timeout
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
