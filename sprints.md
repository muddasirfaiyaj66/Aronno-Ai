# Aronno — Backend + Connection Sprints

Copy one sprint prompt at a time into a coding agent. Execute in order. Do not start Sprint N until Sprint N−1 is done.

**Repo:** `aronno/` monorepo — `backend/` is Nest.js 11 (port already wired), `mobile/` is Expo SDK 54.

**Frontend sprints (already built, mocked):** capture/diagnosis, treatment/cost, report/history, tools/receipts, fertilizer/yield/planning, market/loan. These backend sprints replace every `TODO(nestjs)` in `mobile/types/` and `mobile/app/` with real APIs, then wire the screens through Redux Toolkit + RTK Query.

---

## Locked decisions (every sprint must follow)

### Stack

| Layer | Choice | Do not |
|---|---|---|
| API | Nest.js 11, global prefix `/api` | Change the prefix |
| DB | MongoDB + Prisma | Mongoose, TypeORM, raw drivers |
| Validation | Zod + `nestjs-zod` on every DTO | `class-validator` for new DTOs |
| Auth | OAuth 2.1-style Google ID-token + email/password | Session tables as the only auth |
| Passwords | Argon2id | bcrypt, plaintext, reversible crypto |
| Tokens | Short-lived JWT access + rotating refresh | Long-lived access JWT in Redux |
| Token storage | **Cookies only** (see below) | `AsyncStorage`, Redux persist, SecureStore-as-JWT-store |
| Roles | `SUPERADMIN` \| `ADMIN` \| `USER` via `Role` collection | Hard-coded role strings on `User` |
| Mobile state | Redux Toolkit + **RTK Query** | TanStack Query, Zustand, Context for server cache |
| Mobile Expo | SDK 54 — read https://docs.expo.dev/versions/v54.0.0/ before adding native modules | Guess APIs from older SDKs |

### Why RTK Query (not TanStack Query)

The app already needs a Redux store (auth session snapshot, UI, optimistic loan/listing writes). RTK Query is the data-fetch + cache layer **inside** Redux Toolkit:

- One store, one DevTools, one invalidation model (`tagTypes`).
- `fetchBaseQuery({ credentials: 'include' })` sends cookies on every request.
- Automatic cache, deduping, polling, optimistic updates — replace all local `MOCK_*` constants.
- Do **not** also install TanStack Query. Do **not** persist the RTK Query cache or any token to disk.

### Cookie token storage (web + React Native)

The access token and refresh token **never** leave httpOnly cookies on the wire. They are **never** stored in Redux, AsyncStorage, or JS memory as the source of truth.

**Backend cookie flags (production):**

```
HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=<ttl>
```

- Cookie names: `aronno_access`, `aronno_refresh`.
- Access TTL: 15 minutes. Refresh TTL: 7 days.
- Development: `Secure` off only on `http://localhost`; `SameSite=Lax` if Expo web and API are different localhost ports.
- CORS: **never** `origin: '*'`. Explicit allowlist + `credentials: true`.
- CSRF: double-submit cookie (`aronno_csrf`, **not** HttpOnly) checked on every unsafe method. SPA/native reads it and sends `X-CSRF-Token`.

**React Native (Expo) — there is no browser httpOnly jar.** Implement a **cookie jar** that behaves like the browser:

1. Parse `Set-Cookie` from Nest responses.
2. Persist cookie name/value/expiry/flags in **Expo SecureStore** (the native equivalent of httpOnly — other apps cannot read it).
3. On each API request, attach `Cookie: aronno_access=...; aronno_refresh=...`.
4. Redux holds only `{ isAuthenticated, user }` — never the JWT string.
5. On 401, call `POST /api/auth/refresh` (refresh cookie attached); retry the original request once; on failure, logout.

Do not put JWTs in `Authorization: Bearer` except as a documented fallback that is **disabled** in this project. Cookies only.

### Prisma + MongoDB + 3NF / BCNF

MongoDB is a document store. **Do not embed** independent entities. Use Prisma relation fields + ObjectId references so each fact lives in one collection.

**Rules:**

