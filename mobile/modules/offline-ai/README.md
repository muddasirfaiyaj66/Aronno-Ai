# Offline AI native audio

STT uses **`@siteed/sherpa-onnx.rn`** (Expo config plugin in `app.json`).
For reliable speech output the app uses the phone's installed Bangla offline TTS
voice; install that voice in Android/iOS text-to-speech settings before QA.

This folder is kept for optional custom bridges; you do **not** need to fill it for Bangla Zipformer / VITS.

After `pnpm install` (approve `@siteed/sherpa-onnx.rn` build scripts), rebuild the
dev client:

```bash
cd mobile
npx expo prebuild
npx expo run:android
# or: eas build --profile development --platform android
```

Checkout and the website are documented in the repository README. This folder is only the native audio bridge.

The Bangla STT model downloads from Hugging Face as **individual files** (no
tar.bz2 on device) via the Model Manager screen. Gemma GGUF models download
there too; the 4B pack includes its vision projector.
