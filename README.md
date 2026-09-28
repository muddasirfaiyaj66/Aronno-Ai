# Aronno (আরণ্য)

**Bangla-first AI farming assistant** for Bangladesh — photograph a crop, hear advice in Bangla, check market prices, and chat in Bangla. This monorepo ships a Nest.js API and an Expo (React Native) mobile app, fully wired end to end.

| Folder | Responsibility | Primary stack |
|--------|----------------|---------------|
| [`backend/`](backend/) | REST API, auth, persistence, payments, AI & weather adapters | Nest.js 11 · Prisma 6 · MongoDB |
| [`mobile/`](mobile/) | Farmer-facing Android / iOS UI | Expo SDK 54 · React Native · Redux Toolkit + RTK Query |
| [`web/`](web/) | Bangla public site and English admin monitor | Next.js 15 |

**Clone → configure → run → APK → ERD:** see **[SETUP.md](SETUP.md)** (written for non-developers as well as engineers).

---

## Table of contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Completed features & technology map](#completed-features--technology-map)
4. [Technology stack](#technology-stack)
5. [Quick start](#quick-start)
6. [Demo accounts](#demo-accounts)
7. [Documentation](#documentation)
8. [License](#license)

---

## Overview

Aronno helps farmers and agri stakeholders in Bangladesh:

- Diagnose crop disease from a **photo** or **voice** description
- Receive a **treatment plan**, **cost estimate**, and a **Bangla PDF report**
- Identify farm **tools**, scan shop **receipts**, get **context-aware fertilizer** advice
- Plan crops with a **6-month weather outlook** across **64 districts**
- Browse **market prices**, open a **shop**, and check out with cash, card, or mobile banking
- Chat with an on-device / online **Bangla assistant** (text + voice when models are installed)
- Use a Bangla-first UI with on-device **listen** (text-to-speech)

Product scope changes (market overhaul, heat map, etc.): **[docs/product_corrections.md](docs/product_corrections.md)**.

AI analysis uses Google’s free **gemini-3.5-flash-lite** family when online. When offline, the app can use **on-device Gemma**, Bangla STT/TTS, and optional TFLite vision — see **[docs/offline_ai/README.md](docs/offline_ai/README.md)**. Weather uses **Open-Meteo** (no API key). Photos upload to **Cloudinary** from the phone; the API stores HTTPS URLs only. If Gemini is unavailable, the API returns a clear error — it does **not** invent mock diagnoses. Offline scan can still answer from on-device models or the local knowledge base when those are installed.

---

## Architecture

```
┌─────────────────────────────────────┐
│  Expo app (mobile/)                 │
│  Screens · Redux / RTK Query        │
│  SecureStore cookie jar             │
│  Camera / mic · Cloudinary upload   │
│  Checkout · SSLCommerz session      │
│  Online: Gemini via API             │
│  Offline: Gemma · sherpa · TFLite   │
└─────────────────┬───────────────────┘
┌─────────────────┴───────────────────┐
│  Next.js site (web/)                │
│  Bangla landing, heat map, market   │
│  English admin monitor (staff only) │
└─────────────────┬───────────────────┘
                  │ HTTPS + cookies + CSRF (when online)
┌─────────────────▼───────────────────┐
│  Nest.js API (backend/)             │
│  Auth · RBAC · Marketplace          │
│  Prices and SSLCommerz checks       │
│  Gemini Flash-Lite · Open-Meteo     │
│  Nodemailer (OTP / password reset)  │
│  pdf-lib (Bangla PDF reports)       │
└─────────────────┬───────────────────┘
                  │
            ┌─────▼─────┐
            │  MongoDB  │
            │  (Prisma) │
            └───────────┘
```

- Access token: `aronno_access` (15 min, HttpOnly cookie)
- Refresh token: `aronno_refresh` (7 days, rotated; reuse detection)
- CSRF: `aronno_csrf` + `X-CSRF-Token` on mutating requests
- Redux holds `{ user, isAuthenticated }` only — **never** the JWT string

---

## Completed features & technology map

### Authentication & account security

| Capability | Status | Backend | Mobile / client |
|------------|--------|---------|-----------------|
| Email / password register & login | Done | Nest.js Auth module, Zod DTOs, Argon2id (`argon2`) | RTK Query auth endpoints, cookie jar |
| Google sign-in (ID token) | Done | `google-auth-library` | `expo-auth-session`, `expo-crypto`, `expo-web-browser` |
| JWT in httpOnly cookies + refresh rotation | Done | `@nestjs/jwt`, `cookie-parser` | Custom cookie jar on `expo-secure-store` |
| CSRF double-submit | Done | Cookie + header guard | Attached on unsafe methods via RTK `fetchBaseQuery` |
| Account lockout (5 failures / 15 min) | Done | Auth service | — |
| Email verification OTP | Done | `nodemailer` (SMTP) or console fallback | Verify-email screen |
| Forgot / reset password | Done | Email tokens + SMTP | Forgot / reset screens |
| RBAC (`SUPERADMIN` / `ADMIN` / `USER`) | Done | Role collection + guards | Profile & admin screens |

### Profile, lookups & administration

| Capability | Status | Backend | Mobile / client |
|------------|--------|---------|-----------------|
| Profile update (name, phone, profession, district) | Done | Users module, Prisma | Profile tab |
| Lookups: professions, crops, **64 BD districts** | Done | Seed on boot, Lookups module | Chips / selectors |
| Admin: list users, roles, activate/deactivate | Done | Admin module + audit log | Phone admin screen and website monitor |
| Create verified admins | Done | `POST /api/admin/users` | Website **New admin** and phone admin UI |
| English operations monitor | Done | Overview, commerce, reports, alerts | Website `/admin` — sidebar can collapse; light and dark themes are remembered |

### Crop diagnosis (photo & voice)

| Capability | Status | Backend | Mobile / client |
|------------|--------|---------|-----------------|
| Photo capture & gallery pick | Done | Stores Cloudinary HTTPS URL | `expo-camera`, `expo-image-picker` |
| Image upload | Done | URL field on Diagnosis | Unsigned upload via Cloudinary (`services/cloudinary.ts`) |
| Disease diagnosis (vision / text) | Done | `GeminiClient` → **gemini-3.5-flash-lite** | Scan → analyze → result flow |
| Voice input for symptoms | Done | Gemini text path | `expo-av` recording + voice screen |
| Persist result + history event | Done | Prisma `Diagnosis`, `HistoryEvent` | History tab (RTK Query) |

### Treatment, cost & reports

| Capability | Status | Backend | Mobile / client |
|------------|--------|---------|-----------------|
| Treatment plan + safety steps | Done | Gemini treatment adapter | Treatment-plan screen |
| Weather advisory on plan | Done | Open-Meteo adapter | Shown with plan |
| Cost estimate (land size / unit) | Done | Local formula adapter (`MockCostAdapter`) | Cost-estimator screen |
| History list & detail | Done | History module | History tab |
| Bangla PDF report | Done | `pdf-lib` + `@pdf-lib/fontkit` + Noto Sans Bengali | Report screen / share |
| On-device Bangla “listen” (TTS) | Done (client) | Server TTS remains a WAV stub | `expo-speech` (`lib/speakBangla.ts`) |

### Tools, receipts, fertilizer & planning

| Capability | Status | Backend | Mobile / client |
|------------|--------|---------|-----------------|
| Farm tool identification | Done | Gemini tools adapter | Tools + tool-result screens |
| Receipt OCR / line items | Done | Gemini receipt adapter (Bangla-digit prompt, Cloudinary contrast/sharpen) + `PATCH /receipts/:id` review | Receipt screens with edit-before-save step |
| Fertilizer recommendation | Done | Rules engine behind `AiFertilizerPort` (crop, stage, age, land, disease from History, soil) | Fertilizer screen |
| 6-month crop plan | Done | Open-Meteo seasonal (cached 24 h in Mongo) → Gemini per-month priorities + windows, cultivation cost | Planning screen |
| Offline / voice chat assistant | Done (baseline) | — | Assistant tab + Gemma/sherpa when installed |
| Soil sensor (Bluetooth + Wi‑Fi) | Done (app wiring) | — | Home → মাটি; demo + live; [hardware doc](docs/hardware_soil_sensor.md) |

### Market

| Capability | Status | Backend | Mobile / client |
|------------|--------|---------|-----------------|
| Market prices by district / crop | Done | Public `GET /market/prices` | Market tab and website `/market` |
| Create listing (optional photo) | Done | Listings + Cloudinary URL | Market UI |
| Shops, products, cart, orders | Done | Marketplace module; stock reserved with a single availability service | Shop and checkout screens |
| Checkout amounts | Done | Server prices the cart from the database and rejects client totals | Checkout does not send a total |
| Cash on delivery | Done | Order stays unpaid until delivery marks it paid | Checkout option |
| Card and mobile banking | Done | SSLCommerz session; amount, currency, and transaction id checked on the validation API before the order is paid | `expo-web-browser` returns to `aronno://payment` |
| Delivery fee | Done | Same district as the shop defaults to 60 BDT, another district to 120 BDT | Website **Delivery** can change both (0–5000) |
| Seller wallet and payout requests | Done | Earned amount is product subtotal of settled orders; delivery fees are excluded | Profile shows spent, earned, and available; bank, bKash, or Nagad request (minimum 100 BDT) |
| Payout settlement | Done (manual) | Admin marks a pending request paid or rejected. The API does not send money to a bank or wallet | Website **Payouts** |
| Disease outbreak heat map | Done | Public `GET /market/heatmap` | App map (Esri tiles) and website `/heatmap` (Leaflet + OpenStreetMap) |
| Live alerts | Done | Heat radius, weather, scans, orders, admin broadcasts | In-app notifications |

### Home, UX & platform

| Capability | Status | Backend | Mobile / client |
|------------|--------|---------|-----------------|
| Live weather on home | Done | Open-Meteo + location points | `expo-location`, home greeting |
| Forest-themed Bangla UI | Done | — | NativeWind / Tailwind, Noto Sans Bengali fonts, Reanimated |
| Offline / retry affordances | Done | Bangla error envelope | `OfflineBanner`, `RetryCard`, `@react-native-community/netinfo` |
| Health check | Done | `GET /api/health` | — |
| Dev client / branded app | Done | — | `expo-dev-client`, Expo Router file routes |
| Public website | Done | — | Next.js landing, heat map, and market in Bangla |

### Known stubs / non-Gemini paths

| Area | Behavior |
|------|----------|
| Server-side TTS (`POST /api/tts`) | Returns a stub WAV via `MockTtsAdapter` — farmers use **device TTS** (`expo-speech`) instead |
| Cost estimates / fertilizer | Deterministic local tables and rules, not Gemini |
| Crop plans | **Open-Meteo** seasonal outlook + Gemini (rule-based fallback) |
| Gemini outage / missing key | `AI_UNAVAILABLE` — no fake disease/treatment/tool/receipt data |
| Online or mobile-banking payment | Needs `SSLCOMMERZ_*` and a public `https` `API_PUBLIC_URL`. Cash on delivery still works on localhost. A payout request does not move money until an admin marks it paid |
| File uploads to API | Not supported — always Cloudinary (or other) `https://` URLs |

---

## Technology stack

### Backend (`backend/`)

| Concern | Package / service |
|---------|-------------------|
| Framework | Nest.js 11 (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`) |
| Config | `@nestjs/config` |
| Database | MongoDB via Prisma 6 (`@prisma/client`, `prisma`) |
| Validation | Zod 4 |
| Auth tokens | `@nestjs/jwt`, `cookie-parser` |
| Passwords | `argon2` (Argon2id) |
| Google OAuth | `google-auth-library` |
| Email | `nodemailer` |
| Security | `helmet`, `@nestjs/throttler` |
| AI | Google Gemini API (`gemini-3.5-flash-lite` / Flash-Lite family) |
| Weather | [Open-Meteo](https://open-meteo.com) forecast & seasonal APIs |
| PDF | `pdf-lib`, `@pdf-lib/fontkit`, Noto Sans Bengali |
| Payments | SSLCommerz (sandbox until `SSLCOMMERZ_IS_LIVE=true`) |
| Testing | Jest, Supertest |

### Website (`web/`)

| Concern | Package / service |
|---------|-------------------|
| Framework | Next.js 15 (App Router) |
| Admin UI | English monitor, collapsible sidebar, light and dark themes stored in the browser |
| Public pages | Bangla landing, `/heatmap`, `/market` |

### Mobile (`mobile/`)

| Concern | Package / service |
|---------|-------------------|
| Runtime | Expo SDK 54, React 19, React Native 0.81 |
| Routing | `expo-router` |
| State & API | `@reduxjs/toolkit`, `react-redux` (RTK Query) |
| Styling | NativeWind 4, Tailwind CSS 3 |
| Auth storage | `expo-secure-store` (cookie jar) |
| Google auth | `expo-auth-session`, `expo-crypto`, `expo-web-browser` |
| Camera / media | `expo-camera`, `expo-image-picker`, `expo-image`, `expo-av` |
| Location | `expo-location` |
| Bangla TTS | `expo-speech` |
| Fonts | `@expo-google-fonts/noto-sans-bengali`, `@expo-google-fonts/noto-sans` |
| Motion / UI | `react-native-reanimated`, `expo-linear-gradient`, `react-native-svg` |
| Print / share | `expo-print`, `expo-sharing` |
| Images CDN | Cloudinary unsigned upload |
| Connectivity | `@react-native-community/netinfo` |
| Onboarding flag | `@react-native-async-storage/async-storage` |

---

## Quick start

Prerequisites: [Git](https://git-scm.com), [Node.js LTS](https://nodejs.org), [MongoDB](https://www.mongodb.com) (local or Atlas), and [pnpm](https://pnpm.io) for the mobile app.

```bash
git clone https://github.com/muddasirfaiyaj66/Aronno-Ai.git
cd Aronno-Ai
```

### API (terminal 1)

```bash
cd backend
copy .env.example .env
npm install
npx prisma generate
npx prisma db push
npm run start:dev
```

Generate distinct JWT secrets (do not reuse sample strings in production):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL`, and optionally `GEMINI_API_KEY`, SMTP, Google client IDs, and SSLCommerz settings in `backend/.env`. `API_PUBLIC_URL` is the public `https` origin of this API (no `/api`, no trailing slash), not the website URL.

Health check: [http://localhost:3000/api/health](http://localhost:3000/api/health)

### App (terminal 2)

```bash
cd mobile
copy .env.example .env
pnpm install
pnpm start
```

Configure Cloudinary (`EXPO_PUBLIC_CLOUDINARY_*`) and `EXPO_PUBLIC_API_URL` before using the camera. The website runs from `web/` on port **3001** (`ARONNO_API_ORIGIN=http://localhost:3000`). Full environment reference: [SETUP.md](SETUP.md).

---

## Demo accounts

| Role | Credentials |
|------|-------------|
| Demo farmer (seeded, verified) | `demo@gmail.com` / `demo1234` |
| Superadmin | From `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` in `backend/.env` |

After superadmin login, create more admins from the phone (**আমি → অ্যাডমিন তৈরি**) or the website (**New admin**). The website monitor is in English. The public site stays in Bangla. Admins can create further admins.

---

## Documentation

| Document | Contents |
|----------|----------|
| [SETUP.md](SETUP.md) | Environment variables, SMTP, Cloudinary, Gemini, APK / EAS build, ERD, API tester notes |
| [docs/offline_ai/README.md](docs/offline_ai/README.md) | **Offline AI:** setup, usage, code map, system prompts, token optimization, model catalog |
| [docs/product_corrections.md](docs/product_corrections.md) | Product feedback tracker — what shipped vs next (market, heat map, OCR, …) |
| [docs/hardware_soil_sensor.md](docs/hardware_soil_sensor.md) | **Soil probe:** BLE + Wi‑Fi protocol, JSON payload, app test modes |
| [docs/model_cards/](docs/model_cards/) | Per-model accuracy, limits, licenses |
| [ml/README.md](ml/README.md) | Train disease / tool TFLite models |
| [backend/README.md](backend/README.md) | API auth model, route overview, scripts |
| [web/README.md](web/README.md) | Public site and English admin monitor |
| [mobile/](mobile/) | Expo app source (`app/` file-based routes) |
| [LICENSE](LICENSE) | MIT |

---

## License

MIT © Muddasir Faiyaj — see [LICENSE](LICENSE).