1. Every model: `id String @id @default(auto()) @map("_id") @db.ObjectId`.
2. Lookup tables (not Prisma enums-as-source-of-truth) for values that have their own attributes or will grow: `Role`, `Profession`, `District`, `Crop`.
3. No repeating groups, no transitive dependencies. Example: `User.districtId` → `District`; do **not** also store `districtNameBn` on `User`.
4. Snapshot exception: AI *outputs* of a single event (disease name + confidence of **that** scan) live on that event row — they are not master data.
5. History is **not** a denormalized copy of diagnosis/yield/loan. Use a thin `HistoryEvent` (`kind` + `sourceId` + `userId` + `occurredAt`). Detail payloads are loaded from the source collection.
6. Child rows with independent identity get their own collection (`ReceiptItem`, `TreatmentStep`, `MonthForecast`).
7. Unique constraints for BCNF candidate keys: `User.email`, `User.googleSub`, `Role.slug`, `Profession.slug`, `RefreshToken.tokenHash`.

Prisma MongoDB transactions require a replica set. Use them for multi-document writes (loan apply + history event, diagnosis + history event).

### Security baseline (every module)

- Helmet, payload size limits, `trust proxy` when behind TLS terminator.
- `@nestjs/throttler`: global 60 req/min; auth endpoints 5/min/IP; AI endpoints 10/min/user.
- Zod on body, query, params. Reject unknown keys.
- File uploads: size cap, MIME allowlist, magic-byte check, virus-scan hook TODO, store outside web root / object storage.
- Argon2id for passwords; never log tokens, cookies, or password hashes.
- Refresh-token **rotation + reuse detection** (revoke the whole family on reuse).
- Account lockout after N failed logins.
- RBAC guards: `@Roles('SUPERADMIN' | 'ADMIN' | 'USER')`. Superadmin bypasses admin-only, not user-data isolation — users still only see their own rows unless role is ADMIN/SUPERADMIN.
- Audit log collection for admin mutations (role change, loan status change, seed).
- Leave `TODO(gemini)` / `TODO(nestjs)` only at the actual Gemini/Gamma call site, never as a substitute for the endpoint.

### Response envelope

```ts
{ success: true, data: T }
{ success: false, error: { code: string, message: string, details?: unknown } }
```

Bangla `message` for user-facing errors. English `code` for the client (`AUTH_INVALID`, `RATE_LIMITED`, `AI_UNAVAILABLE`, …).

### Mobile wiring pattern (every feature sprint)

1. Add/extend RTK Query API slice with `tagTypes` and endpoints.
2. Replace `MOCK_*` usage in screens with hooks (`useGetXQuery`, `useCreateXMutation`).
3. Keep TypeScript types in `mobile/types/` as the **client contract** — they must match the API `data` payload.
4. Loading: existing `AIGeneratingShimmer` for AI waits; RTK Query `isLoading` / `isFetching`.
5. Errors: existing `RetryCard` + `OfflineBanner`.
6. Do not restyle existing UI primitives.

---

# Sprint 0 — Foundation: DB, Auth, RBAC, Security, Redux + Cookies

**Status:** NEW — required before any feature API  
**Depends on:** Nest.js port init (already done)  
**Prompt (copy everything in this section):**

