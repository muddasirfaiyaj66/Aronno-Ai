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
npm install
npm start
```

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
