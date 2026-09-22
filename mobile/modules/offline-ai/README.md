# Offline AI native module (Expo config plugin + sherpa-onnx bridge)

Sprint 1 will add:

- Android: prebuilt sherpa-onnx `.aar` / JNI wrappers under `android/`
- iOS: `.xcframework` / Swift package under `ios/`
- Expo config plugin entry so `expo-dev-client` prebuilds pick this up

Until then this folder is a stub so the repo layout matches the offline architecture plan.
Do **not** implement exploit/PoC code here — only legitimate STT/TTS native bindings.
