# WanderRoam Agent Instructions

## Architecture

Three services in monorepo:
- **frontend** (port 3000): React + react-scripts, Leaflet/react-map-gl
- **backend** (port 5000): Node.js/Express, Sequelize + PostgreSQL
- **admin** (port 4000): React admin panel

## Commands

```bash
# Backend: lint -> test (jest)
cd backend && npm run lint && npm run test

# Frontend: lint
cd frontend && npm run lint

# Dev servers
cd backend && npm run dev   # nodemon, port 5000
cd frontend && npm start   # react-scripts, port 3000
```

## Startup Order

Backend `start` script waits for PostgreSQL (port 5432) before launching. Do not run backend tests without a running postgres database.

## Dev Deployment

```bash
docker compose -f docker-compose.dev.yml up -d
```

Services: app (3000), admin (4000), api (5000), brouter (17777).

## Key Configs

- `.env`: DB credentials, JWT_SECRET, JWT_EXPIRY, TZ, BROUTER_URL
- `backend/routes/*.js`: API endpoints
- `backend/middleware/`: auth, validation, errorHandler
- `backend/config/database.js`: Sequelize setup