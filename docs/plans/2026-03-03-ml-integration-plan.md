# ML Integration — Implementation Plan

Date: 2026-03-03
Design: ./2026-03-03-ml-integration-design.md

## Task 1: Extend ModelRegistry with provider configuration

**Files**: `src/models/ModelRegistry.js`

Add `provider`, `endpoint`, and `fallbackToMock` fields to each MODEL_CONFIGS entry:

- `classical`: provider='local', no endpoint, no fallback
- `medsam2`: provider='api', endpoint='', fallbackToMock=true
- `sam3`: provider='api', endpoint='', fallbackToMock=true
- `yolovx`: provider='mock', no endpoint, fallbackToMock=false

Add helper functions:
- `getApiModels()` — returns models with provider='api'
- `getMockModels()` — returns models with provider='mock'
- `getProviderType(modelId)` — returns provider string

Keep backward compatibility: existing `getMLModelIds()` still works.

**Tests**: Verify all helpers return expected values. No runtime test needed (pure config).

---

## Task 2: Create API configuration module

**Files**: `src/config/apiConfig.js` (NEW)

Create a module-level config store (same pattern as ResultsStore.js):

```
let _config = {
  cloudEnabled: false,
  baseUrl: '',
  timeout: 30000,
  retries: 1,
};

export function getApiConfig() -> config object
export function setApiConfig(partial) -> merges partial into config
export function isCloudEnabled() -> boolean shortcut
```

Simple, no external dependencies. Just a config singleton.

---

## Task 3: Create ApiModelProvider

**Files**: `src/models/ApiModelProvider.js` (NEW)

Implement `generateApiResult(modelId, volumeData, classicalMask, shape, spacing)`:

1. Check `isCloudEnabled()` — if false, delegate to MockModelProvider
2. Get model config from registry — check endpoint URL
3. If no endpoint, delegate to MockModelProvider
4. Prepare payload:
   - Convert relevant slice/volume data to base64
   - Include shape and spacing arrays
   - Strip any metadata (anonymization)
5. POST to endpoint with timeout
6. Parse response into standard result shape
7. On error: if `fallbackToMock`, delegate to MockModelProvider; else throw

Import `generateMockResult` from MockModelProvider for fallback.
Import `getModelConfig` from ModelRegistry.
Import `getApiConfig, isCloudEnabled` from apiConfig.
Import morphometric functions for recomputing metrics from returned mask.

The result shape must match MockModelProvider's return exactly.

---

## Task 4: Update Pipeline.js to use provider system

**Files**: `src/pipeline/Pipeline.js`

In `runMultiModelPipeline()`, replace direct MockModelProvider call:

Before:
```js
const result = await generateMockResult(modelId, data, ventMask, shape, spacing);
```

After:
```js
const result = await generateModelResult(modelId, data, ventMask, shape, spacing);
```

Where `generateModelResult` checks the model's provider type:
- 'api' → call ApiModelProvider.generateApiResult()
- 'mock' → call MockModelProvider.generateMockResult()
- 'local' → (future) throw not-implemented for now

Add import for ApiModelProvider. Keep MockModelProvider import for 'mock' provider models.

Minimal change — just routing logic.

---

## Task 5: Add Cloud Models toggle to UploadScreen

**Files**: `src/screens/UploadScreen.js`

Add a toggle section below the privacy strip:

- "Cloud Models" toggle (TouchableOpacity styled as switch)
- When OFF (default): "Demo Mode — using simulated model outputs"
- When ON: "Cloud Mode — sends anonymized data to inference API"
- Warning text when toggled ON about data transmission
- Calls `setApiConfig({ cloudEnabled: true/false })`

Style with existing theme tokens. Match the privacy strip aesthetic.

Import `setApiConfig, isCloudEnabled` from apiConfig.
Use `useState` initialized from `isCloudEnabled()`.

---

## Execution Order

Tasks 1-2 are independent (can run in parallel).
Task 3 depends on Tasks 1 and 2.
Task 4 depends on Task 3.
Task 5 depends on Task 2 only.

```
Task 1 (ModelRegistry) ──┐
                         ├── Task 3 (ApiModelProvider) ── Task 4 (Pipeline)
Task 2 (apiConfig)   ────┤
                         └── Task 5 (UploadScreen toggle)
```