```
You are implementing Sprint 0 for Aronno (monorepo: backend/ Nest.js 11, mobile/ Expo SDK 54).

Read sprints.md "Locked decisions" and follow them exactly.

GOAL
Stand up MongoDB + Prisma, full auth (email/password + Google OAuth 2.1 ID-token), JWT in httpOnly cookies with refresh rotation, RBAC (SUPERADMIN / ADMIN / USER), profession on user profile, superadmin seed on boot, Zod, rate limits, Helmet, CSRF, and the mobile Redux Toolkit + RTK Query + cookie-jar client. No feature endpoints yet (diagnosis, market, etc.).

BACKEND
1. Add Prisma with MongoDB provider. DATABASE_URL in backend/.env.example.
2. Schema (3NF/BCNF, ObjectId refs, no embedding of independent entities):

   Role            id, slug unique (SUPERADMIN|ADMIN|USER), nameBn, nameEn
   Profession      id, slug unique (farmer|shop_owner|agronomist|trader|extension_officer|other), nameBn, nameEn
   District        id, slug unique (jashore|munshiganj|bogura|rangpur|comilla — match mobile/types/market.ts), nameBn
   User            id, email unique, passwordHash nullable (Google-only users),
                   googleSub unique nullable, displayName, phone nullable,
                   roleId -> Role, professionId -> Profession nullable,
                   districtId -> District nullable, isActive, emailVerifiedAt,
                   failedLoginCount, lockedUntil, createdAt, updatedAt
                   NO role slug column, NO district name column, NO profession name column
   OAuthAccount    id, userId, provider (google), providerAccountId, createdAt
                   @@unique([provider, providerAccountId])
   RefreshToken    id, userId, familyId, tokenHash unique, expiresAt, revokedAt,
                   userAgent, ip, createdAt
   Csrf / session: csrf is cookie-based, not a table
   AuditLog        id, actorUserId, action, target, metadata Json, createdAt

3. On application bootstrap (PrismaService onModuleInit):
   - Upsert the 3 roles and the profession + district lookup rows.
   - If no User exists with Role.slug === SUPERADMIN, create one from env:
     SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, SUPERADMIN_NAME.
   - Hash the password with Argon2id. Never seed if the superadmin email already exists.

4. Auth module
   - POST /api/auth/register     { email, password, displayName, professionSlug? }
     USER role only. Password Zod: min 10, upper, lower, digit, special.
   - POST /api/auth/login        { email, password }
     Verify hash, lockout after 5 failures for 15 minutes, reset on success.
   - POST /api/auth/google       { idToken }  (mobile + web)
     Verify with google-auth-library (OAuth 2.1 / Google Identity). Latest google-auth-library.
     Find-or-create User (googleSub, emailVerifiedAt=now, passwordHash=null unless already local).
     Link OAuthAccount. Default role USER.
   - POST /api/auth/refresh      (refresh cookie) — rotate refresh, reuse-detection revokes family.
   - POST /api/auth/logout       revoke current family, clear cookies.
   - GET  /api/auth/me           current user + role.slug + profession + district (joined).

   Cookies: set aronno_access (JWT 15m, payload: sub, role, jti) and aronno_refresh (opaque or JWT, 7d).
   Flags: HttpOnly, Secure in production, SameSite=Strict (Lax in local cross-port), Path=/api.
   Also set aronno_csrf (NOT HttpOnly) for double-submit. Guard all mutating routes except login/register/google.

   Do NOT accept Authorization Bearer. Cookies only.

   Google: env GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (secret unused for ID-token verify but keep for future web redirect). Document Expo AuthSession + PKCE on the mobile side.

5. Users / profile
   - GET  /api/users/me
   - PATCH /api/users/me        { displayName?, phone?, professionSlug?, districtSlug? }
   - ADMIN/SUPERADMIN:
     GET    /api/admin/users
     PATCH  /api/admin/users/:id/role   { roleSlug }  (only SUPERADMIN can grant SUPERADMIN)
     PATCH  /api/admin/users/:id/active { isActive }

6. Security in main.ts / AppModule
   - Helmet
   - CORS credentials true, origin from CORS_ORIGIN (comma-separated allowlist, never *)
   - cookie-parser
   - ValidationPipe replaced by nestjs-zod (or ZodSerializer + interceptor). whitelist unknown keys = reject.
   - ThrottlerModule: default 60/min; AuthController @Throttle 5/min
   - Global prefix api (already set)
   - Body limit 1mb JSON; multipart later in upload sprint
   - Disable x-powered-by

7. Keep GET /api/health. It must NOT require auth.

8. Tests: unit for password hash + lockout; e2e for register/login/me/refresh/logout/cookie flags; seed superadmin.

MOBILE (Expo 54 — read official docs first)
1. Install: @reduxjs/toolkit react-redux expo-secure-store expo-auth-session expo-crypto expo-web-browser
   Cookie jar: implement services/cookieJar.ts using SecureStore. Parse Set-Cookie, persist, attach Cookie header.
2. store/index.ts — configureStore with authSlice + api (RTK Query).
3. services/api.ts — createApi:
   baseUrl from EXPO_PUBLIC_API_URL (default http://localhost:3000/api)
   fetchBaseQuery with credentials: 'include' AND a custom fetch that uses the cookie jar (native has no document.cookie).
   prepareHeaders: set X-CSRF-Token from the csrf cookie on POST/PATCH/PUT/DELETE.
   401 interceptor: try refresh mutation, retry once, else dispatch logout.
   tagTypes: ['Auth','User'] for now.
4. authSlice: { user, isAuthenticated } only. Hydrate via getMe on app start. NEVER store JWT.
5. Features: login screen, register screen (profession chip select using Profession list), Google button via expo-auth-session (PKCE) → POST /auth/google with idToken.
6. Wrap root layout with <Provider store={store}>. Keep LocaleProvider.
7. Gate (root) tabs behind isAuthenticated; unauthenticated → login. Superadmin/admin can still use the farmer app as USER-capable; do not build an admin app in this sprint.
8. Profile screen: replace hardcoded "করিম মিয়া" with useGetMeQuery; profession + district from API.

DO NOT
- Feature modules (diagnosis, market, loan, …)
- Bearer tokens in Redux or SecureStore as raw JWT files (cookies in the jar only)
- class-validator on new DTOs
- Embed Role/Profession on User as strings

When done: update backend/README.md with env vars, seed behaviour, cookie auth, and the /api/auth/* table.
```

