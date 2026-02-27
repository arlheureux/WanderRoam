<p align="center">
  <img src="https://raw.githubusercontent.com/arlheureux/WanderRoam/refs/heads/master/frontend/public/logo.svg" width="120" alt="WanderRoam Logo"/>
</p>

<h1 align="center">WanderRoam</h1>

<p align="center">
  Share your outdoor adventures with GPX tracks, photos, and interactive maps.
</p>

<p align="center">
  <a href="https://github.com/arlheureux/WanderRoam/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/arlheureux/WanderRoam/docker.yml?branch=master" alt="Build Status">
  </a>
  <a href="https://github.com/arlheureux/WanderRoam/releases">
    <img src="https://img.shields.io/github/v/release/arlheureux/WanderRoam" alt="Release">
  </a>
  <a href="https://github.com/arlheureux/WanderRoam/blob/master/LICENSE">
    <img src="https://img.shields.io/github/license/arlheureux/WanderRoam" alt="License">
  </a>
</p>

---

## Features

- **Adventure Management** - Create and organize your outdoor trips
- **GPX Tracking** - Upload and visualize GPX tracks on OpenStreetMap
- **GPX Routing** - Calculate routes using BRouter for car, bike, foot, boat, train, metro
- **Waypoints** - Add custom markers with icons on the map
- **Tags** - Categorize adventures with custom tags and categories. Create any tag with your own category name.
- **Photo Integration** - Connect to Immich for photo management
- **Sharing** - Share adventures with other users
- **Multiple Transport Types** - Hiking, cycling, running, climbing
- **Admin Panel** - User management on port 4000

## Security

- **Rate Limiting** - Auth endpoints limited to 5 attempts per 60 minutes per IP
- **JWT Authentication** - Token-based authentication (24h expiry)
- **CORS configurable** - Restrict access by origin

## Tech Stack

- **Frontend**: React, React Router, Leaflet
- **Backend**: Node.js, Express, Sequelize
- **Database**: PostgreSQL
- **Maps**: OpenStreetMap / Leaflet
- **Routing**: BRouter (self-hosted)

## Quick Start

### Prerequisites

- Docker & Docker Compose

### Deployment

### Branches

| Branch | Docker Tag | Description |
|--------|------------|-------------|
| `master` | `:stable` | Stable production version |
| `dev` | `:latest` | Development version for testing |

### Stable Version (recommended)
```bash
# Fetch the docker-compose file and environment template
wget -O docker-compose.yml https://raw.githubusercontent.com/arlheureux/WanderRoam/master/docker-compose.yml
wget -O .env https://raw.githubusercontent.com/arlheureux/WanderRoam/master/.env.example

# Start services
docker compose up -d
```

### Development Version (testing new features)
```bash
# Fetch the docker-compose file and environment template
wget -O docker-compose.yml https://raw.githubusercontent.com/arlheureux/WanderRoam/dev/docker-compose.dev.yml
wget -O .env https://raw.githubusercontent.com/arlheureux/WanderRoam/dev/.env.example

# Start services
docker compose up -d
```

Docker Hub images:
- **Stable**: `arlheureux/wanderroam-{service}:stable`
- **Development**: `arlheureux/wanderroam-{service}:latest`

Services:
- Main App: http://localhost:3000
- Admin Panel: http://localhost:4000
- API: http://localhost:5000

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and update the values before deploying.

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | postgres | Database host |
| `DB_PORT` | 5432 | Database port |
| `DB_NAME` | wanderroam | Database name |
| `DB_USER` | wanderroam | Database user |
| `DB_PASSWORD` | wanderroam_password | Database password |
| `PORT` | 5000 | Server port |
| `TZ` | Europe/Paris | Timezone for date formatting |
| `JWT_SECRET` | wanderroam_secret_key_change_in_production | JWT signing secret (change!) |
| `ENABLE_REGISTRATION` | true | Allow new user registration |
| `UPLOAD_DIR` | /app/uploads | Upload directory |
| `BROUTER_URL` | http://brouter:17777/brouter | BRouter routing service URL |

### BRouter Configuration

BRouter is a self-hosted routing engine that calculates routes between waypoints. It's integrated into the GPX editor modal for calculating routes.

#### Segment Files

BRouter requires segment files (`.rd5`) which contain the routing data. These are downloaded automatically based on the `COUNTRIES` environment variable.

| Variable | Default | Description |
|----------|---------|-------------|
| `COUNTRIES` | france,denmark | Comma-separated list of countries to download segments for |

Available segments:
- **France**: E0_N40 to W10_N55 (17 segments)
- **Denmark**: E0_N55, E5_N55, W5_N55, W10_N55 (4 segments)

The segment files are downloaded from `https://brouter.de/brouter/segments4/` and stored in a Docker volume.

#### Supported Transportation Modes

| Mode | BRouter Profile | Color |
|------|-----------------|-------|
| Car | car-vario | #FC5C65 |
| Bike | trekking | #4ECDC4 |
| Foot / Walking | hiking | #FF9F43 |
| Boat | river | #2D98DA |
| Train | rail | #45B7D1 |
| Metro | shortest | #A55EEA |

#### Reproduce the BRouter Setup

The BRouter image is pre-built and available on Docker Hub. When you start the services, it will automatically download the segment files for the configured countries.

```bash
# Clone the repository
git clone -b dev https://github.com/arlheureux/WanderRoam.git
cd WanderRoam

# Start services (brouter will download segments automatically)
docker compose -f docker-compose.dev.yml up -d
```

The BRouter service will be available at `http://localhost:17777`

#### Disabling BRouter

If you don't need routing functionality, you can disable BRouter by removing or commenting out the `brouter` service in `docker-compose.dev.yml`. The GPX editor will still work for manual drawing and GPX file imports.

### Default Credentials

Register a new account at http://localhost:3000/register. The first registered user becomes admin automatically.

## Development

```
docker-app/
├── frontend/          # React frontend (port 3000)
├── backend/           # Express API (port 5000)
├── admin/             # Admin panel (port 4000)
├── docker-compose.yml       # Stable version
└── docker-compose.dev.yml  # Development version
```

## License

GNU General Public License v3.0 (GPLv3) - see [LICENSE](LICENSE) for details.

## Acknowledgments

- **BRouter** - Open-source routing engine. See [https://github.com/abrensch/brouter](https://github.com/abrensch/brouter)

Built with [OpenCode](https://opencode.ai) AI assistant (big-pickle model).
