/**
 * Ramer-Douglas-Peucker algorithm for simplifying GPS tracks
 * Reduces number of points while preserving shape
 */

// Calculate perpendicular distance from point to line segment
function perpendicularDistance(point, lineStart, lineEnd) {
  const { lat: x, lng: y } = point;
  const { lat: x1, lng: y1 } = lineStart;
  const { lat: x2, lng: y2 } = lineEnd;

  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  
  if (lenSq === 0) {
    // lineStart and lineEnd are the same point
    const dx = x - x1;
    const dy = y - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  let param = dot / lenSq;
  param = Math.max(0, Math.min(1, param));

  const dx = x - (x1 + param * C);
  const dy = y - (y1 + param * D);
  return Math.sqrt(dx * dx + dy * dy);
}

// Recursive RDP implementation
function rdp(points, epsilon, start, end, keepFlags) {
  if (end - start < 2) return;

  let maxDist = 0;
  let maxIdx = start;

  for (let i = start + 1; i < end; i++) {
    const dist = perpendicularDistance(points[i], points[start], points[end]);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    keepFlags[maxIdx] = true;
    rdp(points, epsilon, start, maxIdx, keepFlags);
    rdp(points, epsilon, maxIdx, end, keepFlags);
  }
}

/**
 * Simplify a GPX track using Ramer-Douglas-Peucker algorithm
 * @param {Array} points - Array of {lat, lng, ele?, time?} objects
 * @param {number} tolerance - Simplification tolerance in degrees
 * @returns {Array} Simplified points array
 */
export function simplifyGPX(points, tolerance) {
  if (!points || points.length <= 2) return points || [];

  const keepFlags = new Array(points.length).fill(false);
  keepFlags[0] = true;
  keepFlags[points.length - 1] = true;

  rdp(points, tolerance, 0, points.length - 1, keepFlags);

  return points.filter((_, idx) => keepFlags[idx]);
}

/**
 * Get simplification tolerance based on map zoom level
 * Higher zoom = more detail = lower tolerance
 * @param {number} zoom - Map zoom level
 * @returns {number} Tolerance in degrees
 */
export function getToleranceForZoom(zoom) {
  if (zoom >= 15) return 0.00001;   // ~1m detail
  if (zoom >= 12) return 0.0001;    // ~10m
  if (zoom >= 10) return 0.001;     // ~100m
  if (zoom >= 8) return 0.01;      // ~1km
  return 0.05;                      // ~5km (lowest detail)
}

/**
 * Simplify multiple tracks with shared tolerance
 * @param {Array} tracks - Array of track objects with data field
 * @param {number} zoom - Map zoom level
 * @returns {Array} Tracks with simplified data
 */
export function simplifyTracks(tracks, zoom) {
  if (!tracks || tracks.length === 0) return tracks;

  const tolerance = getToleranceForZoom(zoom);
  
  return tracks.map(track => {
    if (!track.data || track.data.length <= 2) return track;
    
    return {
      ...track,
      data: simplifyGPX(track.data, tolerance)
    };
  });
}
