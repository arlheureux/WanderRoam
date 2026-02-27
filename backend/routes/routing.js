const express = require('express');
const axios = require('axios');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const ROUTING_PROFILES = {
  car: 'car-vario',
  bike: 'trekking',
  foot: 'hiking',
  boat: 'river',
  train: 'rail',
  metro: 'shortest'
};

const TYPE_COLORS = {
  car: '#FC5C65',
  bike: '#4ECDC4',
  foot: '#FF9F43',
  boat: '#2D98DA',
  train: '#45B7D1',
  metro: '#A55EEA'
};

function calculateDistance(points) {
  if (!points || points.length < 2) return 0;
  
  let totalDistance = 0;
  for (let i = 1; i < points.length; i++) {
    const [lat1, lon1] = [points[i-1].lat, points[i-1].lng || points[i-1].lon];
    const [lat2, lon2] = [points[i].lat, points[i].lng || points[i].lon];
    
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    totalDistance += R * c;
  }
  
  return totalDistance;
}

function parseGeoJsonToPoints(geoJson) {
  const points = [];
  
  if (geoJson && geoJson.features) {
    geoJson.features.forEach(feature => {
      if (feature.geometry && feature.geometry.coordinates) {
        const coords = feature.geometry.coordinates;
        if (feature.geometry.type === 'LineString') {
          coords.forEach(coord => {
            points.push({
              lng: coord[0],
              lat: coord[1],
              ele: coord[2] || null
            });
          });
        }
      }
    });
  }
  
  return points;
}

router.post('/route', authMiddleware, async (req, res) => {
  try {
    const { waypoints, mode } = req.body;
    
    if (!waypoints || !Array.isArray(waypoints) || waypoints.length < 2) {
      return res.status(400).json({ error: 'At least 2 waypoints required (start and end)' });
    }
    
    if (!mode || !ROUTING_PROFILES[mode]) {
      return res.status(400).json({ error: 'Invalid mode. Supported: car, bike, foot, boat, train, metro' });
    }
    
    const brouterProfile = ROUTING_PROFILES[mode];
    const brouterUrl = process.env.BROUTER_URL || 'http://brouter:17777/brouter';
    
    let allPoints = [];
    let totalDistance = 0;
    
    for (let i = 0; i < waypoints.length - 1; i++) {
      const start = waypoints[i];
      const end = waypoints[i + 1];
      
      const lonlats = `${start.lng},${start.lat};${end.lng},${end.lat}`;
      
      const response = await axios.get(brouterUrl, {
        params: {
          lonlats,
          profile: brouterProfile,
          format: 'geojson'
        },
        timeout: 60000
      });
      
      if (response.data && response.data.features) {
        const legPoints = parseGeoJsonToPoints(response.data);
        
        if (i > 0 && allPoints.length > 0) {
          allPoints.pop();
        }
        allPoints = allPoints.concat(legPoints);
      }
    }
    
    totalDistance = calculateDistance(allPoints);
    
    res.json({
      points: allPoints,
      distance: Math.round(totalDistance * 100) / 100,
      mode,
      color: TYPE_COLORS[mode]
    });
    
  } catch (error) {
    console.error('Routing error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'Routing service unavailable' });
    }
    if (error.response) {
      return res.status(error.response.status).json({ error: error.response.data });
    }
    
    res.status(500).json({ error: error.message || 'Failed to calculate route' });
  }
});

module.exports = router;