**Done when:**

- Server starts, seeds SUPERADMIN if missing, `/api/health` works.
- Register / login / Google / refresh / logout set and clear cookies.
- Mobile login persists across kill/relaunch via cookie jar + `/auth/me`.
- Profile shows the logged-in user.

---

# Sprint 1 — Core Capture Flow: Disease Detection + Voice

**Status:** UNCHANGED product spec — backend + RTK wiring  
**Depends on:** Sprint 0  
**AI:** Gemini/Gamma vision (mock adapter behind an interface)  
**Prompt (copy everything in this section):**

```
You are implementing Sprint 1 for Aronno. Read sprints.md Locked decisions. Sprint 0 is done (auth cookies, Prisma, RTK Query).

GOAL
Replace the mock AnalyzingScreen / DiagnosisResultScreen flow with Nest.js endpoints and RTK Query. Gemini/Gamma is behind an AiVisionPort; ship a MockAiVisionAdapter that returns the same shapes as mobile/types/diagnosis.ts. Leave TODO(gemini) only inside the real adapter file.

BACKEND
Prisma (3NF):
  Crop            id, slug unique (rice|potato|tomato|vegetable — match treatment.ts CropType), nameBn, nameEn
  Diagnosis       id, userId, cropId nullable, source (photo|voice),
                  imageObjectKey nullable, transcriptBn nullable,
                  diseaseNameBn, diseaseNameEn, confidence Int (0-100),
                  severity (low|medium|high), createdAt
  HistoryEvent    id, userId, kind (disease|yield|loan), sourceId, occurredAt
                  @@index([userId, occurredAt])
                  // disease sourceId = Diagnosis.id. Do not duplicate disease fields here.

Endpoints (all cookie-auth, USER+):
  POST /api/diagnoses/photo     multipart image (max 8MB, jpeg/png/webp, magic-byte check)
  POST /api/diagnoses/voice     { transcriptBn: string, cropSlug?: string }
  GET  /api/diagnoses/:id       owner or ADMIN/SUPERADMIN
  GET  /api/diagnoses           current user, paginated

Flow:
  1. Validate with Zod.
  2. Store image in local ./uploads in dev (gitignore) — TODO(storage) for S3.
  3. Call AiVisionPort.diagnose({ imageBuffer | transcriptBn }).
  4. Persist Diagnosis + HistoryEvent(kind=disease) in a Prisma transaction.
  5. Return data matching mobile DiagnosisResult + { id, createdAt }.

Throttle AI routes 10/min/user. Rate-limit 413/415 on bad files.

Module layout: diagnoses/, ai/ (port + mock adapter). No treatment yet.

MOBILE
- RTK Query endpoints: createPhotoDiagnosis, createVoiceDiagnosis, getDiagnosis.
  invalidatesTags: ['Diagnosis','History']
- CaptureLauncherScreen / PhotoCaptureScreen / VoiceCaptureScreen stay as designed (no text input on launcher).
- AnalyzingScreen: remove setTimeout mock. Call the mutation; keep AIGeneratingShimmer; on failure show RetryCard (the existing failure branch must become reachable).
- DiagnosisResultScreen: render payload from getDiagnosis or mutation result (StructuredCard, confidence, SeverityBadge, ListenButton, CTA চিকিত্সা দেখুন). CTA can still route to treatment with diagnosisId even if treatment API is Sprint 2 (pass id).
- Types in mobile/types/diagnosis.ts stay the contract; add id if missing.

DO NOT restyle UI. DO NOT build treatment/cost in this sprint.
```

