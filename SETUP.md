# Aronno — Setup, Run, and Build Guide

This document is written so someone who is **not a developer** can clone the project, fill in a few free accounts, and run both the phone app and the server. Developers can use the same file for environment variables, the database map, and APK builds.

**Repository:** [github.com/muddasirfaiyaj66/Aronno-Ai](https://github.com/muddasirfaiyaj66/Aronno-Ai)

| Folder | What it is |
|--------|------------|
| `backend/` | Nest.js API (the server). Runs on `http://localhost:3000/api` |
| `mobile/` | Expo / React Native app (the farmer-facing phone UI) |
| `web/` | Next.js public site and English admin monitor. Runs on `http://localhost:3001` |

---

## Table of contents

1. [What Aronno does today](#1-what-aronno-does-today)
2. [What you must install on your computer](#2-what-you-must-install-on-your-computer)
3. [Clone the project](#3-clone-the-project)
4. [Free accounts and tokens](#4-free-accounts-and-tokens)
5. [Generate JWT secrets with Node.js](#5-generate-jwt-secrets-with-nodejs)
6. [Backend `.env` file](#6-backend-env-file)
7. [Mobile `.env` file](#7-mobile-env-file)
8. [Start MongoDB and the API](#8-start-mongodb-and-the-api)
9. [Start the mobile app](#9-start-the-mobile-app)
10. [First login (does it work?)](#10-first-login-does-it-work)
11. [Build an Android APK](#11-build-an-android-apk)
12. [Completed features vs still mocked](#12-completed-features-vs-still-mocked)
13. [How the system is wired](#13-how-the-system-is-wired)
14. [Database relations and ERD](#14-database-relations-and-erd)
15. [API reference (for testers)](#15-api-reference-for-testers)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. What Aronno does today

আরণ্য (Aronno) is a Bangla-first farming assistant. A farmer can:

- Create an account, verify email, log in, and reset a forgotten password
- Photograph a crop (or speak) and get a **disease diagnosis**
- Open a **treatment plan**, **cost estimate**, and a **report**
- Identify a **tool**, scan a **receipt**, get **fertilizer** advice and a **crop plan** with cost
- See **market prices** and the disease **heat map**, post a **listing**, and buy from a shop
- Pay **cash on delivery**, or by **card / mobile banking** when SSLCommerz is configured
- Open the **website** for the public heat map and market, and an English admin monitor

**Honest status:** the screens and APIs are connected. Disease, treatment, tools, receipts, and crop-plan wording call **gemini-3.5-flash-lite** (free). If the key is missing or Gemini fails, the API returns `AI_UNAVAILABLE` — it does **not** invent mock answers. Crop plans use the **Open-Meteo** seasonal forecast (no key); fertilizer advice and cost estimates are local rules. TTS is still a stub. Photos **are** uploaded for real: the phone sends them to **Cloudinary**, then the API stores the HTTPS URL.

---

## 2. What you must install on your computer

Install these **before** you clone. Restart the computer after Node and Git if Windows asks you to.

| Tool | Why | Where to get it (free) |
|------|-----|------------------------|
| **Git** | Downloads the code | [git-scm.com/downloads](https://git-scm.com/downloads) |
| **Node.js 20 LTS or 22 LTS** | Runs the API and the Expo app | [nodejs.org](https://nodejs.org) (choose LTS) |
| **MongoDB Community** *or* Atlas | Database | Local: [mongodb.com/try/download/community](https://www.mongodb.com/try/download/community) · Cloud: [mongodb.com/atlas](https://www.mongodb.com/atlas) (free M0) |
| **Expo Go** on your phone (optional) | Run the app without building an APK | Google Play / App Store — search **Expo Go** |
| **Android Studio** (optional) | Emulator, or local APK compile | [developer.android.com/studio](https://developer.android.com/studio) |

Check that Node works. Open **PowerShell** (Windows) or **Terminal** (Mac) and type:

```bash
node -v
npm -v
git --version
```

You should see version numbers, not an error.

The mobile app lockfile is **pnpm**. After Node is installed:

```bash
npm install -g pnpm
pnpm -v
```

---

## 3. Clone the project

```bash
git clone https://github.com/muddasirfaiyaj66/Aronno-Ai.git
cd Aronno-Ai
```

You now have `backend/` and `mobile/`.

---

## 4. Free accounts and tokens

You do **not** need paid plans. Create only what you will actually use.

### 4.1 MongoDB (required)

**Option A — local (simplest on a laptop)**

1. Install MongoDB Community and start the **MongoDB Server** service.
2. Use this URL in `backend/.env`:

```
DATABASE_URL=mongodb://localhost:27017/aronno
```

A replica set is **not** required for local demo. The API falls back if transactions are unsupported.

**Option B — MongoDB Atlas (free cloud, good for phones on the same Wi‑Fi as a hosted API)**

1. Sign up at [cloud.mongodb.com](https://cloud.mongodb.com) → create a **free M0** cluster.
2. **Database Access** → add a user and password.
3. **Network Access** → add your IP (or `0.0.0.0/0` for a short demo only).
4. **Connect** → Drivers → copy the URI and replace `<password>`:

```
DATABASE_URL=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/aronno?retryWrites=true&w=majority
```

### 4.2 Cloudinary (required for camera / listings)

Unsigned upload from the phone. Free tier is enough.

1. Sign up at [cloudinary.com](https://cloudinary.com).
2. Dashboard: copy **Cloud name**.
3. **Settings → Upload → Upload presets → Add upload preset**.
   - Signing mode: **Unsigned**
   - Folder (optional): `aronno`
   - Save. Copy the **Preset name**.
4. Put both values in `mobile/.env` (see [section 7](#7-mobile-env-file)).

Without Cloudinary, login still works; photo diagnosis, tool photo, receipt scan, and listing photos will fail.

### 4.3 Email / SMTP (optional, recommended)

Used for **email verification** and **forgot password**. If `SMTP_HOST` is empty, the 6-digit code is **printed in the backend terminal** instead of being emailed. That is enough for local testing.

**Free Gmail (real inbox)**

1. Google Account → **Security** → turn on 2-Step Verification.
2. [App passwords](https://myaccount.google.com/apppasswords) → generate a 16-character password (not your normal Gmail password).
3. Use:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
SMTP_FROM=Aronno <you@gmail.com>
```

Remove spaces in `SMTP_PASS` if the server rejects it (`xxxxyyyyzzzzwwww`).

**Free Mailtrap (fake inbox for testers)**

1. [mailtrap.io](https://mailtrap.io) → Email Testing → SMTP settings.
2. Copy host, port, user, pass into the same `SMTP_*` keys.

### 4.4 Google sign-in (optional)

Leave the Google client IDs empty if you only use email and password. The login screen then says Google is not configured.

1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → OAuth consent screen**. Add the scopes `openid`, `email`, and `profile`. Add your Gmail address as a test user while the app is in testing.
2. **Credentials → Create OAuth client ID → Web**. Copy that client ID.
3. **Android** client: package name `app.aronno.mobile`. SHA-1 comes from the keystore that signs the dev client (`cd mobile/android` then `.\gradlew.bat signingReport`, or EAS credentials).
4. **iOS** client: bundle ID `app.aronno.mobile`.
5. Backend `.env`:

```env
GOOGLE_CLIENT_ID=WEB_CLIENT_ID.apps.googleusercontent.com
GOOGLE_ANDROID_CLIENT_ID=ANDROID_CLIENT_ID.apps.googleusercontent.com
GOOGLE_IOS_CLIENT_ID=IOS_CLIENT_ID.apps.googleusercontent.com
```

6. Mobile `.env` uses the same three IDs as `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (web), `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`, and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.
7. Rebuild the phone app (`npx expo run:android` or an EAS dev build) after the Android or iOS ID is set. The rebuild registers the Google return link. Restart the API after the backend IDs change.

The phone opens Google, then sends the ID token to `POST /api/auth/google`. The API checks that the token audience is one of those client IDs. It never trusts a name or email sent by the app itself. A new Google user is created as a verified farmer. An existing email account is linked on the first Google login.

### 4.5 Gemini / TTS / S3

| Variable | Free source | Used today? |
|----------|-------------|-------------|
| `GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | **Required for AI screens** — disease, treatment, tools, receipts, crop plans use **gemini-3.5-flash-lite** (free). Failures return `AI_UNAVAILABLE`, not mock data. |
| `TTS_PROVIDER_KEY` | Provider of your choice | **No** — mock WAV |
| `S3_BUCKET` | Cloudflare R2 / AWS | **No** — images go to Cloudinary |

Weather uses **[Open-Meteo](https://open-meteo.com)** (no API key): current conditions + a 6-month seasonal outlook for the farmer GPS or saved district. If seasonal data is unavailable, Bangladesh monthly rainfall normals are used.

TTS and S3 can stay blank. Without `GEMINI_API_KEY`, diagnosis and related AI endpoints return an error.

### 4.6 Expo (only when building an APK)

1. Sign up at [expo.dev](https://expo.dev) (free).
2. Install EAS CLI when you reach [section 11](#11-build-an-android-apk).

---

## 5. Generate JWT secrets with Node.js

The API signs cookies with two long random strings. **Do not** copy secrets from a chat or a screenshot. Generate your own on the machine that will run the API.

In PowerShell or Terminal:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

You get two 64-character hex lines. Example shape (fake):

```
a3f1c9…   → JWT_ACCESS_SECRET
7b20de…   → JWT_REFRESH_SECRET
```

Paste each into `backend/.env`. Never commit `.env` to GitHub.

If you prefer a tiny file, save `scripts/gen-secrets.js` yourself:

```js
const { randomBytes } = require("crypto");
console.log("JWT_ACCESS_SECRET=" + randomBytes(32).toString("hex"));
console.log("JWT_REFRESH_SECRET=" + randomBytes(32).toString("hex"));
```

Then: `node scripts/gen-secrets.js`

---

## 6. Backend `.env` file

```bash
cd backend
copy .env.example .env
```

On Mac/Linux: `cp .env.example .env`

Open `backend/.env` in any text editor. Fill it like this (replace the JWT lines with **your** generated secrets):

```env
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:8081,http://localhost:19006,http://localhost:8082,http://localhost:3000,http://localhost:3001
DATABASE_URL=mongodb://localhost:27017/aronno
JWT_ACCESS_SECRET=PASTE_FIRST_NODE_SECRET_HERE
JWT_REFRESH_SECRET=PASTE_SECOND_NODE_SECRET_HERE
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
COOKIE_SECURE=false
SUPERADMIN_EMAIL=
SUPERADMIN_PASSWORD=
SUPERADMIN_NAME=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
THROTTLE_TTL=60
THROTTLE_LIMIT=60
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
TTS_PROVIDER_KEY=
S3_BUCKET=
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=Aronno <noreply@aronno.local>
SSLCOMMERZ_STORE_ID=
SSLCOMMERZ_STORE_PASSWORD=
SSLCOMMERZ_IS_LIVE=false
API_PUBLIC_URL=
```

| Key | Meaning |
|-----|---------|
| `COOKIE_SECURE=false` | Required on `http://localhost`. Set `true` only behind HTTPS. |
| `CORS_ORIGIN` | Comma-separated Expo / web origins. Add `http://192.168.x.x:8081` if the phone is on Wi‑Fi. |
| `SUPERADMIN_*` | First boot creates this **already verified** superadmin from `backend/.env`. Do not commit those values. After login they can create admins; admins can create more admins. |
| `SSLCOMMERZ_*` | Store id and password from SSLCommerz. Keep `SSLCOMMERZ_IS_LIVE=false` on the sandbox. |
| `API_PUBLIC_URL` | Public `https` origin of **this API**, with no `/api` and no trailing slash. SSLCommerz calls `{API_PUBLIC_URL}/api/marketplace/payments/sslcommerz/...`. It is not the website URL. `localhost` cannot complete online payment. |

Password rules for **new** farmer accounts: at least 10 characters, with upper, lower, number, and a symbol (example: `FarmHelp_2026!`).

---

## 7. Mobile `.env` file

```bash
cd mobile
copy .env.example .env
```

```env
EXPO_PUBLIC_API_URL=http://localhost:3000/api
EXPO_PUBLIC_GOOGLE_CLIENT_ID=
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset
```

| Where the app runs | `EXPO_PUBLIC_API_URL` |
|--------------------|------------------------|
| Expo web / iOS simulator on the same PC | `http://localhost:3000/api` |
| Android emulator | `http://10.0.2.2:3000/api` |
| Physical phone (same Wi‑Fi) | `http://YOUR_PC_LAN_IP:3000/api` e.g. `http://192.168.0.15:3000/api` |

Find the PC IP on Windows: `ipconfig` → **IPv4 Address**. Add that origin to `CORS_ORIGIN` on the backend (for example `http://192.168.0.15:8081`).

Restart Expo after any `.env` change (`Ctrl+C`, then `pnpm start` again).

---

## 8. Start MongoDB and the API

**Terminal 1 — database**

- Windows: start **MongoDB** from Services, or Atlas is already cloud-hosted.
- Confirm: visit nothing yet; the API will fail loudly if Mongo is down.

**Terminal 2 — API**

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run start:dev
```

Success looks like:

```
Aronno API running on http://localhost:3000/api
Lookup seed complete
```

On first boot the server also creates:

- Roles: `SUPERADMIN`, `ADMIN`, `USER`
- Professions, districts, crops
- Demo disease reports across districts for the heat map (disable with `SEED_HEATMAP_DEMO=false`)
- Superadmin from `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` in `.env` (if none exists yet)

Check health in a browser: [http://localhost:3000/api/health](http://localhost:3000/api/health)

You want `{ "success": true, ... }`.

---

## 9. Start the mobile app

**Terminal 3**

```bash
cd mobile
pnpm install
pnpm start
```

A QR code appears.

| You have | What to press |
|----------|----------------|
| Android phone with Expo Go | Scan the QR code with Expo Go |
| iPhone with Expo Go | Scan with the Camera app → Expo Go |
| Android emulator | Press `a` in the terminal |
| Web browser | Press `w` |

The first screen is **onboarding**, then **login**.

### Website (terminal 4)

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001). Put `ARONNO_API_ORIGIN=http://localhost:3000` in `web/.env.local`. Staff sign in at [http://localhost:3001/admin/login](http://localhost:3001/admin/login). The public pages are Bangla. The monitor is English, and its sidebar and light/dark choice are remembered in the browser.

---

## 10. First login (does it work?)

**Demo farmer (already email-verified, with sample farm records):**

| Field | Value |
|-------|--------|
| Email | `demo@gmail.com` |
| Password | `demo1234` |

A new registered account starts empty until that farmer uses the APIs. Sample diagnoses, receipts, and listings are attached only to the demo farmer.

**Superadmin** — use the email and password you set in `backend/.env` (`SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD`). After login open **আমি → অ্যাডমিন তৈরি** to add staff. Those admins can create further admins the same way.

**New farmer account**

1. Open **নিবন্ধন** (register).
2. Name, email, password, profession.
3. Check Gmail **or** the backend terminal for a 6-digit code (15 minutes).
4. Enter it on **ইমেইল যাচাই**.
5. You land on the home tabs.

Forgot password: login screen → **পাসওয়ার্ড ভুলে গেছেন?** → code → new password.

---

## 11. Build an Android APK

You need an [Expo](https://expo.dev) account. This uses **EAS Build** (free tier has monthly limits). The `preview` profile in `mobile/eas.json` produces an **.apk** you can install from a file (not the Play Store `.aab`).

### 11.1 One-time setup

```bash
npm install -g eas-cli
cd mobile
eas login
eas build:configure
```

If `app.json` already has `"android": { "package": "app.aronno.mobile" }`, accept the defaults.

Put production API + Cloudinary values in EAS secrets **or** in `eas.json` `env` so the APK is not stuck on `localhost`:

```bash
eas secret:create --name EXPO_PUBLIC_API_URL --value https://your-api.example.com/api --scope project
eas secret:create --name EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME --value your_cloud --scope project
eas secret:create --name EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET --value your_preset --scope project
```

The phone APK **cannot** call `http://localhost:3000`. Host the Nest API (Vercel, a VPS, etc.) and use that HTTPS URL.

### 11.2 Cloud APK (recommended)

```bash
cd mobile
eas build -p android --profile preview
```

Wait for the Expo website to finish (often 10–20 minutes). Download the `.apk` and copy it to the phone. Android may ask you to allow **Install unknown apps**.

### 11.3 Play Store bundle (later)

```bash
eas build -p android --profile production
```

That produces an **.aab** for Google Play, not a sideload APK.

### 11.4 Local debug APK (optional, needs Android Studio)

```bash
cd mobile
npx expo prebuild -p android
npx expo run:android
```

This installs a debug build on a plugged-in device or emulator. It is heavier than Expo Go.

### 11.5 iOS

iOS installable builds need a Mac and an Apple Developer account. This repo is documented for **Android APK** first. iOS: `eas build -p ios --profile preview`.

---

## 12. Completed features vs still mocked

### Done and wired (API + mobile)

| Area | What works |
|------|------------|
| Auth | Register, login, Google ID-token (if configured), refresh, logout, `/me` |
| Email | Verify email OTP, resend, forgot password, reset password (SMTP or console log) |
| Security | Argon2id, cookie JWT, CSRF, lockout, RBAC, Zod, Helmet, rate limits |
| Profile | Patch name / phone / profession / district |
| Lookups | Professions, districts, crops |
| Admin | List users, change role, activate/deactivate (ADMIN+) |
| Diagnosis | Photo (Cloudinary URL) and voice → persisted result + history |
| Treatment / cost | Plan + weather advisory + cost estimate |
| History / reports | List, detail, report create, PDF stub, TTS stub |
| Tools / receipts | Photo or voice tool ID; receipt scan from image URL, then farmer review |
| Fertilizer / plan | Recommend, generate crop plan with cultivation cost |
| Market | Prices, listings (optional image URL), share, disease heat map |
| Marketplace | Shops, products, cart, orders. The server prices the cart and rejects a total sent by the phone or website |
| Payments | Cash on delivery. Card and bKash / Nagad / Rocket go through SSLCommerz; the API accepts a payment only after SSLCommerz validation matches the order amount in BDT |
| Delivery | Same city as the shop starts at 60 BDT, another city at 120 BDT. Change both from the website admin **Delivery** page |
| Wallet | Profile shows spent, earned, and available. A shop owner can request a bank, bKash, or Nagad payout (minimum 100 BDT). An admin marks it paid after sending the money |
| Website | Bangla landing, heat map, and market. English monitor for overview, users, alerts, market, reports, delivery, and payouts |
| Images | Phone → Cloudinary → `{ imageUrl }` JSON to API |

### Still mocked or local

TTS (WAV stub) and PDF generation stay mocked. Cost estimates and fertilizer advice are local rules (not Gemini). Crop plans use Open-Meteo data; Gemini writes the per-month priorities, with a rule-based fallback. If Gemini is down or `GEMINI_API_KEY` is empty, disease / treatment / tools / receipts return `AI_UNAVAILABLE` instead of fake data. Online payment stays unavailable until `API_PUBLIC_URL` is a public `https` API origin and the SSLCommerz store credentials are set. Payout requests do not call bKash or a bank.

### Intentionally not on Vercel disk

Local `uploads/` streaming was removed. Do not send multipart files to the API. Always send `https://` image URLs.

---

## 13. How the system is wired

```mermaid
flowchart LR
  subgraph phone [Expo app]
    UI[Screens]
    RTK[RTK Query]
    Jar[SecureStore cookie jar]
    CL[Cloudinary unsigned upload]
  end
  subgraph site [Next.js site]
    Public[Landing heat map market]
    Admin[English monitor]
  end
  subgraph cloud [Free / optional cloud]
    CDN[Cloudinary]
    SMTP[Gmail or Mailtrap]
  end
  subgraph api [Nest.js]
    Auth[Auth + cookies]
    Feat[Feature modules]
    Mock[Mock AI ports]
  end
  DB[(MongoDB)]
  UI --> RTK
  RTK --> Jar
  RTK -->|JSON + cookies + CSRF| Auth
  Public -->|public GET| Feat
  Admin -->|cookies + CSRF| Auth
  UI -->|photo file| CL
  CL --> CDN
  CDN -->|secure_url| RTK
  Auth --> Feat
  Feat --> Mock
  Feat --> DB
  Auth --> SMTP
```

- Access cookie `aronno_access` — 15 minutes, HttpOnly
- Refresh cookie `aronno_refresh` — 7 days, rotated
- CSRF cookie `aronno_csrf` — readable; sent as `X-CSRF-Token` on POST/PATCH
- Redux stores `{ user, isAuthenticated }` only — **never** the JWT string

---

## 14. Database relations and ERD

MongoDB via **Prisma**. Independent facts live in their own collections (3NF-style references, not giant embedded documents). IDs are ObjectIds.

### 14.1 Lookups (seeded on boot)

| Collection | Unique key | Used by |
|------------|------------|---------|
| `Role` | `slug` (`SUPERADMIN` / `ADMIN` / `USER`) | `User.roleId` |
| `Profession` | `slug` | `User.professionId` |
| `District` | `slug` | User, Market, Listing, Diagnosis |
| `Crop` | `slug` | Diagnosis, costs, fertilizer, prices, listings |

### 14.2 Identity

- `User` → Role, Profession?, District?
- `OAuthAccount` → User (Google)
- `RefreshToken` → User (hashed token, family rotation)
- `EmailToken` → User (`verification` or `password_reset`)
- `AuditLog` → User (admin actions)

### 14.3 Farm features

- `Diagnosis` → User, Crop?, District? (where it was scanned) ; optional `TreatmentPlan` and `Report`s
- `HistoryEvent` is a **thin pointer** (`kind` + `sourceId`), not a copy of the diagnosis
- `TreatmentPlan` → Diagnosis (1:1), User ; children: `WeatherAdvisory`, `TreatmentStep`, `SafetyItem`
- `CostEstimate` → User, Crop
- `Report` → User, Diagnosis, TreatmentPlan?
- `ToolIdentification` → User ; children `ToolListing`
- `Receipt` → User ; children `ReceiptItem`
- `FertilizerAdvice` → User, Crop
- `CropPlan` → User ; children `MonthForecast`
- `Market` → District ; `MarketPrice` → Market + Crop
- `Listing` → User (seller), Crop, District
- `WeatherCache` — seasonal outlook cache keyed by area

### 14.4 Marketplace and alerts

- `Shop` → User (owner), District
- `Product` → Shop ; stock and price live here. Checkout never trusts a price from the phone
- `Cart` → User
- `Order` → buyer, shop, payment method (`cash_on_delivery`, `online`, `mobile_banking`), payment status, SSLCommerz transaction id
- `DeliveryRate` — singleton settings row (`sameCityBdt`, `otherCityBdt`)
- `Payout` → User, Shop, channel (`bank`, `bkash`, `nagad`), status (`pending`, `paid`, `rejected`)
- `Review` → Order / Product
- `SellerReport` → Shop
- `Notification` → User
- `AdminBroadcast` — staff alerts by place

Legacy collections from retired features (`LoanPurpose`, `LoanApplication`, `YieldEstimate`, `HeatMapStat`) stay in the schema only so existing rows remain readable; no API or screen uses them.

Image fields (`imageObjectKey`, `thumbnailObjectKey`) store a **Cloudinary HTTPS URL** (or empty), not a server filename.

### 14.3 ERD

```mermaid
erDiagram
  Role ||--o{ User : has
  Profession ||--o{ User : optional
  District ||--o{ User : optional
  District ||--o{ Market : has
  District ||--o{ Listing : location
  Crop ||--o{ Diagnosis : optional
  Crop ||--o{ CostEstimate : for
  Crop ||--o{ FertilizerAdvice : for
  Crop ||--o{ MarketPrice : priced
  Crop ||--o{ Listing : sold

  User ||--o{ OAuthAccount : accounts
  User ||--o{ RefreshToken : sessions
  User ||--o{ EmailToken : otps
  User ||--o{ AuditLog : actor
  User ||--o{ Diagnosis : scans
  User ||--o{ HistoryEvent : timeline
  User ||--o{ TreatmentPlan : plans
  User ||--o{ CostEstimate : estimates
  User ||--o{ Report : reports
  User ||--o{ ToolIdentification : tools
  User ||--o{ Receipt : receipts
  User ||--o{ FertilizerAdvice : advice
  User ||--o{ CropPlan : plans
  User ||--o{ Listing : sells

  Diagnosis ||--o| TreatmentPlan : one_plan
  Diagnosis ||--o{ Report : reports
  TreatmentPlan ||--o| WeatherAdvisory : advisory
  TreatmentPlan ||--o{ TreatmentStep : steps
  TreatmentPlan ||--o{ SafetyItem : safety
  TreatmentPlan ||--o{ Report : used_in
  ToolIdentification ||--o{ ToolListing : offers
  Receipt ||--o{ ReceiptItem : lines
  CropPlan ||--o{ MonthForecast : months
  Market ||--o{ MarketPrice : ticks
```

Canonical source: `backend/prisma/schema.prisma`.

---

## 15. API reference (for testers)

Base URL: `http://localhost:3000/api`  
Envelope: `{ "success": true, "data": … }` or `{ "success": false, "error": { "code", "message" } }`

Public POSTs do not need CSRF. Logged-in POSTs/PATCHes need cookie + `X-CSRF-Token`.

| Method | Path | Auth | Notes |
|--------|------|------|--------|
| GET | `/` | public | API info |
| GET | `/health` | public | Liveness |
| GET | `/lookups/professions` | public | |
| GET | `/lookups/districts` | public | |
| GET | `/lookups/crops` | public | |
| POST | `/auth/register` | public | Returns `{ email, requiresVerification }` — **no session yet** |
| POST | `/auth/login` | public | Session cookies; `EMAIL_UNVERIFIED` if OTP pending |
| POST | `/auth/google` | public | `{ idToken }` |
| POST | `/auth/verify-email` | public | `{ email, code }` then sets cookies |
| POST | `/auth/resend-verification` | public | `{ email }` |
| POST | `/auth/forgot-password` | public | `{ email }` (always `{ ok: true }`) |
| POST | `/auth/reset-password` | public | `{ email, code, password }` |
| POST | `/auth/refresh` | cookie | |
| POST | `/auth/logout` | cookie | |
| GET | `/auth/me` | cookie | |
| GET/PATCH | `/users/me` | cookie | |
| GET | `/admin/users` | ADMIN+ | |
| POST | `/admin/users` | ADMIN+ | Create a verified `ADMIN` (`{ email, password, displayName }`) |
| PATCH | `/admin/users/:id/role` | ADMIN+ | Admins cannot grant or change `SUPERADMIN` |
| PATCH | `/admin/users/:id/active` | ADMIN+ | |
| POST | `/diagnoses/photo` | cookie | `{ imageUrl, lat?, lon? }` |
| POST | `/diagnoses/voice` | cookie | `{ transcriptBn, cropSlug?, lat?, lon? }` |
| GET | `/diagnoses` | cookie | |
| GET | `/diagnoses/:id` | cookie | |
| GET | `/treatment-plans?diagnosisId=` | cookie | |
| POST | `/cost-estimates` | cookie | |
| GET | `/history` | cookie | |
| POST | `/reports` | cookie | |
| POST | `/reports/:id/pdf` | cookie | Stub URL |
| POST | `/tts` | cookie | |
| POST | `/tools/identify/photo` | cookie | `{ imageUrl }` |
| POST | `/tools/identify/voice` | cookie | |
| POST | `/receipts/scan` | cookie | `{ imageUrl }` |
| PATCH | `/receipts/:id` | cookie | Farmer-reviewed `{ items: [{ nameBn, quantity, priceBdt }], totalBdt? }` |
| POST | `/fertilizer/recommend` | cookie | |
| POST | `/crop-plans/generate` | cookie | |
| GET | `/crop-plans/latest` | cookie | |
| GET | `/weather/current` | cookie | Open-Meteo; optional `?lat=&lon=` else user district |
| GET | `/market/prices` | cookie | |
| GET | `/market/listings` | cookie | |
| POST | `/market/listings` | cookie | JSON + optional `imageUrl` |
| GET | `/market/heatmap` | public | `?days=` (default 60) → district areas |
| GET | `/marketplace/products` | public list | Product detail is public; create and edit need a cookie |
| GET | `/marketplace/shops` | public list | Creating a shop needs a cookie |
| GET/POST | `/marketplace/cart` | cookie | |
| POST | `/marketplace/orders/quote` | cookie | `{ shopId, districtId }` → server delivery fee |
| POST | `/marketplace/orders` | cookie | Server prices the cart. Client totals are rejected |
| GET | `/marketplace/wallet` | cookie | Spent, earned, available |
| POST | `/marketplace/wallet/payouts` | cookie | Bank, bKash, or Nagad request |
| GET/POST | `/marketplace/payments/sslcommerz/*` | public callbacks | SSLCommerz success, fail, cancel, and IPN. Not wrapped in the JSON envelope |
| GET/PATCH | `/admin/delivery` | ADMIN+ | Same-city and other-city fees |
| GET | `/admin/payouts` | ADMIN+ | |
| POST | `/admin/payouts/:id` | ADMIN+ | `{ action: "paid" \| "rejected" }` from pending only |
| GET | `/admin/overview` | ADMIN+ | Monitor totals |
| GET | `/admin/notifications` | ADMIN+ | |
| POST | `/admin/notifications` | ADMIN+ | Broadcast |

---

## 16. Troubleshooting

| Symptom | What to try |
|---------|-------------|
| `npm` / `node` not recognized | Reinstall Node LTS, tick **Add to PATH**, open a **new** terminal |
| Prisma / Mongo connection error | Start MongoDB, or fix Atlas password and IP allowlist |
| API starts then seed errors | `npx prisma db push` then restart |
| App says network / login fails on phone | Use LAN IP in `EXPO_PUBLIC_API_URL`, same Wi‑Fi, Windows Firewall allow port 3000, add Expo origin to `CORS_ORIGIN` |
| Photo analysis fails immediately | Fill Cloudinary cloud name + **unsigned** preset; restart Expo |
| No email code | Check Spam; or read `OTP=` in the API terminal if SMTP is empty |
| `EMAIL_UNVERIFIED` | Open verify-email with that inbox; resend code |
| Password rejected | 10+ chars, upper, lower, digit, symbol |
| APK cannot log in | APK is not using `localhost`; set EAS secrets to the public API URL |
| CSRF / 403 after login | Restart API and app so cookies match; do not mix `localhost` and `127.0.0.1` |
| Online payment never finishes | `API_PUBLIC_URL` must be the public `https` API origin. A local API can still take cash on delivery |
| Website admin is blank | Start the API, set `ARONNO_API_ORIGIN`, and sign in with an admin account |

---

## Quick command cheat sheet

```bash
# API
cd backend
npm install
npx prisma generate
npx prisma db push
npm run start:dev

# App
cd mobile
pnpm install
pnpm start

# Website
cd web
npm install
npm run dev

# JWT secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# APK
cd mobile
eas build -p android --profile preview
```

Questions about the data model: start from `backend/prisma/schema.prisma`. Questions about screens: start from `mobile/app/`.
