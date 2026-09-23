# Offline model assets

## Bundled with the APK (committed)

| Path | Content | Approx size |
|------|---------|-------------|
| `vision/crop_disease_int8.tflite` | Disease classifier (INT8) | ~1.2 MB |
| `vision/tool_detector_int8.tflite` | Tool detector (INT8) | ~3 MB |
| `vision/class_names.json` | Disease class labels | tiny |
| `kb/bn_knowledge_base.json` | Agronomist facts for RAG + treatment UI | small |

These are installed to `documentDirectory/models/vision/` on first boot.

## Downloaded on device (Model Manager)

| Runtime path | Content | Approx size |
|--------------|---------|-------------|
| `models/gemma3-*/` | Gemma 3 Instruct GGUF (270M / 1B / **4B+mmproj vision**) | 300 MB – 3.3 GB |
| `models/stt-bn-zipformer/` | Bangla streaming STT (ONNX) | ~90 MB |
| `models/tts-bn-vits/` | Optional VITS (UI catalog; speech uses expo-speech) | ~110 MB |

Catalog: `mobile/lib/modelManager/catalog.ts`.

## Rebuild knowledge base

```bash
cd ml
python knowledge_base/build_kb.py
# → mobile/assets/models/kb/bn_knowledge_base.json
```

## EAS / git

- **Include** vision `*.tflite` and KB in git and EAS uploads.
- **Exclude** STT/TTS/ONNX/GGUF from the repo and from EAS (see `mobile/.easignore`).

Full architecture & prompts: [`docs/offline_ai/README.md`](../../docs/offline_ai/README.md).
