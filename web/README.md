# Aronno web (`/web`)

Next.js promotional site + admin-only dashboard. Talks to the Nest API via a same-origin BFF at `/api/[...path]` (cookies + CSRF).

## Run locally

1. Start the backend on port **3000** (`backend`).
2. In this folder:

```bash
npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001).

Admin: [http://localhost:3001/admin/login](http://localhost:3001/admin/login) — only `ADMIN` / `SUPERADMIN`.

## Env

| Variable | Where | Value |
|----------|--------|--------|
| `ARONNO_API_ORIGIN` | Vercel **web** (production/preview) | `https://aronno-api.vercel.app` |
| `ARONNO_API_ORIGIN` | Local `.env.local` | `http://localhost:3000` |
| `CORS_ORIGIN` | Vercel **backend** | include `https://aronnoaibd.vercel.app` (and local Expo/web origins) |

`.env.local` (local only):

```
ARONNO_API_ORIGIN=http://localhost:3000
```

## Routes

| Path | Purpose |
|------|---------|
| `/` | Bangla marketing landing |
| `/admin/login` | Staff login |
| `/admin` | Overview stats |
| `/admin/users` | List / activate / role |
| `/admin/create` | Create admin user |
