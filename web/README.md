# Aronno web (`/web`)

Next.js site for the public Bangla pages and the English admin monitor. The browser talks to the Nest API through a same-origin proxy at `/api/[...path]` (cookies and CSRF).

The public pages stay in Bangla. The monitor is English. Staff can collapse the sidebar and switch light and dark; both choices are stored in the browser (`aronno.admin.sidebar`, `aronno.admin.theme`).

Staff review agronomist and extension-officer documents at `/admin/specialists` before those accounts appear in the app consult list. Reject requires a note. The website does not join the video call.

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

Online checkout is configured on the **API**, not here. `API_PUBLIC_URL` in `backend/.env` must be the public `https` Nest origin.

## Routes

| Path | Purpose |
|------|---------|
| `/` | Bangla landing (field hero, capabilities, soil-meter preview) |
| `/heatmap` | Public disease heat map |
| `/market` | Public prices, products, and shops. Buying stays in the app |
| `/admin/login` | Staff login |
| `/admin` | Operations monitor, attention counts, refresh |
| `/admin/market` | Shops and orders |
| `/admin/reports` | Seller reports |
| `/admin/payouts` | Mark seller payout requests paid or rejected |
| `/admin/delivery` | Same-city and other-city delivery fees |
| `/admin/users` | List, activate, and change role |
| `/admin/specialists` | Review certificate and national ID. Approve, or reject with a note |
| `/admin/notifications` | Broadcast an alert |
| `/admin/create` | Create an admin user |
