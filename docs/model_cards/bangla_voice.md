# Offline Bangla STT / TTS (sherpa-onnx)

| Field | Value |
|-------|-------|
| Status | **Download path is in the app** — Bangla Zipformer STT via Model Manager (`@siteed/sherpa-onnx.rn`). Spoken replies use the phone's Bangla voice through `expo-speech`, not an in-app VITS model |
| STT | Streaming Zipformer Bengali (`sherpa-onnx-streaming-zipformer-bn-vosk`) |
| TTS | Phone Bangla voice via `expo-speech` (`speakBangla.ts`). An in-app VITS model is not wired |
| App wrappers | `mobile/lib/offlineVoice/*` |
| Download / delete | `mobile/lib/modelManager/*` (same UI as Gemma) |
| Fallback TTS | Existing `mobile/lib/speakBangla.ts` (`expo-speech`) |
| Ship strategy | Opt-in download (~90–120 MB each), not bundled in APK |

After farmer testing, note accent / farming-vocabulary failure modes here.
