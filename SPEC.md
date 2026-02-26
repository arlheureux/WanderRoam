# WanderRoam - Specification Document

## License

GNU General Public License v3.0 (GPLv3) - see [LICENSE](LICENSE) for details.

## 1. Project Overview

**Project Name:** WanderRoam
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
1. **Frontend** - React app on port 3000 (nginx)
2. **Backend** - Express API on port 5000
3. **PostgreSQL** - Database on port 5432
4. **Admin** - Admin panel on port 4000 (nginx)

## 3. Data Model

### Users
- `id` - UUID primary key
- `username` - unique string
- `password_hash` - bcrypt hash
- `isAdmin` - boolean (first user is admin)
- `immich_url` - string (optional)
- `immich_api_key` - string (optional)
- `created_at` - timestamp

### Adventures
- `id` - UUID primary key
- `user_id` - foreign key to users
- `name` - string
- `description` - text (optional)
- `center_lat` - decimal (map center)
- `center_lng` - decimal (map center)
- `zoom` - integer (default 10)
- `preview_picture_id` - UUID (optional, selected preview)
- `created_at` - timestamp
- `updated_at` - timestamp

### GPX Tracks
- `id` - UUID primary key
- `adventure_id` - foreign key to adventures
- `name` - string
- `type` - enum (walking, hiking, cycling, bus, metro, train, boat, car, other)
- `color` - hex string (auto-assigned by type)
- `file_path` - string (stored GPX file)
- `data` - JSON (parsed GPX track points)
- `distance` - float (distance in km)
- `created_at` - timestamp

### Pictures
- `id` - UUID primary key
- `adventure_id` - foreign key to adventures
- `immich_asset_id` - string (Immich reference)
- `filename` - string
- `latitude` - decimal (photo GPS)
- `longitude` - decimal (photo GPS)
- `taken_at` - timestamp (optional)
- `thumbnail_url` - text (cached preview image)
- `created_at` - timestamp

### Adventure Shares
- `id` - UUID primary key
- `adventure_id` - foreign key to adventures
- `user_id` - foreign key to users
- `permission` - enum (view, edit)

### Waypoints
- `id` - UUID primary key
- `adventure_id` - foreign key to adventures
- `name` - string (optional)
- `icon` - string (emoji, default 📍)
- `latitude` - decimal (required)
- `longitude` - decimal (required)
- `created_at` - timestamp

### Tags
- `id` - UUID primary key
- `name` - string (unique)
- `color` - hex string
- `type` - enum (activity, location)

### Adventure Tags (many-to-many)
- `adventure_id` - foreign key to adventures
- `tag_id` - foreign key to tags

### Predefined Tags
| Name | Type | Color |
|------|------|-------|
| Hiking | activity | #FF9F43 |
| Cycling | activity | #4ECDC4 |
| Walking | activity | #FF6B6B |
| Running | activity | #26DE81 |
| Swimming | activity | #45B7D1 |
| Skiing | activity | #A55EEA |
| Kayaking | activity | #2D98DA |
| Mountain | location | #9B59B6 |
| Sea | location | #45B7D1 |
| Forest | location | #26DE81 |
| City | location | #FC5C65 |

### Transportation Types & Colors
| Type    | Color   |
|---------|---------|
| walking | #FF6B6B |
| hiking  | #FF9F43 |
| cycling | #4ECDC4 |
| bus     | #A55EEA |
| metro   | #26DE81 |
| train   | #45B7D1 |
| boat    | #2D98DA |
| car     | #FC5C65 |
| other   | #9B59B6 |

## 4. API Endpoints

### Authentication
- `POST /api/auth/register` - Create new user (can be disabled via ENABLE_REGISTRATION)
- `POST /api/auth/login` - Login and get JWT
- `GET /api/auth/me` - Get current user
- `GET /api/auth/config` - Get registration status

### Adventures
- `GET /api/adventures` - List user's adventures + shared adventures
- `GET /api/adventures?tags=id1,id2` - Filter by tags (inclusive)
- `POST /api/adventures` - Create adventure
- `GET /api/adventures/:id` - Get adventure with all data
- `PUT /api/adventures/:id` - Update adventure
- `DELETE /api/adventures/:id` - Delete adventure

### Sharing
- `GET /api/adventures/:id/share` - Get share list
- `POST /api/adventures/:id/share` - Share adventure with user
- `DELETE /api/adventures/:id/share/:shareId` - Remove share

### GPX Tracks
- `POST /api/adventures/:id/gpx` - Upload GPX file
- `PUT /api/gpx/:id` - Update GPX track (name, type, color, data)
- `DELETE /api/adventures/:id/gpx/:gpxId` - Delete GPX track
- `GET /api/gpx/:id` - Get GPX track
- `GET /api/gpx/:id/data` - Get GPX track data points

### Pictures
- `POST /api/adventures/:id/pictures` - Add picture (from Immich)
- `DELETE /api/adventures/:id/pictures/:pictureId` - Delete picture

### Waypoints
- `POST /api/adventures/:id/waypoints` - Create waypoint
- `PUT /api/adventures/:id/waypoints/:waypointId` - Update waypoint
- `DELETE /api/adventures/:id/waypoints/:waypointId` - Delete waypoint

### Tags
- `GET /api/adventures/tags` - List all available tags
- `POST /api/adventures/tags` - Create a new tag (name, category)
- `DELETE /api/adventures/tags/:id` - Delete a tag (removes from all adventures)
- `PUT /api/adventures/:id/tags` - Update adventure tags (replace all)

### Immich Integration
- `GET /api/immich/albums` - List Immich albums with thumbnails
- `GET /api/immich/assets` - List assets from Immich (with GPS)
- `GET /api/immich/thumbnails` - Batch fetch thumbnails
- `GET /api/immich/thumbnail/:assetId` - Get thumbnail proxy
- `GET /api/immich/asset/:id` - Get asset info

