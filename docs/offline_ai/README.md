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
| Text-to-speech | Device TTS (`expo-speech`) with a downloaded Bangla system voice | OS voices |
| Disease / tool scan | INT8 TFLite first; **Gemma 3 4B + mmproj** vision fallback | TFLite **yes**; Gemma download |
| Bangla receipt (offline) | Gemma 3 4B multimodal (`mmproj-F16`) | No — needs 4B vision pack |
| Agronomist facts (RAG) | `bn_knowledge_base.json` | **Yes** — small JSON |

**Product surface:** tab **সহকারী** (`assistant.tsx`) for chat + live voice + **chat sessions** (নতুন / ইতিহাস / মুছুন); **ইতিহাস** tab for scan records with per-row **মুছুন**; **স্ক্যান** for photo/voice diagnosis; **মডেল ম্যানেজার** for LLM/STT downloads.

**Boot policy:** `OfflineAiBootstrap` initializes SQLite and copies bundled vision models. It does **not** eagerly load Gemma or Sherpa TTS (avoids SIGABRT / crash loops). LLM and STT load on first use.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Model Manager (catalog.ts + modelManager.ts)               │
│  Download Gemma GGUF (+ mmproj for 4B) · Bangla STT ONNX    │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│  সহকারী (assistant)                                         │
│                                                             │
│  Typed / live mic                                           │
│       ▼                                                     │
│  answerByIntent() ── greeting / time / weather / KB FAQ     │
│       │ no match                                            │
│       ▼                                                     │
│  retrieveContext() — if empty → “নিশ্চিত তথ্য নেই” (no guess)│
│       ▼                                                     │
│  buildGroundedPrompt() → Gemma stream → sanitize            │
│       ▼                                                     │
│  SQLite chat_sessions + chat_turns (নতুন / ইতিহাস / মুছুন)   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  স্ক্যান (analyzing)                                         │
│  Online → Gemini API                                        │
│  Offline disease/tool → TFLite → else Gemma vision → KB     │
│  Offline receipt → Gemma vision (4B+mmproj) or clear error  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Code map

| Concern | Path |
|---------|------|
| Chat loop, grounded prompts, skip-unknown | `mobile/lib/offlineChat/chatLoop.ts` |
| Deterministic / KB intents (greetings, FAQ, disease) | `mobile/lib/offlineChat/intents.ts` |
| Active chat session + topic memory | `mobile/lib/offlineChat/sessionStore.ts` |
| Continuous voice (listen → think → speak) | `mobile/lib/offlineChat/liveConversation.ts` |
| Scan cross-check with Gemma (KB-first) | `mobile/lib/offlineChat/verifyScan.ts` |
| RAG + welcome + weather/time helpers | `mobile/lib/offlineNlu/retrieve.ts` |
| KB lookup / disease by name | `mobile/lib/offlineNlu/offlineMatch.ts` |
| Offline treatment plan from KB | `mobile/lib/offlineNlu/offlineTreatment.ts` |
| Gemma load / text + vision completion | `mobile/lib/modelManager/llmEngine.ts` |
| Download catalog (incl. 4B + mmproj) | `mobile/lib/modelManager/catalog.ts` |
| Bangla STT (silence-ended turns) | `mobile/lib/offlineVoice/sttEngine.ts` |
| TTS wrapper | `mobile/lib/offlineVoice/ttsEngine.ts` → `speakBangla.ts` |
| Bundled vision install paths | `mobile/lib/offlineVision/paths.ts` |
| Disease / tool TFLite | `offlineVision/diseaseModel*.ts`, `toolModel*.ts` |
| Gemma multimodal disease / tool / receipt | `mobile/lib/offlineVision/gemmaVision.ts` |
| SQLite sessions + chat + scan history | `mobile/lib/offlineDb/` |
| Assistant UI (history sheet) | `mobile/app/(root)/(tabs)/assistant.tsx` |
| Scan history UI (delete) | `mobile/app/(root)/(tabs)/history/index.tsx` |
| EAS profiles (standalone APK vs dev-client) | `mobile/eas.json` |
| EAS upload excludes | `mobile/.easignore` |

---

## 4. Reply pipeline (how a turn works)

Implemented in `runLlmTurn()` (`chatLoop.ts`).

1. **Intent / KB first** (`answerByIntent` in `intents.ts`) — no LLM when possible:
   - Greeting, how-are-you, time, date, thanks, bye, who-am-I
   - Weather / rain / temperature from cache
   - Named disease, crop+symptoms, fertilizer FAQ from `bn_knowledge_base.json`
   - Follow-ups on prior topic (treatment / prevention / “হ্যাঁ” → scan)
2. **RAG-first, model-assisted:** reviewed local facts take priority. If RAG is
   empty, the local model may still give general, non-prescriptive farming
   guidance; it must not invent pesticide doses, market prices, or live weather
   numbers.