**Done when:** photo and voice paths produce a real Diagnosis row, history event, and DiagnosisResultScreen data with cookies + RTK cache.

---

# Sprint 2 — Treatment Planner + Weather Advisory + Cost Estimation

**Status:** UNCHANGED product spec  
**Depends on:** Sprint 1  
**Prompt (copy everything in this section):**

```
You are implementing Sprint 2 for Aronno. Read sprints.md Locked decisions. Sprints 0–1 are done.

GOAL
TreatmentPlanScreen and CostEstimatorScreen talk to Nest.js. Reuse existing mobile primitives. Weather advisory is a first-class collection (not a JSON blob of unrelated facts). Gemini/Gamma mocked.

BACKEND
Prisma (3NF):
  TreatmentPlan     id, diagnosisId unique -> Diagnosis, userId,
                    pesticideNameBn, dosagePerBigha, followUpLabelBn, createdAt
  WeatherAdvisory   id, treatmentPlanId unique, level (safe|caution|wait), reasonBn
  TreatmentStep     id, treatmentPlanId, step Int, instructionBn
                    @@unique([treatmentPlanId, step])
  SafetyItem        id, treatmentPlanId, labelBn, sortOrder
  CostEstimate      id, userId, cropId -> Crop, landSize Float, landUnit (bigha|acre),
                    pesticideQuantity, totalCostBdt Int, spraySessions Int, createdAt

Endpoints:
  GET  /api/treatment-plans?diagnosisId=
       If missing, generate via AiTreatmentPort from Diagnosis, persist plan+advisory+steps+safety in one transaction, return full graph.
  PATCH /api/treatment-plans/:id/safety/:itemId  { checked: boolean }  // checklist is UI state; if you persist checks, table SafetyCheck(userId, safetyItemId, checkedAt) — do NOT add `checked` onto SafetyItem (that would mix catalog with per-user state). Prefer client-only checks unless product requires persist; if persist, use SafetyCheck.
  POST /api/cost-estimates   { cropSlug, landSize, landUnit }
       Zod: landSize > 0. Mock formula OK behind CostEstimatePort. TODO(gemini) if later AI-assisted.
  GET  /api/cost-estimates/:id

Response shapes MUST match mobile/types/treatment.ts (TreatmentPlan, CostEstimateResult).

Weather: MockWeatherPort returning level + reasonBn. TODO(weather-api) in the adapter.

MOBILE
- RTK Query: getTreatmentPlan, createCostEstimate. Tags: Treatment, CostEstimate.
- TreatmentPlanScreen: replace TODO GET /treatment-plan. WeatherAdvisoryCard above steps. ListenButton for full plan.
- CostEstimatorScreen: replace TODO POST /cost-estimate. Chip crop + land size + বিঘা/একর. Hero ৳ card from API.
- AI waits use AIGeneratingShimmer if a mock delay/port is async.

DO NOT build report/history screens (Sprint 3). DO NOT restyle cards.
```

**Done when:** a diagnosis can open a persisted treatment plan with weather banner, and cost estimate returns quantity / ৳ / spray sessions from the API.

---

# Sprint 3 — Report, TTS & Crop Health History (Extended)

**Status:** MOSTLY UNCHANGED — history already has three kinds on the client; now they are real  
**Depends on:** Sprints 1, 2 (yield/loan rows will be sparse until Sprints 5–6; still implement the union + filters)  
**Prompt (copy everything in this section):**

