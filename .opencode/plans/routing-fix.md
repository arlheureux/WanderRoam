# Routing Fix Plan

## Problem
Frontend expects `data.coordinates` (GeoJSON format `[lng, lat, ele]`), but backend returns `data.points` (array of `{lng, lat, ele}` objects). This causes routing to always fail with "No route found" error.

## Root Cause
- Backend (`backend/routes/routing.js:116`) returns: `{ points: [{lng, lat, ele}, ...], distance, mode, color }`
- Frontend (`frontend/src/components/GpxEditorModal.js:258`) checks for `data.coordinates` which never exists

## Solution
Modify `frontend/src/components/GpxEditorModal.js` lines 258-266 to use correct response format.

### Exact Code Change
**File:** `frontend/src/components/GpxEditorModal.js`
**Lines:** 258-266

**Current code:**
```javascript
if (data.coordinates && data.coordinates.length > 0) {
  const routePoints = data.coordinates.map(c => ({
    lat: c[1],
    lng: c[0],
    ele: null,
    time: null
  }));
  setNewPoints(routePoints);
  setMode('edit');
} else {
  setRoutingError('No route found');
}
```

**Fixed code:**
```javascript
if (data.points && data.points.length > 0) {
  const routePoints = data.points.map(p => ({
    lat: p.lat,
    lng: p.lng,
    ele: p.ele || null,
    time: null
  }));
  setNewPoints(routePoints);
  setMode('edit');
} else {
  setRoutingError('No route found');
}
```

## Additional Notes
- BRouter service needs to be running (currently not active per `docker ps` check)
- Start with: `docker compose -f docker-compose.dev.yml up -d brouter`