3. **LLM response:**
   - Pull RAG hits and optional recent scans; include earlier chat only when the
     farmer explicitly refers to it
   - `buildGroundedPrompt()` — RAG-first answer with safe general model guidance
   - Stream Gemma (Gemma 3 Instruct template); low temperature
   - Sanitize output
4. Persist to `chat_sessions` / `chat_turns`; live mode speaks via `speakBangla`.

### Chat sessions (UI)

| Action | Where |
|--------|--------|
| নতুন আলোচনা | Assistant header **নতুন** |
| আগের আলোচনা | Header **ইতিহাস** → sheet |
| মুছুন (one session) | Sheet row trash |
| বর্তমান আলোচনা মুছুন | Sheet top action |
| স্ক্যান ইতিহাস মুছুন | **ইতিহাস** tab → row **মুছুন** |

---

## 5. Prompts & grounding

### 5.1 Grounded Q&A prompt

Source: `buildGroundedPrompt()` in `mobile/lib/offlineChat/chatLoop.ts`.

Template (conceptual):

```text
আপনি আরণ্য — বাংলাদেশের কৃষকদের জন্য নির্ভরযোগ্য কৃষি সহায়ক।
নির্ভরযোগ্য তথ্য থাকলে সেটিকে অগ্রাধিকার দিন। ‘অ্যাপের বর্তমান ডেটা’ থাকলে তার সংখ্যা ও অবস্থান হুবহু ব্যবহার করুন। তথ্য না থাকলে সাধারণ কৃষি জ্ঞান দিয়ে নিরাপদ উত্তর দিন।
প্রমাণ ছাড়া ওষুধের মাত্রা, বাজারদর বা লাইভ আবহাওয়ার সংখ্যা বলবেন না।
প্রশ্ন আবার লিখবেন না। অপ্রাসঙ্গিক অভিবাদন নয়।
উত্তর: ১–৩টি সংক্ষিপ্ত বাংলা বাক্য।
কৃষকের নাম: <firstName>              # if logged in
সহায়ক তথ্য:
- <RAG / scans / explicitly requested prior context>
- <current app data such as cached weather, when relevant>

কৃষকের প্রশ্ন: <user text>
উত্তর:
```

**Design rules**

| Rule | Why |
|------|-----|
| RAG facts override model knowledge | Keeps reviewed local advice consistent |
| General answer when facts are empty | Keeps the assistant useful while avoiding prescriptions |
| Short Bangla | Small GGUFs ramble otherwise |
| No greeting on non-greeting turns | Models copy “শুভ সকাল…” onto every answer |

### 5.2 Welcome string (deterministic)

Source: `buildWelcomeBn()` in `retrieve.ts` — time + optional name/district/weather; no marketing “AI vibe” fluff.

### 5.3 Gemma chat template

Source: `llmEngine.ts` → `completeOnce`.

```text
<start_of_turn>user
…grounded prompt…
<end_of_turn>
<start_of_turn>model
```

Session history may be prepended as prior `user` / `model` blocks.

### 5.4 Generation parameters

| Parameter | Typical value | Notes |
|-----------|---------------|--------|
| `n_ctx` | 2048 (text) / **4096** (vision 4B) | Multimodal needs more room |
| `n_predict` | ~160 text / ~220 vision | Caps reply length |
| `temperature` | ~0.25 (retry ~0.15) | Accuracy over creativity |
| `ctx_shift` | `false` when mmproj loaded | Required for media tokens |
| `stop` | `<end_of_turn>`, `<start_of_turn>`, … | Gemma IT stops |
| `n_threads` | 4 | CPU |
| `n_gpu_layers` | 0 | CPU-safe default |

### 5.5 Multimodal (vision)

Source: `llmEngine.streamLlmVisionReply` + `gemmaVision.ts`.

1. Load `gemma3-4b-it-q4` (GGUF + `mmproj-F16.gguf`).
2. `initMultimodal({ path: mmproj, use_gpu: false, image_max_tokens: 256 })`.
3. `completion({ messages: [{ role, content: [text, image_url] }] })`.

### 5.6 Output sanitizer

`sanitizeAssistantReply()` strips role prefixes, copied welcomes, name leaks, and prompt tags.

### 5.7 Scan verify prompt

`verifyScan.ts` — KB-first explanation; short `ok` / `uncertain` check when LLM ready.

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
| `gemma3-1b-it-q4` | LLM | ~690 MB | **Recommended** default (better Bangla) |
| `gemma3-4b-it-q4` | LLM + vision | ~3.3 GB | GGUF `Q4_K_M` + `mmproj-F16`; disease/tool/receipt offline images via llama.rn |
| `qwen25-vl-3b-it-q4` | LLM + vision | ~3.27 GB | Qwen2.5-VL 3B `Q4_K_M` + `mmproj-F16`; optional Bangla-capable vision model, validate on farmer photos before production use |
| `stt-bn-zipformer` | STT | ~90 MB | Required for live mic |
| Device Bangla TTS voice | TTS | OS-managed | Install it in the phone's text-to-speech settings; runtime uses it for stable offline speech |

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

