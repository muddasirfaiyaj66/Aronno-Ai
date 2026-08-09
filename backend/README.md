# Aronno Backend

Nest.js API starter for Aronno.

## Stack

- Nest.js 11
- TypeScript
- `@nestjs/config` for env
- `class-validator` / `class-transformer` for DTO validation

## Setup

```bash
cd backend
cp .env.example .env
npm install
npm run start:dev
```

API base: `http://localhost:3000/api`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api` | API info |
| GET | `/api/health` | Health check |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Dev server with watch |
| `npm run build` | Build for production |
| `npm run start:prod` | Run production build |
| `npm run test` | Unit tests |
| `npm run test:e2e` | E2E tests |
| `npm run lint` | Lint |
