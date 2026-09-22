# Where to put trained / downloaded models

You train offline; the app code is already wired. Drop files here:

## Vision (after Colab / `ml/` training)

Copy into the phone at runtime (recommended) or bundle for a custom build:

| File | Runtime path (documentDirectory) | Or bundle under |
|------|----------------------------------|-----------------|
| `crop_disease_int8.tflite` | `models/vision/crop_disease_int8.tflite` | `mobile/assets/models/vision/` |
| `tool_detector_int8.tflite` | `models/vision/tool_detector_int8.tflite` | same |
| `class_names.json` | `models/vision/class_names.json` | committed starter already exists |

From a PC with device connected you can `adb push` into the app’s documents folder, or add a “import model” picker later.

Also copy the same `.tflite` into `ml/artifacts/v1_YYYY-MM-DD/` for versioning.

## LLM / STT / TTS

Use the in-app **মডেল ম্যানেজার** (Profile → অফলাইন এআই). Downloads land in:

`documentDirectory/models/<catalog-id>/<filename>`

## After adding vision TFLite

1. `pnpm add react-native-fast-tflite expo-image-manipulator` (if not installed)
2. Rebuild **expo-dev-client**
3. Offline photo scan will call the TFLite path; if the file is missing it falls back to KB name match / Bangla error.
