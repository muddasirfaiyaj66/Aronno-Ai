# Aronno Offline AI

Professional reference for how the **offline Bangla agricultural assistant** works in the Expo mobile app: architecture, prompts, RAG, voice, models, and how to build / generate APKs.

> Online path (Nest.js → Gemini) is unchanged. This document covers the **on-device** path only.

Related:

- Model honesty cards: [`docs/model_cards/`](../model_cards/)
- ML training: [`ml/README.md`](../../ml/README.md)
- Short pointer: [`docs/offline_ai_setup.md`](../offline_ai_setup.md)

---

## Table of contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Code map](#3-code-map)
4. [Reply pipeline (how a turn works)](#4-reply-pipeline-how-a-turn-works)
5. [Prompts & grounding](#5-prompts--grounding)
6. [RAG-lite knowledge base](#6-rag-lite-knowledge-base)
7. [Models & storage](#7-models--storage)
8. [Voice (live conversation)](#8-voice-live-conversation)
9. [Vision (disease / tools)](#9-vision-disease--tools)
10. [Development setup](#10-development-setup)
11. [Build & APK commands](#11-build--apk-commands)
12. [EAS Build notes](#12-eas-build-notes)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Overview

| Capability | Engine | Bundled in APK? |
|------------|--------|-----------------|
| Chat / voice assistant (Bangla) | Gemma 3 Instruct GGUF via `llama.rn` | No — download in **Model Manager** |
| Speech-to-text | sherpa-onnx Zipformer (Bangla) | No — download in Model Manager |
| Text-to-speech | Device TTS (`expo-speech`); sherpa TTS avoided (native abort risk) | OS voices |
| Disease / tool scan | INT8 TFLite via `react-native-fast-tflite` | **Yes** — `assets/models/vision/*.tflite` |
| Agronomist facts (RAG) | `bn_knowledge_base.json` | **Yes** — small JSON |

**Product surface:** tab **সহকারী** (`assistant.tsx`) for chat + live voice; **স্ক্যান** for photo/voice diagnosis; **মডেল ম্যানেজার** for LLM/STT downloads.

**Boot policy:** `OfflineAiBootstrap` initializes SQLite and copies bundled vision models. It does **not** eagerly load Gemma or Sherpa TTS (avoids SIGABRT / crash loops). LLM and STT load on first use.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Model Manager (catalog.ts + modelManager.ts)               │
│  Download Gemma GGUF · Bangla STT ONNX into documentDir     │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│  সহকারী (assistant)                                         │
│                                                             │
│  Typed text ──┐                                             │
│  Live mic ────┼──▶ tryDeterministicReply()                  │
│               │         │ yes → welcome / time / weather    │
│               │         ▼ no                                │
│               │    RAG retrieveContext() + session facts    │
│               │    + recent chat (follow-ups)               │
│               │         ▼                                   │
│               │    buildGroundedPrompt()                    │
│               │         ▼                                   │
│               │    Gemma (llama.rn) stream                  │
│               │         ▼                                   │
│               │    sanitizeAssistantReply()                 │
│               │         ▼                                   │
│               └──▶ UI bubble + speakBangla (expo-speech)    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  স্ক্যান (analyzing)                                         │
│  Online → Gemini API                                        │
│  Offline → TFLite disease/tool → result + KB treatment UI   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Code map

| Concern | Path |
|---------|------|
| Chat loop, prompts, deterministic replies | `mobile/lib/offlineChat/chatLoop.ts` |
| Continuous voice (listen → think → speak) | `mobile/lib/offlineChat/liveConversation.ts` |
| Scan cross-check with Gemma | `mobile/lib/offlineChat/verifyScan.ts` |
| RAG + welcome + weather/time helpers | `mobile/lib/offlineNlu/retrieve.ts` |
| KB lookup / disease by name | `mobile/lib/offlineNlu/knowledgeBase.ts` |
| Offline treatment plan from KB | `mobile/lib/offlineNlu/offlineTreatment.ts` |
| Gemma load / completion | `mobile/lib/modelManager/llmEngine.ts` |
| Download catalog | `mobile/lib/modelManager/catalog.ts` |
| Bangla STT (silence-ended turns) | `mobile/lib/offlineVoice/sttEngine.ts` |
| TTS wrapper | `mobile/lib/offlineVoice/ttsEngine.ts` → `speakBangla.ts` |
| Bundled vision install paths | `mobile/lib/offlineVision/paths.ts` |
| Disease / tool inference | `*.native.ts` under `offlineVision/` |
| SQLite chat + history | `mobile/lib/offlineDb/` |
| Assistant UI | `mobile/app/(root)/(tabs)/assistant.tsx` |
| EAS upload excludes | `mobile/.easignore` |

---

## 4. Reply pipeline (how a turn works)

Implemented in `runLlmTurn()` (`chatLoop.ts`).

1. **Deterministic fast path** (`tryDeterministicReply`) — no LLM:
   - Pure greeting → `buildWelcomeBn()` (time-of-day + user first name)
   - Time question → device clock (`timeReplyBn`)
   - Weather question → RTK-cached weather or honest offline message
2. **Follow-up shortcut:** short affirmations (`হ্যাঁ` / `ঠিক`) after a disease-related turn → steer user to camera scan (no model waffle).
3. **Otherwise LLM:**
   - Pull RAG hits, optional recent scans, last ~4 chat lines
   - Build grounded prompt
   - Stream Gemma completion (Gemma 3 Instruct chat template)
   - Sanitize output (strip greeting spam, name theft, role tags)
4. Persist turns to SQLite; live mode speaks via `speakBangla`.

---

## 5. Prompts & grounding

### 5.1 Grounded Q&A prompt

Source: `buildGroundedPrompt()` in `mobile/lib/offlineChat/chatLoop.ts`.

Template (conceptual):

```text
তুমি আরণ্য, কৃষি সহকারী। সরাসরি উত্তর দাও।
নিয়ম: ১–২ ছোট বাংলা বাক্য। প্রশ্ন আবার লিখবে না।
অভিবাদন দিও না যদি প্রশ্ন অভিবাদন না হয়।
নাম জানা থাকলে নাম জিজ্ঞাসা করবে না। নিজেকে ব্যবহারকারীর নাম বলো না।
আগের কথোপকথন থাকলে সেই প্রসঙ্গে উত্তর দাও।
টমেটো/রোগ জিজ্ঞাসা হলে স্ক্যান/ছবির পরামর্শ দিতে পারো।
নাম: <firstName>                    # if logged in
তথ্য:
- <session / RAG / recent chat / scans>

প্রশ্ন: <user text>
উত্তর:
```

**Design rules baked into the prompt**

| Rule | Why |
|------|-----|
| 1–2 short Bangla sentences | Small GGUF models ramble otherwise |
| No greeting on non-greeting turns | Models copy “শুভ সকাল…” onto every answer |
| Address by name, never by profession | Stops “কৃষক / পেশা” role confusion |
| Prefer injected facts; don’t invent °C / doses | Safety + RAG honesty |

### 5.2 Welcome string (deterministic)

Source: `buildWelcomeBn()` in `retrieve.ts`.

Example: `শুভ সকাল, Faiyaj! আমি আরণ্য। <district>… কী জানতে চান?`

Time bands: সকাল / দুপুর / বিকেল / সন্ধ্যা (`timeOfDayGreetingBn`).

### 5.3 Gemma chat template

Source: `llmEngine.ts` → `completeOnce`.

```text
<start_of_turn>user
…grounded prompt…
<end_of_turn>
<start_of_turn>model
```

Optional short history turns may be prepended as prior `user` / `model` blocks.

### 5.4 Generation parameters

| Parameter | Typical value | Notes |
|-----------|---------------|--------|
| `n_ctx` | 2048 | Load-time context |
| `n_predict` | 120 | Caps reply length |
| `temperature` | ~0.55 (retry ~0.4) | Lower on echo retry |
| `stop` | `<end_of_turn>`, `<start_of_turn>`, … | Gemma IT stops |
| `n_threads` | 4 | CPU |
| `n_gpu_layers` | 0 | CPU-safe default on many devices |

### 5.5 Output sanitizer

`sanitizeAssistantReply()` strips:

- Role prefixes (`কৃষক:`, `আরণ্য:`, …)
- Copied welcome lines on non-greeting turns
- “আমার নাম …” / asking for name when already known
- Prompt-leak phrases (`তোমার পেশা নয়`, etc.)

### 5.6 Scan verify prompt

`verifyScan.ts` uses a short separate prompt: ask for `ok` / `uncertain` plus a one-line Bangla note, with KB facts for the label.

---

## 6. RAG-lite knowledge base

| Item | Location |
|------|----------|
| Runtime JSON | `mobile/assets/models/kb/bn_knowledge_base.json` |
| Retrieval | `retrieveContext(userText)` — keyword / token overlap |
| Sections | `diseases`, `tools`, `faq` |
| Rebuild | `cd ml && python knowledge_base/build_kb.py` |

**Behaviour**

- Returns up to ~4 short Bangla fact strings for the LLM (not shown as canned chat bubbles).
- Weather questions also get season tips and/or cached live weather.
- FAQ patterns (rain, temperature, fertilizer, greeting) expand grounding coverage.
- Offline treatment UI uses the same KB via `offlineTreatment.ts` (symptoms / treatment / prevention).

Have an agronomist review treatment text before production release.

---

## 7. Models & storage

### Catalog (`catalog.ts`)

| ID | Kind | Approx size | Notes |
|----|------|-------------|--------|
| `gemma3-270m-q8` | LLM | ~300 MB | Instruct GGUF (fast) |
| `gemma3-1b-it-q4` | LLM | ~690 MB | **Recommended** (better Bangla) |
| `stt-bn-zipformer` | STT | ~90 MB | Required for live mic |
| `tts-bn-vits` | TTS | ~110 MB | Listed; runtime speech uses **expo-speech** for stability |

**On device:** `FileSystem.documentDirectory + "models/<id>/..."`.

### Bundled with the app (APK)

| Asset | Path |
|-------|------|
| Disease TFLite | `assets/models/vision/crop_disease_int8.tflite` |
| Tool TFLite | `assets/models/vision/tool_detector_int8.tflite` |
| Class names | `assets/models/vision/class_names.json` |
| Knowledge base | `assets/models/kb/bn_knowledge_base.json` |

Copied into `documentDirectory/models/vision/` on boot (`ensureBundledVisionInstalled`).

---

## 8. Voice (live conversation)

Source: `liveConversation.ts` + `sttEngine.ts` + `speakBangla.ts`.

1. Optional spoken welcome (`greet: true` on empty chat).
2. `listenUntilSilence` — calibrate noise floor → detect speech → end after ~1.4 s silence.
3. Empty transcripts retry quietly (notice after repeated misses).
4. `runLlmTurn` → show text → `speakBangla` (sentence chunks, preferred Bangla system voice).
5. ~700 ms gap after TTS so the assistant’s own speech is not re-captured.

**Requirements:** development build (not Expo Go), STT model downloaded, mic permission. Emulators need host mic routing enabled.

---

## 9. Vision (disease / tools)

1. Photo captured in scan flow → `analyzing.tsx`.
2. Offline: TFLite classify/detect → structured result.
3. Result screen shows KB **লক্ষণ / চিকিৎসা / প্রতিরোধ** and can open offline treatment plan.
4. History detail loads local SQLite diagnosis and opens the same result UI.

---

## 10. Development setup

```bash
cd mobile
npm install --legacy-peer-deps   # or pnpm with allowBuilds for llama.rn / sherpa

# Environment
# EXPO_PUBLIC_API_URL=https://<your-api>/api

npx expo prebuild                # generate android/ if needed
npx expo run:android             # native dev client + install
npx expo start -c                # Metro (press a / scan QR for dev client)
```

Expo SDK **54** / React Native **0.81**. Offline AI **requires a custom/dev client** (native modules).

---

## 11. Build & APK commands

All commands from `mobile/` unless noted.

### A. Local debug APK (Gradle)

Fastest way to get an installable APK on a machine with Android SDK:

```bash
cd mobile

# Ensure native project exists
npx expo prebuild --platform android

cd android
.\gradlew.bat assembleDebug          # Windows
# ./gradlew assembleDebug            # macOS / Linux
```

**Output:**

```text
mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

Install:

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Release (local, needs signing config):

```bash
cd android
.\gradlew.bat assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
```

### B. Expo run (dev client on device/emulator)

```bash
cd mobile
npx expo run:android
```

Builds, installs, and starts Metro in one flow.

### C. EAS Build (cloud)

Profiles in `mobile/eas.json`:

| Profile | Artifact | Use |
|---------|----------|-----|
| `development` | APK + dev client | Internal testing with Metro |
| `preview` | APK | Internal distribution |
| `production` | AAB (`app-bundle`) | Play Store |

```bash
cd mobile
npm i -g eas-cli
eas login

# Development APK (dev client)
eas build --platform android --profile development

# Preview APK
eas build --platform android --profile preview

# Production App Bundle
eas build --platform android --profile production
```

Download the artifact from the EAS dashboard when the build finishes.

### D. Metro only (already installed app)

```bash
cd mobile
npx expo start -c
# press r to reload · a to open Android
```

---

## 12. EAS Build notes

Local `android/` Gradle outputs can be multi‑GB. **`mobile/.easignore`** excludes:

- `node_modules/`, `android/`, `ios/`, `.expo/`
- Large STT/TTS/ONNX/GGUF trees

And **keeps** bundled vision TFLite + KB.

If the upload shows ~1 GB+, confirm you are running `eas build` from `mobile/` and that `.easignore` is present. Cancel and retry after pulling the ignore file.

```bash
cd mobile
eas build --platform android --profile development
```

---

## 13. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| White screen on launch | Auth gate waiting on `/auth/me` | Fixed with timeout + spinner; check API URL |
| “মডেল নেই” | No GGUF downloaded | Model Manager → download recommended Gemma |
| Mic / “ঠিক শুনতে পাইনি” | No STT model or dead mic | Download STT; check mic permission / emulator host audio |
| Every reply starts with “শুভ সকাল…” | Stale bundle / old prompt | Reload; greetings are deterministic-only now |
| History has no treatment text | Old read-only result UI | Open history item again — KB advice + treatment plan |
| EAS upload huge | `android/build` included | Use `.easignore`; build from `mobile/` |
| App crash on boot (abort) | Sherpa TTS init | TTS uses expo-speech; do not eager-init sherpa TTS |
| Vision “নেই” | Bundled assets not copied | Ensure TFLite files under `assets/models/vision/` and rebuild |

---

## Quick checklist

- [ ] `npm install` in `mobile/`
- [ ] Dev client: `npx expo run:android` or EAS `development` profile
- [ ] Vision TFLite + KB present under `assets/models/`
- [ ] Download **Gemma 1B Instruct** (or 270M) + **Bangla STT**
- [ ] Test সহকারী: greeting, time, weather, disease follow-up, live mic
- [ ] Local APK: `cd android && gradlew assembleDebug`
- [ ] Cloud APK: `eas build -p android --profile preview`

For training pipelines and agronomist review of KB text, see [`ml/README.md`](../../ml/README.md) and [`docs/model_cards/`](../model_cards/).