```
You are implementing Sprint 3 for Aronno. Read sprints.md Locked decisions.

GOAL
ReportPreviewScreen and CropHealthHistoryScreen / HistoryDetailScreen use the API. History is a discriminated union: disease | yield | loan. TTS is a backend endpoint that returns audio or a signed URL. PDF is stubbed with a real file upload/download path and a success toast — no need for a perfect PDF renderer.

BACKEND
Prisma:
  HistoryEvent already exists from Sprint 1. Do not duplicate payloads.
  Report            id, userId, diagnosisId, treatmentPlanId nullable,
                    pdfObjectKey nullable, createdAt
  TtsClip           optional: id, userId, sourceType, sourceId, objectKey, createdAt
                    OR generate on the fly and do not persist. If persist, 3NF as above.

Endpoints:
  GET  /api/history                query: kind?=disease|yield|loan, cropSlug?, cursor?, limit?
       Returns HistoryEntry[] matching mobile/types/history.ts discriminated union.
       Assemble:
         kind=disease → join Diagnosis (+ Crop.nameBn)
         kind=yield   → join YieldEstimate when that table exists; until Sprint 5 return empty for yield
         kind=loan    → join LoanApplication when that table exists; until Sprint 6 return empty for loan
       Implement the assembler so Sprint 5/6 only insert HistoryEvent rows — no history rewrite.
  GET  /api/history/:id            detail DTO by kind (enough for HistoryDetailScreen).
  POST /api/reports                { diagnosisId }  compile diagnosis + treatment + weather
  GET  /api/reports/:id
  POST /api/reports/:id/pdf        stub: generate a simple PDF (pdfkit or similar) or return 501 with a clearly marked stub that still writes a placeholder file and returns { downloadUrl }. Mobile shows success toast.
  POST /api/tts                    { textBn: string } or { source: 'diagnosis'|'treatment'|'report', id }
       MockTtsPort returns a short mp3/wav fixture. TODO(tts-provider). Throttle 10/min.

RBAC: users see only their history. ADMIN/SUPERADMIN may pass ?userId=.

MOBILE
- Replace MOCK_HISTORY_ENTRIES with useGetHistoryQuery. Filter chips সব / রোগ / ফলন / ঋণ map to kind query (omit kind for সব).
- HistoryDetailScreen: fetch by id; read-only reuse of DiagnosisResult / TreatmentPlan / later yield card / LoanStatusCard. ListenButton + ফিরে যান only.
- ReportPreviewScreen: GET compiled report; sticky PDF + ListenButton; PDF mutation → success toast (keep Bangla copy).
- ListenButton: call TTS endpoint, play with expo-audio (Expo 54 docs) — do not invent an old expo-av API without reading the v54 docs.

Seed (dev only): at least 5 disease HistoryEvents across 2 crops for the superadmin or a demo USER. Yield/loan seed in later sprints.

DO NOT implement yield prediction or loan apply here — only the history contract must accept those kinds.
```

**Done when:** history lists real disease scans, filters work, report compiles, PDF stub toasts success, ListenButton plays TTS from the API.

---

# Sprint 4 — Farming Tools Identification + Receipt Scan

**Status:** UNCHANGED product spec  
**Depends on:** Sprints 0, 1 (shared AnalyzingScreen + AIGeneratingShimmer)  
**Prompt (copy everything in this section):**

```
You are implementing Sprint 4 for Aronno. Read sprints.md Locked decisions.

GOAL
ToolIdentificationScreen and ReceiptScanScreen use Nest.js. Both flows reuse CaptureLauncher / Photo / Voice / AnalyzingScreen. Mock Gemini/Gamma.

BACKEND
Prisma (3NF):
  ToolIdentification  id, userId, source (photo|voice), imageObjectKey nullable, transcriptBn nullable,
                      toolNameBn, toolNameEn, reasonBn, createdAt
  ToolListing         id, toolIdentificationId, sourceName, thumbnailUrl, priceBn nullable, externalUrl
                      (listings are children of an identification snapshot — not a global marketplace)
  Receipt             id, userId, imageObjectKey, totalBdt Int, summaryBn, createdAt
  ReceiptItem         id, receiptId, nameBn, quantity, priceBn, sortOrder

Endpoints:
  POST /api/tools/identify/photo    multipart image
  POST /api/tools/identify/voice    { transcriptBn }
  GET  /api/tools/:id
  POST /api/receipts/scan           multipart image
  GET  /api/receipts/:id

AiToolsPort + AiReceiptPort with mock adapters returning shapes from mobile/types/tools.ts and receipt.ts.
Throttle as AI routes. Same upload rules as diagnoses.

Optional: HistoryEvent is disease|yield|loan only — do NOT cram tools/receipts into CropHealthHistory unless product asks.

MOBILE
- AnalyzingScreen already branches flow=tool|receipt. Replace mocks with mutations; RetryCard on failure.
- Tool result: StructuredCard + horizontal ListingCard scroll from API listings.
- Receipt result: hero ৳, itemized list, ListenButton using summaryBn via Sprint 3 TTS.
- Remove MOCK_TOOL_RESULTS / MOCK_RECEIPT_SUMMARIES from screen runtime (keep types).

DO NOT restyle ListingCard. DO NOT add a new analyzing spinner.
```

