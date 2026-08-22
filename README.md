# Aronno (আরণ্য)

Bangla-first farming assistant: crop photos, treatment, market prices, and loans. This repository is a monorepo.

| Folder | Stack |
|--------|--------|
| [`backend/`](backend/) | Nest.js 11 API, Prisma, MongoDB, cookie JWT |
| [`mobile/`](mobile/) | Expo SDK 54 (React Native), Redux Toolkit + RTK Query |

**Full clone → run → APK → database ERD guide (written for non-developers too):** **[SETUP.md](SETUP.md)**

## Quick start

You need [Git](https://git-scm.com), [Node.js LTS](https://nodejs.org), and [MongoDB](https://www.mongodb.com) (local or free Atlas).

```bash
git clone https://github.com/muddasirfaiyaj66/Aronno-Ai.git
cd Aronno-Ai
```

**API** (terminal 1):

```bash
cd backend
copy .env.example .env
npm install
npx prisma generate
npx prisma db push
npm run start:dev
```

Generate JWT secrets with Node (do not reuse sample strings in production):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste two different values into `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in `backend/.env`.

**App** (terminal 2):

```bash
cd mobile
copy .env.example .env
pnpm install
pnpm start
```

Set Cloudinary keys in `mobile/.env` before using the camera. Details: [SETUP.md](SETUP.md).

Health check: [http://localhost:3000/api/health](http://localhost:3000/api/health)

Demo farmer (seeded farm data, already verified): `demo@gmail.com` / `demo1234`

Superadmin comes from `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` in `backend/.env`. After that login, create more admins from **আমি → অ্যাডমিন তৈরি**. Admins can create further admins.

## What is finished

Screens talk to the real API (auth, OTP email, diagnoses, treatment, market, loans, …). Photos upload to **Cloudinary**; the API stores URLs. Gemini disease detection is still a **mock** so the product can run without a paid AI key.

## License

MIT — see [LICENSE](LICENSE).
