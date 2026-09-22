# Offline AI — Setup, Usage & Architecture

**Aronno** runs two complementary AI paths:

| Path | When | Engine | Cost |
|------|------|--------|------|
| **Online** | Device has internet | Nest.js → Gemini Flash-Lite | Free tier API (existing backend) |
| **Offline** | No internet, or Gemini fails | On-device Gemma + sherpa-onnx + TFLite | Free forever after one-time download |

This document covers the **offline** path only: setup, how farmers use it, where each piece of logic lives, system prompts, and how we keep prompts short so small on-device models stay fast and accurate.

> General app install (MongoDB, API, Expo Go): see [SETUP.md](../SETUP.md) and the root [README.md](../README.md).

---

## Table of contents

1. [Design principles](#1-design-principles)
2. [Architecture](#2-architecture)
3. [Repository map (where logic lives)](#3-repository-map-where-logic-lives)
4. [Native setup (required once)](#4-native-setup-required-once)
5. [How to use in the app](#5-how-to-use-in-the-app)
6. [Model catalog & storage](#6-model-catalog--storage)
7. [System prompts & reply shaping](#7-system-prompts--reply-shaping)
8. [Token & latency optimization](#8-token--latency-optimization)
9. [Knowledge base (RAG-lite)](#9-knowledge-base-rag-lite)
10. [Vision models (train & import)](#10-vision-models-train--import)
11. [Online vs offline routing](#11-online-vs-offline-routing)
12. [Debug & metrics](#12-debug--metrics)
13. [Licenses](#13-licenses)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Design principles

1. **Gemini stays the high-accuracy online path** — treatment depth, PDF reports, history sync unchanged.
2. **Offline chat is a real generative model (Gemma 3 GGUF)**, not a scripted FAQ bot.
3. **Agronomist facts ground the model** — `bn_knowledge_base.json` is injected into the prompt (RAG-lite). Wrong pesticide doses must not be invented.
4. **Models are opt-in downloads** — never bundled in the APK (250 MB–2.5 GB). Users delete them anytime.
5. **Vision ≠ LLM** — crop disease / tool ID use small TFLite classifiers/detectors; the LLM only *talks about* results.
6. **Bangla-first** — STT, TTS, system prompt, and UI copy prefer simple Bangla.

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  MODEL MANAGER  (download / delete / import)                     │
│  Gemma GGUF · Bangla STT/TTS ONNX · TFLite vision (sideload)   │
└──────────────────────────────────────────────────────────────────┘
                                  │
┌──────────────────────────────────────────────────────────────────┐
│  VOICE CHAT (সহকারী)                                             │
│  Mic ──▶ sherpa-onnx STT (Bangla) ──▶ text                       │
│            │                                                     │
│            ▼                                                     │
│  retrieveContext()  ← bn_knowledge_base.json (≤3 facts)          │
│            │                                                     │
│            ▼                                                     │
│  Gemma (llama.rn) ── stream tokens ──▶ sentence TTS (sherpa)     │
│                                      └─ fallback: expo-speech    │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  SCAN (disease / tool)                                           │
│  online? ──yes──▶ Gemini (backend)                               │
│          └──no──▶ TFLite (if installed) else KB name match       │
│                   └── same result UI (DiagnosisResult / ToolResult)│
└──────────────────────────────────────────────────────────────────┘
```

**Boot:** `OfflineAiBootstrap` tries to load any already-downloaded LLM / STT / TTS into memory when the app starts.

---

## 3. Repository map (where logic lives)

### Mobile app (`mobile/`)

| Concern | Path | Responsibility |
|---------|------|----------------|
| Model catalog (URLs, sizes, kinds) | `lib/modelManager/catalog.ts` | Single source of truth for downloadable models |
| Download / delete / install check | `lib/modelManager/modelManager.ts` | `expo-file-system/legacy` resumable downloads into `documentDirectory/models/` |
| Gemma load + stream | `lib/modelManager/llmEngine.ts` | `llama.rn` `initLlama` / `completion` (`n_predict: 256`, `temperature: 0.4`) |
| Chat loop (STT → LLM → TTS) | `lib/offlineChat/chatLoop.ts` | System prompt, grounding, sentence-chunked speak |
| RAG-lite retrieval | `lib/offlineNlu/retrieve.ts` | Keyword match → ≤3 Bangla fact strings |
| KB loader | `lib/offlineNlu/knowledgeBase.ts` | Typed access to bundled JSON |
| Offline transcript → diagnosis/tool | `lib/offlineNlu/offlineMatch.ts` | Fallback when TFLite missing |
| Bangla STT | `lib/offlineVoice/sttEngine.ts` | `@siteed/sherpa-onnx.rn` ASR |
| Bangla TTS | `lib/offlineVoice/ttsEngine.ts` | Sherpa VITS + `expo-speech` fallback |
| Disease TFLite | `lib/offlineVision/diseaseModel.ts` | INT8 classifier → `DiagnosisResult` |
| Tool TFLite | `lib/offlineVision/toolModel.ts` | YOLO-style detector → `ToolResult` |
| Vision paths / sideload | `lib/offlineVision/paths.ts`, `importModel.ts` | Runtime `models/vision/` + document picker |
| Latency log | `lib/offline/metrics.ts` | Local only — never sent to server |
| Online/offline flag | `hooks/useIsOnline.ts` | Shared NetInfo helper |
| Boot autoload | `components/OfflineAiBootstrap.tsx` | Called from `app/_layout.tsx` |
| Chat UI | `app/(root)/(tabs)/assistant.tsx` | Tab **সহকারী** |
| Model Manager UI | `app/(root)/(tabs)/models.tsx` | Hidden tab; open from Profile / assistant |
| Scan offline branch | `app/(root)/(tabs)/scan/analyzing.tsx` | Gemini → offline fallback |
| Voice capture offline | `app/(root)/(tabs)/scan/voice.tsx` | Offline STT or type-to-submit |
| Debug screen | `app/(root)/offline-debug.tsx` | Profile → অফলাইন ডিবাগ |
| Bundled KB | `assets/models/kb/bn_knowledge_base.json` | Committed (tiny) |
| Drop / import notes | `assets/models/DROP_MODELS_HERE.md` | Farmer/dev drop paths |

### Training (`ml/`)

| Path | Purpose |
|------|---------|
| `ml/disease_classifier/` | PlantVillage train → INT8 TFLite export |
| `ml/tool_detector/` | YOLOv8n train → INT8 TFLite |
| `ml/knowledge_base/` | CSV → `bn_knowledge_base.json` |
| `ml/README.md` | Colab / local training commands |

### Docs

| Path | Purpose |
|------|---------|
| `docs/offline_ai/README.md` | This guide |
| `docs/model_cards/` | Per-model honesty: accuracy, limits, license |

---

## 4. Native setup (required once)

Offline AI uses **native modules**. Expo Go is not enough — use a **development build**.

### Prerequisites

- Node 20+ · pnpm · Android Studio (or EAS)
- Expo SDK 54 project already under `mobile/`

### Install & rebuild

```bash
cd mobile
pnpm install

# Allow postinstall scripts for native binaries when pnpm asks:
#   @siteed/sherpa-onnx.rn  → true
#   llama.rn                → true
# (see mobile/pnpm-workspace.yaml → allowBuilds)

npx expo prebuild
npx expo run:android
# or: eas build --profile development --platform android
```

### Packages (already in `package.json`)

| Package | Role |
|---------|------|
| `llama.rn` | On-device Gemma GGUF |
| `@siteed/sherpa-onnx.rn` | Bangla STT + TTS |
| `react-native-fast-tflite` | Vision INT8 models |
| `expo-image-manipulator` | Resize photos for TFLite |
| `expo-document-picker` | Import trained `.tflite` files |
| `expo-file-system` | Model downloads (`/legacy` resumable API) |

Plugins are registered in `mobile/app.json` (`llama.rn`, `@siteed/sherpa-onnx.rn`, `react-native-fast-tflite`, `expo-document-picker`).

---

## 5. How to use in the app

### A. Download models (Wi‑Fi recommended)

1. Open **আমি (Profile)** → **অফলাইন এআই** → **মডেল ম্যানেজার**  
   — or from **সহকারী** when no LLM is loaded.
2. Download in this order (recommended):
   1. **জেমা ৩ (ছোট)** — chatbot brain (~300 MB)
   2. **বাংলা কণ্ঠ শনাক্তকরণ** — STT (~90 MB)
   3. **বাংলা কণ্ঠস্বর** — TTS (~110 MB; optional; OS TTS works without it)
3. After Gemma finishes, it **auto-loads**. Status shows on the same screen.
4. **মুছুন** frees storage and unloads that model.

### B. Talk offline (সহকারী tab)

1. Type Bangla and send, **or** tap the mic (needs STT model).
2. Partial / final transcript appears as a user bubble.
3. Gemma streams the reply; speech starts **per sentence** (does not wait for the full answer).
4. If no LLM: the screen prompts you to open Model Manager.

### C. Scan disease / tool offline

1. Use the normal **স্ক্যান** flow (photo or voice transcript).
2. If **offline** (or online Gemini fails):
   - Photo + TFLite present → on-device classify/detect
   - Else transcript/KB name match → structured result without market listings
3. Same result screens as online (`DiagnosisResult` / offline `ToolResult`).

### D. Import vision weights (after you train)

On Model Manager (bottom section):

- Import `crop_disease_int8.tflite`
- Import `tool_detector_int8.tflite`
- Import `class_names.json` (optional override of bundled starter)

---

## 6. Model catalog & storage

Defined in `mobile/lib/modelManager/catalog.ts`.

| ID | Kind | Approx size | Source |
|----|------|-------------|--------|
| `gemma3-270m-q8` | LLM (recommended) | ~300 MB | Hugging Face GGUF |
| `gemma3-1b-q4` | LLM | ~700 MB | Hugging Face GGUF |
| `stt-bn-zipformer` | STT | ~90 MB | HF multi-file ONNX (no tar.bz2) |
| `tts-bn-vits` | TTS | ~110 MB | HF VITS coqui BN (`model.onnx` + `tokens.txt`) |

**On device:** `FileSystem.documentDirectory + "models/<id>/..."`.

**Bundled only:** `assets/models/kb/bn_knowledge_base.json` (and a starter `class_names.json`). Large binaries are gitignored.

To add Gemma 4B later: append a catalog entry (or serve a remote catalog JSON — planned upgrade).

---

## 7. System prompts & reply shaping

### System prompt (Bangla)

Source: `mobile/lib/offlineChat/chatLoop.ts` → `SYSTEM_PROMPT_BN`

```
তুমি আরণ্য, বাংলাদেশের কৃষকদের জন্য একজন সহায়ক কৃষি সহকারী।
সবসময় সহজ, সংক্ষিপ্ত বাংলায় উত্তর দাও। নিচের তথ্য সঠিক হিসেবে ব্যবহার করো,
এর বাইরে অনুমান করে ওষুধ বা মাত্রা বলো না, অনিশ্চিত হলে কৃষি সম্প্রসারণ অফিসে যোগাযোগের পরামর্শ দাও।
```

Intent:

- Stay in simple Bangla  
- Prefer KB facts over free invention  
- Refuse to invent pesticide doses  
- Defer to extension officers when unsure  

### Full user message shape

Built by `buildGroundedPrompt()`:

```
[SYSTEM_PROMPT_BN]

প্রাসঙ্গিক তথ্য:
<up to 3 retrieved Bangla fact lines>

কৃষকের প্রশ্ন: <user text>
```

Empty context section is omitted (no wasted tokens).

### Generation parameters

Source: `mobile/lib/modelManager/llmEngine.ts` → `streamLlmReply`

| Parameter | Value | Why |
|-----------|-------|-----|
| `n_ctx` | 2048 | Fits phone RAM; enough for short agri Q&A |
| `n_predict` | **256** | Caps answer length (token budget) |
| `temperature` | **0.4** | Lower = fewer hallucinations vs grounding |
| `stop` | `<end_of_turn>` | Clean stop for Gemma chat format |
| `n_threads` | 4 | Mid-range Android default |
| `n_gpu_layers` | 99 | Use GPU/NPU when the device supports it |

---

## 8. Token & latency optimization

Small on-device models are slow if prompts are huge. Aronno keeps the **prompt short** and the **reply short**, and starts audio early.

| Technique | Where | Effect |
|-----------|--------|--------|
| Cap retrieval at **3** KB hits | `retrieve.ts` / `buildGroundedPrompt` | Less context → faster first token |
| Keyword RAG-lite (no embedding model) | `retrieve.ts` | Zero extra model RAM for retrieval |
| `n_predict: 256` | `llmEngine.ts` | Hard ceiling on generated tokens |
| Low temperature `0.4` | `llmEngine.ts` | Shorter, more factual answers |
| Concise Bangla system prompt | `chatLoop.ts` | Instructs “সংক্ষিপ্ত” answers |
| Sentence-chunked TTS | `chatLoop.ts` + `streamOffline` | Speak on `।.!?<unk>` — user hears audio while generation continues |
| Stream tokens to UI | `assistant.tsx` | Feels realtime without waiting for full text |
| Prefer Gemma **270M** by default | catalog `recommended` | Smaller model = fewer tokens/sec needed for usable UX |
| STT/TTS multi-file HF download | `catalog.ts` | No tar.bz2 extract on device |
| Vision separate from LLM | TFLite loaders | Classification in ~100 ms class, not generative tokens |
| Local metrics only | `lib/offline/metrics.ts` | Profile latency without network cost |

**Honest expectation:** 270M Bangla is simpler than cloud Gemini; 1B is better but heavier. Grounding is what keeps advice safer either way.

---

## 9. Knowledge base (RAG-lite)

| Item | Location |
|------|----------|
| Runtime JSON | `mobile/assets/models/kb/bn_knowledge_base.json` |
| Source CSV | `ml/knowledge_base/disease_treatment_bn.csv` |
| Builder | `ml/knowledge_base/build_kb.py` |

```bash
cd ml
python knowledge_base/build_kb.py
# writes mobile/assets/models/kb/bn_knowledge_base.json
```

Schema sections: `diseases`, `tools`, `faq`.

**Important:** FAQ entries are **not** shown as canned chat bubbles. They become optional grounding lines when patterns match. The LLM still generates the spoken/written reply.

Have an agronomist review treatment text before production — wrong doses cause real harm.

---

## 10. Vision models (train & import)

Code is ready; weights are **not** shipped until you train.

```bash
cd ml
python -m venv venv
# activate venv
pip install -r requirements.txt
# See ml/README.md for PlantVillage / YOLO steps
```

After export:

1. Copy `crop_disease_int8.tflite`, `tool_detector_int8.tflite`, `class_names.json`
2. Import via Model Manager, **or** place under `documentDirectory/models/vision/`

Model honesty cards: `docs/model_cards/crop_disease.md`, `tool_detector.md`.

---

## 11. Online vs offline routing

| Screen / flow | Online | Offline |
|---------------|--------|---------|
| Disease / tool photo or voice → `analyzing.tsx` | Gemini via Nest API | TFLite and/or KB match |
| Scan voice capture `voice.tsx` | Cloud STT (backend) | Sherpa STT if downloaded; else type |
| সহকারী chat | N/A (offline product) | Gemma + grounding + TTS |
| Receipts / PDF / history sync | Backend required | Not available offline |

`OfflineBanner` (root layout) and `useIsOnline` / `fetchIsOnline` drive the branch.

---

## 12. Debug & metrics

**আমি → অফলাইন ডিবাগ**

- Shows whether LLM / STT / TTS / vision files are ready  
- Lists recent local events: `llm.autoload`, `stt.recognize`, `chat.llm`, `vision.disease.infer`, etc.  
- Data stays on device (`lib/offline/metrics.ts`)

---

## 13. Licenses

| Component | License note |
|-----------|----------------|
| Gemma 3 | Google Gemma Terms — free to use incl. commercial; keep notice in-app |
| sherpa-onnx models / runtime | Apache-2.0 / MIT (see model cards) |
| Ultralytics YOLOv8 (training) | AGPL-3.0 — confirm with your team before distribution |
| Aronno app code | MIT (repo root `LICENSE`) |

---

## 14. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| “মডেল দরকার” forever | No GGUF downloaded or native module missing | Download Gemma; rebuild with `expo-dev-client` |
| Mic does nothing offline | STT not downloaded / sherpa not linked | Download STT; rebuild native app |
| TTS is robotic / OS voice | VITS not downloaded | Download TTS, or keep expo-speech fallback |
| Offline scan fails | No `.tflite` and no disease name in transcript | Train + import vision, or speak/type disease name matching KB |
| Download stuck | No Wi‑Fi / HF blocked | Retry on Wi‑Fi; check progress % on Model Manager |
| `pnpm` build script ignored | `allowBuilds` | Enable `@siteed/sherpa-onnx.rn` and `llama.rn` in `pnpm-workspace.yaml` |

---

## Quick checklist

- [ ] `pnpm install` + allow native postinstalls  
- [ ] `npx expo prebuild` && `npx expo run:android` (or EAS)  
- [ ] Download Gemma 270M (+ STT/TTS)  
- [ ] Confirm **সহকারী** answers offline  
- [ ] (Later) Train & import vision TFLite  
- [ ] Agronomist review of `bn_knowledge_base.json`  

For training details: [`ml/README.md`](../ml/README.md). For model honesty: [`docs/model_cards/`](../model_cards/).