### Users
- `GET /api/adventures/users` - List other users (for sharing)

## 5. UI/UX Specification

### Pages
1. **Login/Register** - Authentication forms (register hidden if disabled)
2. **Dashboard** - List of adventures with preview pictures and tag filter
3. **Adventure Editor** - Edit adventure with map, sidebar panels, tag selector
4. **Adventure View** - View adventure with map (read-only for shared)

### Map Features
- OpenStreetMap base layer
- GPX track rendering with colored polylines
- Picture markers on map (clickable)
- Waypoint markers with emoji icons (click to add/edit)
- Hover highlighting (marker scales up, others fade)
- Auto-fit bounds to show all content
- Zoom controls

### Waypoint Icons
| Icon | Description |
|------|-------------|
| 📍 | Marker (default) |
| 🏃 | Break |
| 🍽️ | Food |
| 📸 | Photo |
| 🚿 | Bath |
| 🏔️ | Viewpoint |
| ⚠️ | Danger |
| ⛺ | Camp |
| 🅿️ | Parking |
| 💧 | Water |
| 🔍 | View |

### Sidebar Panels (Edit/View)
- Description (textarea/card)
- Tags (clickable chips to select/deselect)
- Transportation (GPX tracks list with distance)
- Pictures (grid with add/remove)

### Fullscreen Picture Viewer
- Click picture to open fullscreen
- Navigation arrows (← →)
- Picture counter (1 / N)
- Close button (×)
- Click outside to close

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
- User connects via URL and API key from Immich admin
- Photos stored in Immich, referenced by asset ID

### Flow
1. User enters Immich URL and API key in settings
2. Browse Immich albums (grid view with thumbnails)
3. Select album to see photos with GPS coordinates
4. Select photos to add to adventure
5. GPS coordinates extracted from Immich EXIF data
6. Preview images cached in database (preview size)
7. Photos displayed on map at their coordinates

### Image Optimization
- Thumbnails fetched on adventure load (cached in DB)
- Preview size from Immich (larger than thumbnail)
- Fullscreen uses cached preview (to reduce transfer)

## 7. Sharing

### Features
- Share adventures with other users
- Permission levels: view or edit
- Shared adventures appear in owner's dashboard
- Shared users see adventures they can access
- Read-only indicator for non-owners
- Edit disabled for view-only shared users

### Sharing Flow
1. Owner clicks Share button in edit mode
2. Select user from dropdown
3. Choose permission (view/edit)
4. Shared user sees adventure on their dashboard

## 8. Release & Deployment

### Branches
| Branch | Docker Tag | Description |
|--------|------------|-------------|
| `master` | `:stable`, `:v0.x` | Stable production version |
| `dev` | `:latest` | Development version for testing |

### Docker Compose Files
- `docker-compose.yml` - Stable version (pulls :stable images)
- `docker-compose.dev.yml` - Development version (pulls :latest images)

### File Structure

```
docker-app/
├── docker-compose.yml          # Stable version
├── docker-compose.dev.yml      # Development version
├── SPEC.md
├── .gitignore
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
│   │   └── immich.js
│   └── models/
│       └── index.js
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── nginx.conf
    ├── public/
    └── src/
        ├── index.js
        ├── App.js
        ├── components/
        ├── pages/
        ├── services/
        └── styles/
```

## 9. Environment Variables

### Backend
- `PORT` - server port (default 5000)
- `TZ` - timezone for date formatting (default Europe/Paris)
- `DB_HOST` - PostgreSQL host
- `DB_PORT` - PostgreSQL port
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `JWT_SECRET` - JWT signing secret
- `UPLOAD_DIR` - Upload directory
- `ENABLE_REGISTRATION` - Enable/disable registration (default true)

### Frontend
- `REACT_APP_API_URL` - Backend API URL (default /api via nginx proxy)

## 10. Security

### Rate Limiting
- Auth endpoints (`/api/auth/*`) limited to 5 attempts per 60 minutes per IP
- Returns 429 status with error message when exceeded

### Authentication
- JWT-based authentication
- Token expiry: 24 hours

### CORS
- Configurable via `CORS_ORIGIN` environment variable
- Default: `http://frontend:3000`

## 11. Acceptance Criteria

- [x] Users can register and login
- [x] Registration can be disabled via environment variable
- [x] Users can create, edit, delete adventures
- [x] Users can upload GPX files to adventures
- [x] GPX tracks display on map with correct colors by type
- [x] GPX distance is calculated and displayed
- [x] Users can connect to Immich and browse albums
- [x] Album thumbnails displayed correctly
- [x] Photos from Immich appear on map at GPS coordinates
- [x] Preview pictures can be selected for adventure cards
- [x] Multiple GPX tracks can be displayed on same map
- [x] Adventure view shows map with all tracks and photos
- [x] Picture markers highlight on hover
- [x] Fullscreen picture viewer with slideshow
- [x] Description field for adventures
- [x] Adventures can be shared with other users
- [x] Shared users can view (or view/edit) shared adventures
- [x] Users can add waypoints by clicking on the map
- [x] Waypoints display with emoji icons on the map
- [x] Waypoints can be edited (name, icon) and deleted
- [x] Users can tag adventures with predefined activity/location tags
- [x] Tag filter on dashboard allows filtering by selected tags
- [x] Tags display on adventure cards in dashboard
- [x] Users can create custom tags with activity or location type
- [x] Tags grouped by category with headers (Activities, Locations)
- [x] Docker Compose starts all services
- [x] Application is accessible via browser
- [x] Pre-built images can be used for deployment
