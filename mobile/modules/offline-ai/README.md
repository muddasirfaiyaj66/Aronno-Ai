# Offline AI native audio

STT/TTS now use **`@siteed/sherpa-onnx.rn`** (Expo config plugin in `app.json`).

This folder is kept for optional custom bridges; you do **not** need to fill it for Bangla Zipformer / VITS.

After `pnpm install` (approve `@siteed/sherpa-onnx.rn` build scripts), rebuild the
dev client:

```bash
cd mobile
npx expo prebuild
npx expo run:android
# or: eas build --profile development --platform android
```

Models download from Hugging Face as **individual files** (no tar.bz2 on device)
via the Model Manager screen.
