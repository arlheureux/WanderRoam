# AdventureShare - Specification Document

## 1. Project Overview

**Project Name:** AdventureShare
**Type:** Full-stack Docker web application
**Core Functionality:** A platform to share outdoor adventures consisting of maps, GPX tracks, and photos with Immich integration
**Target Users:** Outdoor enthusiasts, hikers, cyclists, travelers

## 2. Architecture

### Tech Stack
- **Frontend:** React 18 with Leaflet for maps
- **Backend:** Node.js/Express
- **Database:** PostgreSQL
- **File Storage:** Local filesystem with uploaded GPX and images
- **Photo Management:** Immich (self-hosted photo library)
- **Containerization:** Docker & Docker Compose

### Services
1. **Frontend** - React app on port 3000
2. **Backend** - Express API on port 5000
3. **PostgreSQL** - Database on port 5432
4. **Immich** - Photo management on ports 2283 (server), 8081 (web)

## 3. Data Model

### Users
- `id` - UUID primary key
- `username` - unique string
- `email` - unique string
- `password_hash` - bcrypt hash
- `created_at` - timestamp

### Adventures
- `id` - UUID primary key
- `user_id` - foreign key to users
- `name` - string
- `description` - text (optional)
- `center_lat` - decimal (map center)
- `center_lng` - decimal (map center)
- `zoom` - integer (default 10)
- `created_at` - timestamp
- `updated_at` - timestamp

### GPX Tracks
- `id` - UUID primary key
- `adventure_id` - foreign key to adventures
- `name` - string
- `type` - enum (hiking, cycling, running, climbing, other)
- `color` - hex string (auto-assigned by type)
- `file_path` - string (stored GPX file)
- `data` - JSON (parsed GPX track points)
- `created_at` - timestamp

### Pictures
- `id` - UUID primary key
- `adventure_id` - foreign key to adventures
- `immich_asset_id` - string (Immich reference)
- `filename` - string
- `latitude` - decimal (photo GPS)
- `longitude` - decimal (photo GPS)
- `taken_at` - timestamp (optional)
- `created_at` - timestamp

### GPX Types & Colors
| Type | Color |
|------|-------|
| hiking | #FF6B6B (red) |
| cycling | #4ECDC4 (teal) |
| running | #45B7D1 (blue) |
| climbing | #96CEB4 (green) |
| other | #9B59B6 (purple) |

## 4. API Endpoints

### Authentication
- `POST /api/auth/register` - Create new user
- `POST /api/auth/login` - Login and get JWT
- `GET /api/auth/me` - Get current user

### Adventures
- `GET /api/adventures` - List user's adventures
- `POST /api/adventures` - Create adventure
- `GET /api/adventures/:id` - Get adventure with all data
- `PUT /api/adventures/:id` - Update adventure
- `DELETE /api/adventures/:id` - Delete adventure

### GPX Tracks
- `POST /api/adventures/:id/gpx` - Upload GPX file
- `DELETE /api/gpx/:id` - Delete GPX track
- `GET /api/gpx/:id` - Get GPX data

### Pictures
- `POST /api/adventures/:id/pictures` - Add picture (from Immich)
- `DELETE /api/pictures/:id` - Delete picture
- `GET /api/pictures/:id` - Get picture info

### Immich Integration
- `GET /api/immich/albums` - List Immich albums
- `GET /api/immich/assets` - List assets from Immich
- `POST /api/immich/connect` - Connect to Immich server

## 5. UI/UX Specification

### Pages
1. **Login/Register** - Authentication forms
2. **Dashboard** - List of user's adventures with thumbnails
3. **Adventure Editor** - Create/edit adventure with map
4. **Adventure View** - Public view of adventure with map

### Map Features
- OpenStreetMap base layer
- GPX track rendering with colored polylines
- Picture markers on map (clickable thumbnails)
- Auto-fit bounds to show all GPX tracks
- Zoom controls

### Color Palette
- Primary: #2D3436 (dark gray)
- Secondary: #636E72 (medium gray)
- Accent: #00B894 (teal green)
- Background: #F5F6FA (light gray)
- Card: #FFFFFF (white)

### Typography
- Font: "Inter", system-ui, sans-serif
- Headings: 600 weight
- Body: 400 weight

## 6. Immich Integration

### Setup
- Immich runs as separate container
- User connects via API key from Immich admin
- Photos stored in Immich, referenced by asset ID

### Flow
1. User enters Immich URL and API key in settings
2. Browse Immich albums/assets
3. Select photos to add to adventure
4. GPS coordinates extracted from Immich EXIF data
5. Photos displayed on map at their coordinates

## 7. File Structure

```
docker-app/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js
│   ├── config/
│   │   └── database.js
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── adventures.js
│   │   ├── gpx.js
│   │   ├── pictures.js
│   │   └── immich.js
│   └── models/
│       └── index.js
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── public/
│   ├── src/
│   │   ├── index.js
│   │   ├── App.js
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── styles/
│   └── nginx.conf
└── data/
    ├── postgres/
    ├── uploads/
    └── immich/
```

## 8. Acceptance Criteria

- [ ] Users can register and login
- [ ] Users can create, edit, delete adventures
- [ ] Users can upload GPX files to adventures
- [ ] GPX tracks display on map with correct colors by type
- [ ] Users can connect to Immich and browse photos
- [ ] Photos from Immich appear on map at GPS coordinates
- [ ] Multiple GPX tracks can be displayed on same map
- [ ] Adventure view shows map with all tracks and photos
- [ ] Docker Compose starts all services
- [ ] Application is accessible via browser