**Requirements:** development build (not Expo Go), STT model downloaded, mic permission, and a Bangla **offline** system TTS voice installed in Android/iOS settings. Emulators need host mic routing enabled. The app must not advertise a downloaded VITS TTS pack as active while the runtime is using the device voice.

---

## 9. Vision (disease / tools / receipt)

1. Photo captured in scan flow → `analyzing.tsx`.
2. **Disease / tool offline order:**
   1. Bundled TFLite (`classifyLeaf` / `detectTool`)
   2. Else Gemma multimodal (`gemmaVision.ts`) if 4B+mmproj installed
   3. Else transcript KB match
3. Result screen shows KB **লক্ষণ / চিকিৎসা / প্রতিরোধ**.
4. **Receipt offline:** `scanReceiptWithGemma` → `receipt-result` with `offline=1` params (no server id).
5. **ইতিহাস** tab lists local diagnoses; each row has **মুছুন** (`deleteLocalDiagnosis`).

Requires **জেমা ৩ · ৪বি (লেখা + ছবি)** from Model Manager for Gemma vision paths (~3.3 GB, ~7 GB RAM).

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
| `development` | **Standalone APK** (JS bundled) | Install & run without Metro / Expo Go |
| `preview` | Standalone APK | Same as development; internal QA |
| `dev-client` | Dev-client APK | Hot reload with `npx expo start` |
| `production` | AAB (`app-bundle`) | Play Store |

```bash
cd mobile
npm i -g eas-cli
eas login

# Real installable APK (no Expo sandbox / no Metro required)
eas build --platform android --profile development

# Same style APK for QA
eas build --platform android --profile preview

# Only if you need Metro hot reload
eas build --platform android --profile dev-client

# Production App Bundle
eas build --platform android --profile production
```

Download the **.apk** from the EAS dashboard when the build finishes, then install on the phone (enable “Install unknown apps” if asked).

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
| No delete on history | — | ইতিহাস tab row **মুছুন**; chat → header **ইতিহাস** sheet |
| Chat answers unrelated / invents facts | Weak grounding | Intent+KB first; empty RAG → skip; use 1B/4B |
| Offline receipt fails | No multimodal Gemma | Download **জেমা ৩ · ৪বি (লেখা + ছবি)** (GGUF+mmproj) |
| APK needs Expo / Metro | Built with old `developmentClient` | Use profile `development` or `preview` (standalone); `dev-client` only for hot reload |
| EAS upload huge | `android/build` included | Use `.easignore`; build from `mobile/` |
| EAS `npm ci` fails (Install dependencies) | Stale `package-lock.json` vs `package.json` (e.g. BLE pin) | Use **pnpm only**: delete `package-lock.json`; keep `pnpm-lock.yaml` + `"packageManager": "pnpm@…"` |
| EAS canceled at ~45m on `Run gradlew` | Compiling llama/reanimated/sherpa for **4 ABIs** | `ORG_GRADLE_PROJECT_reactNativeArchitectures=arm64-v8a` on development/preview |
| Local `sdk.dir … Directory does not exist` | Bad `android/local.properties` | Set `ANDROID_HOME` / fix `sdk.dir=C:\\Users\\…\\Android\\Sdk` (Windows). Or delete `android/` and `npx expo prebuild` |
| App crash on boot (abort) | Sherpa TTS init | TTS uses expo-speech; do not eager-init sherpa TTS |
| Vision “নেই” | Bundled assets not copied | Ensure TFLite files under `assets/models/vision/` and rebuild |

---

## Quick checklist

- [ ] `pnpm install` in `mobile/`
- [ ] Standalone APK: `eas build -p android --profile development` (or `preview`)
- [ ] Dev hot-reload only: `eas build -p android --profile dev-client` then `npx expo start`
- [ ] Vision TFLite + KB present under `assets/models/`
- [ ] Download **Gemma 1B** (chat) and/or **Gemma 4B + mmproj** (vision/receipt) + **Bangla STT**
- [ ] Test সহকারী: intent answers, skip-unknown, নতুন / ইতিহাস / মুছুন
- [ ] Test ইতিহাস tab delete; offline disease → TFLite; receipt offline with 4B
- [ ] Local debug APK (optional): `cd android && gradlew assembleDebug`

For training pipelines and agronomist review of KB text, see [`ml/README.md`](../../ml/README.md) and [`docs/model_cards/`](../model_cards/).
