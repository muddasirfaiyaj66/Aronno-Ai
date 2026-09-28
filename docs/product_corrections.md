# Product corrections roadmap

Status of the product feedback list (farmer UX + feature scope).  
**Done now** = shipped in app/API. **Next** = planned work. **Later** = future phase.

| # | Request | Status | Notes |
|---|---------|--------|-------|
| 1 | Crop disease recognition too slow | **Done (partial)** | Prefer on-device TFLite before Cloudinary+Gemini; lower capture quality (~0.45) + `skipProcessing` for faster capture/upload. Full speed needs trained `crop_disease_int8.tflite` on device (see offline AI docs). |
| 2 | “পাতার ছবি তুলুন” has two photo CTAs | **Done** | Home keeps **one** leaf-photo button. Scan tab no longer duplicates that photo CTA (voice/text only). Card chevron removed so icon is not a second tap target. |
| 3 | Smarter “সার” (fertilizer) | **Done** | Land size (বিঘা/একর), crop age (preset chips or typed, Bangla digits OK; auto-suggests stage), disease status linked to the latest History diagnosis, crop/stage/soil. Deterministic rules engine returns dose for the whole plot + “why” note. |
| 4 | Remove “ফলন” (yield) | **Done** | Screen, types, API routes and AI adapter deleted. Old DB rows are left in place but never returned. |
| 5 | Improve “পরিকল্পনা” + “রসিদ” | **Done** | Planning: per-month priority crop with planting/harvest windows + cultivation cost (shared with cost estimator). Receipt: Bangla-digit parsing fix, tighter prompt, image prep + Cloudinary contrast, edit-before-save review. |
| 6 | Overhaul “বাজার” (Daraz-like) | **Done** | Shops, products, cart, and orders. Pay cash on delivery, or card / bKash / Nagad / Rocket through SSLCommerz. Amounts are checked on the server. Delivery starts at 60 BDT in the shop's district and 120 BDT elsewhere (editable in the website admin). Seller payouts are requests an admin marks paid; the API does not transfer the money. |
| 7 | Remove “ঋণ” (loan) | **Done** | Screens, component, types, API routes, admin endpoints and web admin page deleted. Old DB rows are left in place but never returned. |
| 8 | Farmer chatbot (text + voice) | **Done (baseline)** | Assistant tab + home “চ্যাট” entry; offline Gemma + sherpa STT/TTS when models installed; online path via existing APIs where wired. Improve dialect STT separately (#9). |
| 9 | Better Bangla voice (dialects + TTS) | **Next** | Need dialect-aware STT models / fine-tune + clearer Bangla TTS; document in model cards. |
| 10 | Disease heat map | **Done** | Diagnoses store district (GPS → nearest district, else profile district). `GET /market/heatmap` aggregates by district × disease; Market tab shows a Leaflet/OpenStreetMap map automatically. |
| 11 | 6‑month weather → cultivation AI | **Done** | Open-Meteo seasonal forecast (climate-normal fallback), cached 24 h in Mongo, fed to Gemini for per-month priorities. |
| 12 | Hardware soil sensors (BLE + Wi‑Fi) | **Done (app wiring)** | Dual transport + demo mode + crop suitability UI. See [hardware_soil_sensor.md](./hardware_soil_sensor.md). Rebuild native client for live BLE. |

## What to verify on device

1. Home → only one **পাতার ছবি তুলুন** → camera → result (offline model if present should feel much faster).
2. Scan tab → voice/text only (no second leaf-photo card).
3. সার → cannot submit until land size, crop age, and disease answer are set; “আছে” shows your latest scan.
4. ফলন / ঋণ appear nowhere (home, profile, history, web admin).
5. চ্যাট opens from home grid and tab bar.
6. Home → **মাটি** → ডেমো টেস্ট works for both Bluetooth and Wi‑Fi without hardware.
7. বাজার → হিট ম্যাপ loads a map with coloured districts; tap one for disease counts. The website `/heatmap` shows the same public data.
8. Checkout quotes delivery only after a district is chosen, and does not send a total.
9. Profile shows খরচ, আয়, and তুলতে পারবেন for a shop owner.
10. রসিদ → after scanning, the edit step opens; fix an amount and save.
