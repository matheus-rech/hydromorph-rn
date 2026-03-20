# Copilot Instructions for HydroMorph

Repository-wide guidance for GitHub Copilot coding agents.

## Project Overview
- React Native app (Expo SDK 51, React Navigation v6, react-native-svg) that computes Evans Index, Callosal Angle, and ventricle volume from NIfTI head CT scans.
- Classical pipeline runs fully on-device; cloud models (Hugging Face Spaces) may refine masks. Research use only; not for clinical diagnosis.
- Design: GitHub dark theme (`#0d1117` background), version 2.0.0.

## Setup & Key Commands
- Install: `npm install`
- Run dev: `npx expo start` (use `--web`, `--android`, or `--ios` as needed)
- Build check: `npx expo export --platform web` (no test suite or linter configured)
- Sample data: `assets/sample-data.json` (64×64×90 volume). Large uploaded volumes are handled at runtime.

## Coding Conventions
- Components: PascalCase filenames, `export default function ComponentName`, `StyleSheet.create()` at file end, header comment block (`/** ... */`) with author.
- Theme: always consume tokens from `src/theme.js`; avoid hardcoded colors/spacing/typography.
- Navigation: do not pass large typed arrays through params—use `src/models/ResultsStore.js`.
- Rendering: keep RGBA buffer → pure-JS PNG encoder (`src/utils/PngEncoder.js`) → `<Image>` with SVG overlays. Do not switch to Canvas or enable PNG compression.
- Clinical logic: import thresholds from `src/clinical/thresholds.js` and NPH scoring from `src/clinical/scoring.js`; never duplicate or hardcode cutoffs.
- Models: define/update entries in `src/models/ModelRegistry.js`; provider types `local` or `api` with optional `fallbackToMock`.

## Pipeline & Privacy Guardrails
- Classical steps (masking, CSF, adaptive opening, ventricle isolation, Evans/Callosal/Volume, report) run on-device; keep `await delay()` yields for UI responsiveness.
- Adaptive opening is skipped when spacing <0.7mm or >2.5mm—do not remove this check.
- Cloud calls must only send anonymized 2D PNG slices or binary masks. Never transmit raw HU volumes.
- Expo managed workflow only; avoid adding native modules that break it.
- Maintain sanity checks in `src/pipeline/Pipeline.js`.

## Key Files
- `src/pipeline/Pipeline.js` — orchestrator (classical + multi-model)
- `src/pipeline/Morphometrics.js` — 3D operations, BFS, Evans/Callosal math, pixel generation
- `src/pipeline/NiftiReader.js` — NIfTI parsing (gzip, endianness, datatypes)
- `src/models/ApiModelProvider.js` / `src/models/MockModelProvider.js` — cloud + fallback flows
- `src/components/SliceViewer.js`, `src/components/ComparisonView.js` — rendering and overlays
- `src/config/apiConfig.js` — cloud toggle, timeouts, retries

## Copilot SDK (when used)
```typescript
import { CopilotClient } from "@github/copilot-sdk";
const client = new CopilotClient();
try {
  const session = await client.createSession({ model: "gpt-4.1" });
  const res = await session.sendAndWait({ prompt: "Hello!" });
  console.log(res?.data.content);
} finally {
  await client.stop();
}
```
- Clean up clients in `finally`/`defer`; never hardcode tokens (use env vars like `COPILOT_GITHUB_TOKEN`).
- Tool schemas must be valid JSON Schema (`type: "object"` with explicit `required`).
- Prefer streaming for interactive UIs; `sendAndWait` for batch flows.

## Validation Expectations
- Default check: `npx expo export --platform web`. If failures stem from missing assets or remote endpoints, record the cause instead of bypassing safeguards.
