# Aronno Mobile

Expo SDK 54 app for **আরণ্য** — Bangla agriculture assistant with online Gemini APIs, a marketplace checkout, and a full **offline** path (on-device Gemma, Bangla STT, TFLite vision).

Checkout offers cash on delivery, card, and mobile banking. The API prices the cart. Card and bKash / Nagad / Rocket open an SSLCommerz session with `expo-web-browser` and return through `aronno://payment`. The profile tab shows money spent, money earned, and what a shop owner can request as a payout. The public site and English admin monitor live in [`web/`](../web/).

## Documentation

| Doc | Contents |
|-----|----------|
| **[Offline AI guide](../docs/offline_ai/README.md)** | Architecture, **prompts**, RAG, voice, models, **APK / EAS commands** |
| [Model cards](../docs/model_cards/) | Gemma / vision / voice honesty notes |
| [ML training](../ml/README.md) | Disease & tool TFLite training |

## Prerequisites

- Node 20+
- Android Studio / SDK (local native builds)
- Expo account (optional, for EAS)
- API: set `EXPO_PUBLIC_API_URL` in `mobile/.env`

Offline AI **does not run in Expo Go**. Use a development build.

## Quick start

```bash
cd mobile
npm install --legacy-peer-deps

# Native dev client
npx expo run:android

# Or Metro only (if app already installed)
npx expo start -c
```

## Generate an APK

### Local debug APK

```bash
cd mobile
npx expo prebuild --platform android   # if android/ missing
cd android
.\gradlew.bat assembleDebug            # Windows
```

APK path:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### EAS (cloud)

```bash
cd mobile
eas build --platform android --profile development   # APK + dev client
eas build --platform android --profile preview        # internal APK
eas build --platform android --profile production     # Play Store AAB
```

See [EAS notes & `.easignore`](../docs/offline_ai/README.md#12-eas-build-notes) so uploads stay small while **vision models stay included**.

## Offline assistant (summary)

1. Open **মডেল ম্যানেজার** → download Gemma (recommended 1B Instruct) + Bangla STT.
2. **সহকারী** → type or tap mic for live Bangla conversation.
3. Greetings / time / weather use deterministic replies; other turns use grounded Gemma + KB RAG.
4. Vision TFLite ships in the APK under `assets/models/vision/`.

Full prompt text and pipeline: **[docs/offline_ai/README.md §5](../docs/offline_ai/README.md#5-prompts--grounding)**.

## Project layout (high level)

```text
app/                 Expo Router screens
components/          UI
lib/offlineChat/     Prompts, chat loop, live voice
lib/offlineNlu/      RAG + KB + offline treatment
lib/modelManager/    Catalog, download, Gemma engine
lib/offlineVision/   TFLite loaders
lib/offlineVoice/    STT + TTS glue
assets/models/       Bundled KB + vision TFLite
```

## Learn more

- Expo SDK 54: https://docs.expo.dev/versions/v54.0.0/
- EAS Build: https://docs.expo.dev/build/introduction/
