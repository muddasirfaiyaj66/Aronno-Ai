# Offline AI native module (sherpa-onnx)

Sprint 1 wiring in JS is ready (`lib/offlineVoice/sttEngine.ts`, `ttsEngine.ts`).

Native bridge still needed for real streaming STT/TTS:

1. Add sherpa-onnx Android `.aar` / iOS xcframework under `android/` and `ios/`
2. Expose `NativeModules.SherpaSTT` and `SherpaTTS` with `init`, `startStreaming`, `stopStreaming`, `speak`, and events `partialResult` / `finalResult`
3. Rebuild expo-dev-client

Until then: offline voice capture falls back to **typing**; TTS uses **expo-speech**.
