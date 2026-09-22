# Offline AI — implementation status (models not bundled)

Gemini = online. Everything below works **without** trained weights checked in; drop models later per `mobile/assets/models/DROP_MODELS_HERE.md`.

## Done in app code

| Sprint | Status |
|--------|--------|
| 0 Setup | `ml/`, KB, folders, gitignore |
| 1 Voice I/O wiring | Offline path in `scan/voice.tsx`; STT/TTS engines (native when present, else type / `expo-speech`) |
| 2 Model Manager + chat | `models` screen, `assistant` (text + mic), catalog, download/delete, `llmEngine`, RAG-lite `retrieve.ts`, boot `OfflineAiBootstrap` |
| 3–4 Vision wiring | `analyzing.tsx` offline disease/tool; TFLite loaders wait for your `.tflite` files |
| 5 Debug | Profile → অফলাইন ডিবাগ (`offline-debug`) local latency log |

## You still train / download

1. **Gemma** — Model Manager (or HF) → `documentDirectory/models/gemma3-*/`
2. **STT/TTS** — Model Manager + sherpa-onnx native bridge (`modules/offline-ai`) on next native rebuild
3. **Vision** — train in `ml/`, copy `.tflite` + `class_names.json` → `models/vision/`

## Install native deps (once)

```bash
cd mobile
pnpm install
# rebuild expo-dev-client after first install of llama.rn / fast-tflite
```

Packages added to `package.json`: `llama.rn`, `react-native-blob-util`, `react-native-fast-tflite`, `expo-image-manipulator`.
