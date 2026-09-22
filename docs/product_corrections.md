# Product corrections roadmap

Status of the product feedback list (farmer UX + feature scope).  
**Done now** = shipped in app/API. **Next** = planned work. **Later** = future phase.

| # | Request | Status | Notes |
|---|---------|--------|-------|
| 1 | Crop disease recognition too slow | **Done (partial)** | Prefer on-device TFLite before Cloudinary+Gemini; lower capture quality (~0.45) + `skipProcessing` for faster capture/upload. Full speed needs trained `crop_disease_int8.tflite` on device (see offline AI docs). |
| 2 | “পাতার ছবি তুলুন” has two photo CTAs | **Done** | Home keeps **one** leaf-photo button. Scan tab no longer duplicates that photo CTA (voice/text only). Card chevron removed so icon is not a second tap target. |
| 3 | Smarter “সার” (fertilizer) | **Done** | Collects land size (bigha), crop age (days), disease yes/no/unsure, plus crop/stage/soil — then recommends. Backend prompt uses these fields. |
| 4 | Remove “ফলন” (yield) | **Done (UI)** | Removed from home grid + insights. History no longer surfaces yield/loan tabs. Screen/API kept unused for now (can delete later). |
| 5 | Improve “পরিকল্পনা” + “রসিদ” | **Next** | Planning: crop-specific plans + cost estimation. Receipt: better Bangla OCR / number reading + redesign. |
| 6 | Overhaul “বাজার” (Daraz-like) | **Next (major)** | Multi-crop (veg/fruit/all), roles (farmer/shopkeeper sellers, customer buyers), full cart → order → fulfillment. Separate epic. |
| 7 | Remove “ঋণ” (loan) | **Done (UI)** | Removed from home, profile, history filters. Routes/API remain dormant; do not build banking auth. |
| 8 | Farmer chatbot (text + voice) | **Done (baseline)** | Assistant tab + home “চ্যাট” entry; offline Gemma + sherpa STT/TTS when models installed; online path via existing APIs where wired. Improve dialect STT separately (#9). |
| 9 | Better Bangla voice (dialects + TTS) | **Next** | Need dialect-aware STT models / fine-tune + clearer Bangla TTS; document in model cards. |
| 10 | Disease heat map | **Next** | Aggregate geo disease reports; map layer for farmers + officers. Needs location consent + aggregation backend. |
| 11 | 6‑month weather → cultivation AI | **Next** | Wire public weather dataset into planning/assistant prompts; cost + crop calendar. |
| 12 | Hardware soil sensors (BLE + Wi‑Fi) | **Done (app wiring)** | Dual transport + demo mode + crop suitability UI. See [hardware_soil_sensor.md](./hardware_soil_sensor.md). Rebuild native client for live BLE. |

## What to verify on device

1. Home → only one **পাতার ছবি তুলুন** → camera → result (offline model if present should feel much faster).
2. Scan tab → voice/text only (no second leaf-photo card).
3. সার → cannot submit until land size, crop age, and disease answer are set.
4. ফলন / ঋণ not visible on home or profile.
5. চ্যাট opens from home grid and tab bar.
6. Home → **মাটি** → ডেমো টেস্ট works for both Bluetooth and Wi‑Fi without hardware.
