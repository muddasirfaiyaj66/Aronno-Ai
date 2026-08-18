# Aronno

Monorepo for the Aronno mobile app and API.

## Structure

```
aronno/
├── mobile/    # Expo (React Native) app
└── backend/   # Nest.js API
```

## Mobile

```bash
cd mobile
cp .env.example .env
npm install
npm start
```

Set `EXPO_PUBLIC_API_URL` (default `http://localhost:3000/api`). On Android emulator use `http://10.0.2.2:3000/api`.

Auth tokens live in httpOnly cookies (web) or the Expo SecureStore cookie jar (native). Redux Toolkit + RTK Query cache server data — JWTs are never stored in Redux.


## Backend

```bash
cd backend
cp .env.example .env
npm install
npm run start:dev
```

API base URL: `http://localhost:3000/api`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api` | API info |
| GET | `/api/health` | Health check |

## License

MIT — see [LICENSE](LICENSE).
