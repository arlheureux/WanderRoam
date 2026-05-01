# WanderRoam Agent Instructions

## Architecture

Monorepo with three services (ports in Docker, local dev differs):
- **backend** (5000): Express API, Sequelize + PostgreSQL, entrypoint `server.js`
- **frontend** (3000): React + react-scripts, Leaflet/react-map-gl, proxies to backend
- **admin** (4000): React admin panel (simplified frontend, no map deps)

Backend routes: `/api/auth`, `/api/adventures`, `/api/routing`, `/api/immich`, `/api/admin`, `/api/series`. Health check at `/api/health`.

## Commands

```bash
# Backend: lint before test (jest)
cd backend && npm run lint && npm test

# Run single backend test
cd backend && npx jest tests/auth.test.js

# Frontend: lint only (no test script configured)
cd frontend && npm run lint

# Dev servers
cd backend && npm run dev    # nodemon
cd frontend && npm start     # react-scripts
```

## Database

Backend `start` script polls PostgreSQL (port 5432) before launching. Tests require a running PostgreSQL instance. Sequelize syncs with `{ alter: true }` on startup (auto-migration).

## Docker Dev Deployment

```bash
docker compose -f docker-compose.dev.yml up -d
```

Exposed ports: frontend (3000), admin (4000), backend (5000), brouter (17777). Backend waits for postgres healthcheck. Frontend/admin ports map to container port 80 (nginx).

## Environment

Copy `.env.example` to `.env`. Key vars: `DB_HOST` (default `postgres`), `JWT_SECRET` (generate with `openssl rand -hex 32`), `CORS_ORIGIN`. `TZ` defaults to `Europe/Paris`.

## CI

GitHub Actions (`.github/workflows/docker.yml`): pushes `:stable` on master, `:latest` on dev. Version from `backend/package.json`. Dockerfiles in each service directory.