**Done when:** tool photo/voice and receipt photo round-trip through the API and render on the existing result screens.

---

# Sprint 5 — Fertilizer, Yield Prediction & 6-Month Crop Planning

**Status:** EXTENDED — original two flows + CropPlanning  
**Depends on:** Sprint 0 (ForecastTimelineCard, AIGeneratingShimmer, Home BentoTile already on mobile)  
**Prompt (copy everything in this section):**

```
You are implementing Sprint 5 for Aronno. Read sprints.md Locked decisions.

GOAL
FertilizerRecommendationScreen, YieldPredictionScreen, CropPlanningScreen hit Nest.js. On create yield, insert HistoryEvent(kind=yield) so Sprint 3 timeline lights up.

BACKEND
Prisma (3NF):
  FertilizerAdvice  id, userId, cropId, growthStage, soilColor, soilMoisture,
                    fertilizerNameBn, dosagePerBigha, applicationMethodBn, timingBn, warningBn nullable
  YieldEstimate     id, userId, cropId, landSizeBn, weatherSummaryBn,
                    estimatedMinMon, estimatedMaxMon, lastSeasonMon, trend, changePercent, createdAt
  CropPlan          id, userId, recommendationBn, createdAt
  MonthForecast     id, cropPlanId, monthBn, weatherIcon, recommendedCropBn, sortOrder
                    @@unique([cropPlanId, sortOrder])

Lookup: growthStage/soilColor/soilMoisture are closed sets — Prisma enums are OK (finite, no extra attributes). Do not stringify-copy crop names; use cropId.

Endpoints:
  POST /api/fertilizer/recommend   { cropSlug, growthStage, soilColor, soilMoisture }
  GET  /api/fertilizer/:id
  POST /api/yield/predict          (crop/land/weather from profile + MockWeatherPort; ignore client-forged weather)
  GET  /api/yield/:id
  POST /api/crop-plans/generate    (6-month MockWeatherPort + AiPlanningPort)
  GET  /api/crop-plans/latest

After YieldEstimate insert: HistoryEvent kind=yield, sourceId=estimate.id.
Contracts: mobile/types/fertilizer.ts, yield.ts, planning.ts (MonthForecast.weatherIcon is an Ionicons name — mock must return names the client already uses).

MOBILE
- RTK Query mutations/queries; AIGeneratingShimmer while crop plan generates.
- Fertilizer: chip selects + IconPickerRow unchanged; result StructuredCard + ListenButton.
- Yield: read-only prefilled fields from getMe + weather summary from API; hero মণ range + last-season row.
- CropPlanningScreen: ForecastTimelineCard from months[]; StructuredCard recommendationBn + ListenButton.
- Home BentoTile "আবহাওয়া–ফসল পরিকল্পনা" already routes here — keep it.
- History filter ফলন should now return rows.

Seed 2 yield HistoryEvents for the demo user.

DO NOT restyle ForecastTimelineCard or BentoTile.
```

**Done when:** fertilizer, yield, and 6-month plan persist; yield rows appear in history; Home tile still opens CropPlanningScreen with live data.

---

# Sprint 6 — Market Hub (4-in-1) + Agricultural Loan

**Status:** REDESIGNED market tab + new loan  
**Depends on:** Sprint 0 (SegmentedTabs, LoanStatusCard, ListingCard) and Sprint 3 (history union)  
**Prompt (copy everything in this section):**

