# Aronno Backend

Nest.js 11 API for the Aronno phone app and website. Cookies-only JWT auth, Prisma + MongoDB, Zod validation, role-based access. Checkout prices, delivery fees, and SSLCommerz amounts are decided here, not in the app or the website.

## Stack

- Nest.js 11, Prisma 6, MongoDB
- Argon2id passwords, Google ID-token (OAuth 2.1)
- httpOnly cookies: `aronno_access` (7 days), `aronno_refresh` (30 days), `aronno_csrf` (not HttpOnly)
- Zod on every DTO, Helmet, CORS credentials, `@nestjs/throttler`

## Setup

```bash
cd backend
cp .env.example .env
# set DATABASE_URL to a MongoDB replica set (required for multi-doc transactions)
npm install
npx prisma generate
npx prisma db push
npm run start:dev
```

On boot the API upserts roles, professions, districts, crops, demo heat-map reports (unless `SEED_HEATMAP_DEMO=false`), and seeds a **SUPERADMIN** if none exists (from `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` in `.env`). Superadmin and admin can `POST /api/admin/users` to create more verified admins.

Copy `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, and `SSLCOMMERZ_IS_LIVE` from `.env.example`. `API_PUBLIC_URL` is the public `https` origin of this server (no `/api`, no trailing slash). SSLCommerz calls `{API_PUBLIC_URL}/api/marketplace/payments/sslcommerz/{success|fail|cancel|ipn}`. Cash on delivery does not need those values. Online and mobile-banking checkout cannot finish while the API is only on localhost.

API base: `http://localhost:3000/api`

## Auth

User tokens are **never** accepted as `Authorization: Bearer`. The client must send cookies and `X-CSRF-Token` on mutating routes (except `/auth/register`, `/auth/login`, `/auth/google`). The video call service is the exception: it uses `CALL_SERVICE_SECRET` as a Bearer secret on `/internal/consults/*`, and this API uses the same secret when it calls the call VM. That secret is not a user JWT.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | public | Health check |
| POST | `/auth/register` | public | Email/password, USER role |
| POST | `/auth/login` | public | Lockout after 5 failures |
| POST | `/auth/google` | public | `{ idToken }` |
| POST | `/auth/refresh` | cookie | Rotate refresh, reuse-detection |
| POST | `/auth/logout` | cookie | Revoke family, clear cookies |
| GET | `/auth/me` | cookie | Current user + role/profession/district |
| GET/PATCH | `/users/me` | cookie | Profile |
| GET | `/lookups/professions` | public | Profession chips |
| GET | `/admin/users` | ADMIN+ | List users |
| POST | `/admin/users` | ADMIN+ | Create a verified ADMIN |

Feature routes (cookie auth unless noted): `/diagnoses`, `/treatment-plans`, `/cost-estimates`, `/history`, `/reports`, `/tts`, `/tools`, `/receipts`, `/fertilizer`, `/crop-plans`, `/weather`, `/notifications`, `/consults`.

`POST /users/me/specialist-docs` stores the certificate and NID URLs and sets specialist review to `pending`. `PATCH /admin/users/:id/specialist` approves or rejects (`note` required on reject). Copy `CALL_SERVICE_URL` and `CALL_SERVICE_SECRET` from `.env.example`. On Vercel, set both in the API project environment or video rooms stay off. Details: the root [README](../README.md#farmer-specialist-video-consult) and [SETUP.md](../SETUP.md#17-video-consult).

Public reads: `GET /market/prices`, `GET /market/heatmap`, `GET /marketplace/products`, `GET /marketplace/shops`.

Marketplace (cookie): `/marketplace/cart`, `/marketplace/orders` (`POST /quote` then checkout), `/marketplace/wallet` (summary and payout requests).

SSLCommerz callbacks are public and are **not** wrapped in the JSON envelope: `/marketplace/payments/sslcommerz/*`.

Admin (ADMIN+): `/admin/overview`, `/admin/commerce`, `/admin/delivery`, `/admin/payouts`, `/admin/reports`, `/admin/notifications`, `/admin/users`. Delivery defaults are 60 BDT in the shop's district and 120 BDT elsewhere. A payout stays pending until an admin posts `paid` or `rejected`. The API does not send the money.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Dev server with watch |
| `npm run build` | Production build |
| `npm run test` | Unit tests |
| `npm run test:e2e` | E2E tests |
