# Aronno Backend

Nest.js 11 API for the Aronno mobile app. Cookies-only JWT auth, Prisma + MongoDB, Zod validation, role-based access.

## Stack

- Nest.js 11, Prisma 6, MongoDB
- Argon2id passwords, Google ID-token (OAuth 2.1)
- httpOnly cookies: `aronno_access` (15m), `aronno_refresh` (7d), `aronno_csrf` (not HttpOnly)
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

On boot the API upserts roles, professions, districts, crops, loan purposes, and seeds a **SUPERADMIN** if none exists (from `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` in `.env`). Superadmin and admin can `POST /api/admin/users` to create more verified admins.

API base: `http://localhost:3000/api`

## Auth

Tokens are **never** accepted as `Authorization: Bearer`. The client must send cookies and `X-CSRF-Token` on mutating routes (except `/auth/register`, `/auth/login`, `/auth/google`).

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

Feature routes (cookie auth): `/diagnoses`, `/treatment-plans`, `/cost-estimates`, `/history`, `/reports`, `/tts`, `/tools`, `/receipts`, `/fertilizer`, `/yield`, `/crop-plans`, `/market`, `/loans`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Dev server with watch |
| `npm run build` | Production build |
| `npm run test` | Unit tests |
| `npm run test:e2e` | E2E tests |
