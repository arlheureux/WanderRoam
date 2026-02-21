<p align="center">
  <img src="https://raw.githubusercontent.com/arlheureux/adventureshare/refs/heads/master/frontend/public/logo.svg" width="120" alt="WanderRoam Logo"/>
</p>

<h1 align="center">WanderRoam</h1>

<p align="center">
  Share your outdoor adventures with GPX tracks, photos, and interactive maps.
</p>

<p align="center">
  <a href="https://github.com/arlheureux/adventureshare/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/arlheureux/adventureshare/docker.yml?branch=master" alt="Build Status">
  </a>
  <a href="https://github.com/arlheureux/adventureshare/releases">
    <img src="https://img.shields.io/github/v/release/arlheureux/adventureshare" alt="Release">
  </a>
  <a href="https://github.com/arlheureux/adventureshare/blob/master/LICENSE">
    <img src="https://img.shields.io/github/license/arlheureux/adventureshare" alt="License">
  </a>
</p>

---

## Features

- **Adventure Management** - Create and organize your outdoor trips
- **GPX Tracking** - Upload and visualize GPX tracks on OpenStreetMap
- **Photo Integration** - Connect to Immich for photo management
- **Sharing** - Share adventures with other users
- **Multiple Transport Types** - Hiking, cycling, running, climbing
- **Admin Panel** - User management and administration

## Tech Stack

- **Frontend**: React, React Router, Leaflet
- **Backend**: Node.js, Express, Sequelize
- **Database**: PostgreSQL
- **Maps**: OpenStreetMap / Leaflet

## Quick Start

### Prerequisites

- Docker & Docker Compose

### Production Deployment

```bash
# Pull and run (after images are built)
docker-compose -f docker-compose.prod.yml up -d
```

Docker Hub images:
- `arnaudlhx/wanderroam-backend:latest`
- `arnaudlhx/wanderroam-frontend:latest`
- `arnaudlhx/wanderroam-admin:latest`

- Main App: http://localhost:3000
- Admin Panel: http://localhost:4000
- API: http://localhost:5000

### Local Development

```bash
# Build and run
docker-compose up -d

# Or run services individually
docker-compose up -d postgres backend
cd frontend && npm start
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | wanderroam_secret_key_change_in_production | JWT signing secret |
| `ENABLE_REGISTRATION` | true | Allow new user registration |
| `DB_HOST` | postgres | Database host |
| `DB_PASSWORD` | wanderroam_password | Database password |

### Default Credentials

After first run, create an admin user through the admin panel at port 4000.

## Development

```
docker-app/
├── frontend/          # React frontend (port 3000)
├── backend/           # Express API (port 5000)
├── admin/            # Admin panel (port 4000)
├── docker-compose.yml
└── docker-compose.prod.yml
```

## License

MIT License - see [LICENSE](LICENSE) for details.
