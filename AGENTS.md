# WanderRoam Agent Instructions

## Architecture

Self-hosted adventure-sharing app (GPX tracks, Immich photos, maps). Three Node services + routing engine:
- **backend** (5000): Express + Sequelize/PostgreSQL, entrypoint `server.js`. Routes: `/api/auth`, `/api/adventures`, `/api/routing`, `/api/immich`, `/api/admin`, `/api/series`; health at `/api/health`.
- **frontend** (3000): React 18 + **Vite** (not CRA), Leaflet/react-map-gl. Build output is `build/` (not `dist/`). Dev proxy sends `/api` → localhost:5000.
- **admin** (4000): React panel (react-scripts; no lint script).
- **brouter** (17777): prebuilt image; `COUNTRIES` env controls downloaded `.rd5` segments.

Version single-source-of-truth: `backend/package.json`.

## Commands

```bash
cd backend && npm run lint && npm test   # unit tests only (JWT/GPX utils), no DB required
cd frontend && npx vitest run            # vitest is wired but there are NO test files yet (exits "No test files found")
cd frontend && npm run lint              # eslint src --ext .js,.jsx

cd backend && npm run dev                # local API :5000 (nodemon)
cd frontend && npm start                 # vite dev :3000
```

## Environment / DB

- `.env` defaults are Docker service names: running locally needs `DB_HOST=localhost` (dev compose does not expose postgres).
- Secrets generated with `openssl rand -hex 32`: `JWT_SECRET`, `IMMICH_ENCRYPTION_KEY`. `TZ` defaults to Europe/Paris (affects date formatting).
- Schema: non-production auto-syncs via `sequelize.sync({ alter: true })`. **Production skips sync** — schema changes require a SQL migration in `backend/migrations/`.

## Docker dev deployment

```bash
docker compose -f docker-compose.dev.yml up -d
```

No hot reload despite source mounts: frontend/admin serve nginx-built assets (rebuild needed); backend runs plain `node server.js` (restart container after edits).

## Release / CI

1. Bump `backend/package.json` version, merge to `master`, tag `vX.Y.Z` — release.yml fails if tag ≠ package.json version.
2. Tag push → docker.yml builds/pushes `arlheureux/wanderroam-{backend,frontend,admin}:vX.Y.Z` + `:stable`. No `:latest`, no dev-branch builds.

Ops: `scripts/backup.sh` / `restore.sh` (pg_dump + uploads volume + .env); `scripts/backup-restic.sh` (restic snapshots, env-driven target).

## Gotchas

- `frontend/vite.config.js` intentionally disables tree-shaking/mangling (minification broke prod builds before) — do not re-enable.
