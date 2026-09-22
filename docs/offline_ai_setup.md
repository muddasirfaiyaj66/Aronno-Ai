# Offline AI setup (updated — on-device Gemma LLM)

Gemini stays the **online** high-accuracy path. Offline path is a **real generative model** (Gemma 3 GGUF via `llama.rn`), grounded by `bn_knowledge_base.json` (RAG-lite), plus sherpa-onnx voice and TFLite vision.

## Layout

```
ml/                              # training (disease, tools, KB CSV)
mobile/lib/offlineVoice/         # STT/TTS stubs (+ bridge to modelManager)
mobile/lib/offlineNlu/           # knowledgeBase + retrieve.ts (LLM grounding)
mobile/lib/offlineChat/          # chatLoop: STT → LLM → TTS streaming
mobile/lib/modelManager/         # catalog, download/delete, llmEngine
mobile/lib/offlineVision/        # TFLite wrappers (Sprint 3–4)
mobile/app/(root)/(tabs)/
  assistant.tsx                  # realtime Bangla voice chat tab
  models.tsx                     # Model Manager (hidden from tab bar; open from assistant/profile)
mobile/assets/models/kb/         # bn_knowledge_base.json (bundled; tiny)
mobile/modules/offline-ai/       # sherpa-onnx native bridge (Sprint 1)
docs/model_cards/                # per-model one-pagers
```

## Install (Sprint 2)

```bash
cd mobile
pnpm add llama.rn react-native-blob-util
# optional: pnpm add @react-native-ai/llama ai
pnpm add react-native-fast-tflite expo-image-manipulator   # vision sprints
```

Rebuild the **dev client** after adding native modules (`eas build` / `npx expo prebuild`).

## Flow

1. User opens **মডেল ম্যানেজার** → downloads Gemma (+ optional STT/TTS).
2. `autoLoadLlm()` loads the GGUF into RAM.
3. **সহকারী** tab: mic → offline STT → `retrieveContext` + Gemma stream → sentence TTS.
4. Online screens still call Nest/Gemini unchanged.

## Next sprints

1. Sprint 1 — sherpa-onnx native STT/TTS  
2. Sprint 2 — finish `llama.rn` install + field-test Model Manager  
3. Sprint 3–4 — train/export TFLite vision models  

See `ml/README.md` for training. Gemma license notice belongs on an About/Licenses screen before store release.
