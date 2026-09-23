# Where to put trained / downloaded models

## Easiest: in-app

1. **Gemma / Bangla STT / TTS** — Profile → অফলাইন এআই → মডেল ম্যানেজার → ডাউনলোড  
2. **Vision `.tflite`** — same screen → bottom ইমপোর্ট buttons (after you train)

## Manual paths (advanced)

| File | Runtime path |
|------|----------------|
| Gemma GGUF | `documentDirectory/models/<catalog-id>/` |
| STT ONNX set | `documentDirectory/models/stt-bn-zipformer/{encoder,decoder,joiner}.onnx` + `tokens.txt` |
| TTS VITS Coqui | `documentDirectory/models/tts-bn-vits-coqui/model.onnx` + `tokens.txt` |
| Vision | `documentDirectory/models/vision/crop_disease_int8.tflite` etc. |

STT/TTS are pulled as **separate files from Hugging Face** (no `.tar.bz2` unpack on phone).
