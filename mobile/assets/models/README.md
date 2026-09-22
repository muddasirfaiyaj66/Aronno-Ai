# Offline model assets

Large STT / TTS / LLM / vision binaries are **not** committed.
Users download them via the in-app **Model Manager** (`app/(root)/(tabs)/models.tsx`)
into `documentDirectory/models/<id>/`.

| Path | Content | Approx size |
|------|---------|-------------|
| *(runtime)* `models/gemma3-*/` | Gemma 3 GGUF (user-selected) | 300 MB – 2.5 GB |
| *(runtime)* `models/stt-bn-zipformer/` | sherpa-onnx Bengali streaming Zipformer | ~90 MB |
| *(runtime)* `models/tts-bn-vits/` | sherpa-onnx Bengali VITS | ~90–120 MB |
| `vision/*.tflite` | Disease / tool TFLite (after training) | 3–12 MB |
| `kb/bn_knowledge_base.json` | Agronomist facts for LLM grounding | small (**committed**) |

Regenerate KB:

```bash
cd ml && python knowledge_base/build_kb.py
```

Catalog source of truth: `mobile/lib/modelManager/catalog.ts` (later: remote JSON).
