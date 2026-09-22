# Offline Bangla STT / TTS (sherpa-onnx)

| Field | Value |
|-------|-------|
| Status | **Not integrated yet** — listed in Model Manager catalog |
| STT | Streaming Zipformer Bengali (`sherpa-onnx-streaming-zipformer-bn-vosk`) |
| TTS | Bengali VITS (pin concrete archive URL in catalog when chosen) |
| App wrappers | `mobile/lib/offlineVoice/*` |
| Download / delete | `mobile/lib/modelManager/*` (same UI as Gemma) |
| Fallback TTS | Existing `mobile/lib/speakBangla.ts` (`expo-speech`) |
| Ship strategy | Opt-in download (~90–120 MB each), not bundled in APK |

After farmer testing, note accent / farming-vocabulary failure modes here.