```
You are implementing Sprint 6 for Aronno. Read sprints.md Locked decisions.

GOAL
One MarketScreen (already built) backed by APIs for Price, Marketplace, Heat Map, Direct Sell. LoanOverview + LoanApplication APIs. Loan apply inserts HistoryEvent(kind=loan). All four market sub-views keep the visible "DRAFT — needs product review" banner.

BACKEND
Prisma (3NF):
  Market           id, nameBn, districtId
  MarketPrice      id, marketId, cropId, pricePerMon Int, capturedAt
                   trend/changePercent are COMPUTED vs previous MarketPrice for same marketId+cropId — do not store trend on the row (3NF).
  Listing          id, sellerUserId, cropId, quantityBn, quantityKg Int?, askingPricePerKg Int,
                   districtId, thumbnailObjectKey nullable, createdAt, isActive
                   askingPriceBn is formatted on the server DTO, not stored.
  HeatMapStat      id, districtId, diseaseIntensity Float, priceIntensity Float, capturedAt
                   // TODO(product): data source unconfirmed — keep the comment on the service.
  LoanApplication  id, userId, amountBdt Int, purposeSlug, repaymentPeriod (3m|6m|12m),
                   status (pending|approved|repaying|rejected), nextPaymentDue nullable, createdAt
  LoanPurpose      id, slug unique (seed|fertilizer|equipment|other), nameBn
                   LoanApplication.purposeId -> LoanPurpose (not a string purpose column).

Endpoints:
  GET  /api/market/prices          ?cropSlug&districtSlug
       DTO: MarketPriceEntry (include computed trend, changePercent, সেরা দাম flag on max price of the result set)
       Also return estimatedRevenueHero if query includes quantity (optional); otherwise mobile can compute from profile land size — document which.
  GET  /api/market/listings        ?cropSlug&districtSlug&sort=price_asc|price_desc
  POST /api/market/listings        { cropSlug, quantityBn, askingPricePerKg, districtSlug } + optional photo (reuse upload rules)
       seller = current user
  POST /api/market/listings/:id/share   stub { shareUrl }
  GET  /api/market/heatmap         { regions: HeatMapRegion[] }
       Comment in code: TODO(product): data source needs product confirmation.
  POST /api/loans                  { amountBdt, purposeSlug, repaymentPeriod }
       status=pending, HistoryEvent kind=loan. Confirmation DTO with badge পর্যালোচনাধীন.
  GET  /api/loans/current          LoanApplication | null
  GET  /api/loans/:id
  PATCH /api/admin/loans/:id/status  { status }  ADMIN+  (audit log)

Throttle listing creates. Zod: amountBdt > 0, askingPricePerKg > 0.

MOBILE
- MarketScreen: RTK Query for the four tabs; keep SegmentedTabs দাম / বাজার / হিটম্যাপ / বিক্রি করুন. Keep DRAFT banner.
- Price: filter chips, StructuredCards, hero revenue.
- Marketplace: ListingCard grid + filters.
- Heat Map: still placeholder map; bind GET heatmap intensities; keep TODO(product).
- Direct Sell: form + PhotoCaptureScreen; POST listing; confirmation StructuredCard + শেয়ার করুন stub.
- LoanOverviewScreen: LoanStatusCard from GET /loans/current; নতুন আবেদন.
- LoanApplicationScreen: form; POST /loans; show confirmation then go back to overview.
- Profile আর্থিক সেবা: live current loan, not hardcoded ৳ ৫০,০০০.
- History ঋণ filter shows the new application.

Seed: market prices + listings similar to MOCK_* counts; 1 loan HistoryEvent optional after apply.

DO NOT split Market into four routes. DO NOT restyle SegmentedTabs / LoanStatusCard.
```

**Done when:** all four market sub-views read/write through RTK Query; loan apply is pending in DB and appears on Profile, Overview, and History.

---

## Sprint map (frontend feature → backend)

| Frontend | Backend sprint | Primary routes |
|---|---|---|
| Auth / profile / profession | 0 | `/api/auth/*`, `/api/users/me` |
| Capture, Analyzing, DiagnosisResult | 1 | `/api/diagnoses/*` |
| TreatmentPlan, CostEstimator | 2 | `/api/treatment-plans/*`, `/api/cost-estimates` |
| Report, History (+ yield/loan kinds) | 3 | `/api/history`, `/api/reports`, `/api/tts` |
| Tools, Receipts | 4 | `/api/tools/*`, `/api/receipts/*` |
| Fertilizer, Yield, CropPlanning | 5 | `/api/fertilizer/*`, `/api/yield/*`, `/api/crop-plans/*` |
| Market tab, Loan | 6 | `/api/market/*`, `/api/loans/*` |

## Env vars to accumulate

```
# Sprint 0
DATABASE_URL=
PORT=3000
CORS_ORIGIN=http://localhost:8081,http://localhost:19006
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
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

# Later
GEMINI_API_KEY=
TTS_PROVIDER_KEY=
S3_BUCKET=
```

## Out of scope for all six sprints

- Admin web dashboard UI (API only for admin role mutations)
- Real Gemini/Gamma production prompts (adapters + TODO only)
- Confirmed heat-map data partner
- Push notifications
- Payments / actual disbursement of loans
