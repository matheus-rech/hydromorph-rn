# HydroMorph — React Native App

**Cross-platform hydrocephalus morphometrics app (iOS + Android + Web).**
Evans Index · Callosal Angle · Ventricle Volume · NPH Scoring

100% on-device processing. No data ever leaves the phone.

## Deploy (pick one)

### Option A: Web App via GitHub Pages (easiest — instant URL)

1. Create a GitHub repo, push these files to `main`
2. Go to Settings → Pages → Source: **GitHub Actions**
3. The `deploy-web.yml` workflow runs automatically
4. Live at `https://<username>.github.io/<repo-name>/` in ~2 minutes

### Option B: Native APK + iOS build via Expo EAS

1. Create an [Expo account](https://expo.dev/signup)
2. Create an access token: Account Settings → Access Tokens → Create
3. In your GitHub repo: Settings → Secrets → Actions → add `EXPO_TOKEN`
4. Push to `main` — the `build.yml` workflow builds both platforms
5. Download APK/IPA from [expo.dev](https://expo.dev) builds dashboard

### Option C: Local development

```bash
npm install
npx expo start
# Scan QR code with Expo Go app on your phone
```

## What happens on push

```
push to main
  ├─ deploy-web.yml   → Expo web export → GitHub Pages (URL)
  └─ build.yml        → EAS Build → Android APK + iOS simulator build
```

## One-time setup for native builds

The EAS build workflow needs an `EXPO_TOKEN` secret. Without it, only the web deploy runs (which is fine for a conference demo — everyone can open the URL on their phone).

## Project structure

```
├── App.js                          # Navigation: Upload → Processing → Results
├── src/
│   ├── pipeline/
│   │   ├── NiftiReader.js          # NIfTI-1 parser (gzip, endianness, 6 datatypes)
│   │   ├── Morphometrics.js        # 3D morphological ops, BFS components, Evans, callosal angle
│   │   └── Pipeline.js             # 9-step pipeline orchestrator
│   ├── screens/
│   │   ├── UploadScreen.js         # File picker + sample data
│   │   ├── ProcessingScreen.js     # Step progress + metadata
│   │   └── ResultsScreen.js        # Metrics, slice viewers, measurements
│   ├── components/
│   │   ├── MetricCard.js           # Status-colored metric card
│   │   ├── NPHBadge.js             # LOW/MODERATE/HIGH badge
│   │   ├── ProgressSteps.js        # Animated step indicators
│   │   └── SliceViewer.js          # PNG renderer + SVG overlays
│   └── theme.js                    # GitHub-dark tokens
├── assets/sample-data.json         # Bundled 64×64 CT demo
├── eas.json                        # EAS Build profiles
├── .github/workflows/
│   ├── deploy-web.yml              # → GitHub Pages
│   └── build.yml                   # → Expo EAS (APK + iOS)
└── README.md
```

## Author

**Matheus Machado Rech**

Research use only — not for clinical diagnosis.
