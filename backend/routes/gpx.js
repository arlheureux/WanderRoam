const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { body, param } = require('express-validator');
const { GpxTrack } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const { handleError } = require('../middleware/errorHandler');
const { validate } = require('../middleware/validation');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || '/app/uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/gpx+xml' || 
        file.originalname.endsWith('.gpx')) {
      cb(null, true);
    } else {
      cb(new Error('Only GPX files are allowed'));
    }
  }
});

const parseGpx = async (filePath) => {
  const xml = fs.readFileSync(filePath, 'utf-8');
  const points = [];
  
  const trkptRegex = /<trkpt[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"[^>]*>/g;
  let match;
  
  while ((match = trkptRegex.exec(xml)) !== null) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    
    let ele = null;
    let time = null;
    
    const eleMatch = xml.substring(match.index, match.index + 500).match(/<ele>([^<]+)<\/ele>/);
    if (eleMatch) ele = parseFloat(eleMatch[1]);
    
    const timeMatch = xml.substring(match.index, match.index + 500).match(/<time>([^<]+)<\/time>/);
    if (timeMatch) time = timeMatch[1];
    
    if (!isNaN(lat) && !isNaN(lng)) {
      points.push({ lat, lng, ele, time });
    }
  }
  
  const rteptRegex = /<rtept[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"[^>]*>/g;
  while ((match = rteptRegex.exec(xml)) !== null) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    
    let ele = null;
    let time = null;
    
    const eleMatch = xml.substring(match.index, match.index + 500).match(/<ele>([^<]+)<\/ele>/);
    if (eleMatch) ele = parseFloat(eleMatch[1]);
    
    const timeMatch = xml.substring(match.index, match.index + 500).match(/<time>([^<]+)<\/time>/);
    if (timeMatch) time = timeMatch[1];
    
    if (!isNaN(lat) && !isNaN(lng)) {
      points.push({ lat, lng, ele, time });
    }
  }
  
  const wptRegex = /<wpt[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"[^>]*>/g;
  while ((match = wptRegex.exec(xml)) !== null) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    
    let ele = null;
    let time = null;
    
    const eleMatch = xml.substring(match.index, match.index + 500).match(/<ele>([^<]+)<\/ele>/);
    if (eleMatch) ele = parseFloat(eleMatch[1]);
    
    const timeMatch = xml.substring(match.index, match.index + 500).match(/<time>([^<]+)<\/time>/);
    if (timeMatch) time = timeMatch[1];
    
    if (!isNaN(lat) && !isNaN(lng)) {
      points.push({ lat, lng, ele, time });
    }
  }

  return points;
};

const calculateGpxMetadata = (points) => {
  if (!points || points.length < 2) {
    return { distance: 0 };
  }

  let totalDistance = 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const dist = haversine(prev.lat, prev.lng, curr.lat, curr.lng);
    totalDistance += dist;
  }

  return {
    distance: Math.round(totalDistance / 10) / 100
  };
};

const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

router.post('/upload', authMiddleware, [
  body('name').optional().trim().isLength({ max: 100 }).withMessage('Name must be 100 characters or less'),
  body('type').optional().isIn(['walking', 'hiking', 'cycling', 'bus', 'metro', 'train', 'boat', 'car', 'other']).withMessage('Invalid track type'),
  body('adventure_id').optional().isUUID().withMessage('Invalid adventure ID'),
  validate
], upload.single('gpx'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'GPX file is required' });
    }

    const { name, type, adventure_id } = req.body;

    const TYPE_COLORS = {
      walking: '#DC2626',
      hiking: '#EA580C',
      cycling: '#65A30D',
      bus: '#2563EB',
      metro: '#DB2777',
      train: '#0891B2',
      boat: '#4F46E5',
      car: '#52525B',
      other: '#0D9488'
    };

    const gpxType = type || 'walking';
    const color = TYPE_COLORS[gpxType] || TYPE_COLORS.other;

    const points = await parseGpx(req.file.path);
    const metadata = calculateGpxMetadata(points);

    const gpxTrack = await GpxTrack.create({
      name: name || req.file.originalname.replace('.gpx', ''),
      type: gpxType,
      color,
      file_path: req.file.path,
      data: points,
      adventure_id,
      distance: metadata.distance
    });

    res.status(201).json({ gpxTrack });
  } catch (error) {
    return handleError(error, res, { operation: 'uploadGpx' });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const gpxTrack = await GpxTrack.findByPk(req.params.id);

    if (!gpxTrack) {
      return res.status(404).json({ error: 'GPX track not found' });
    }

    res.json({ gpxTrack });
  } catch (error) {
    return handleError(error, res, { operation: 'getGpx' });
  }
});

router.put('/:id', authMiddleware, [
  param('id').isUUID().withMessage('Invalid GPX track ID'),
  body('name').optional().trim().isLength({ max: 100 }).withMessage('Name must be 100 characters or less'),
  body('type').optional().isIn(['walking', 'hiking', 'cycling', 'bus', 'metro', 'train', 'boat', 'car', 'other']).withMessage('Invalid track type'),
  body('color').optional().isHexColor().withMessage('Invalid color'),
  validate
], async (req, res) => {
  try {
    const gpxTrack = await GpxTrack.findByPk(req.params.id);

    if (!gpxTrack) {
      return res.status(404).json({ error: 'GPX track not found' });
    }

    const { name, type, color, data } = req.body;

    if (name) gpxTrack.name = name;
    if (type) gpxTrack.type = type;
    if (color) gpxTrack.color = color;
    if (data) {
      gpxTrack.data = data;
      if (data.length >= 2) {
        let totalDistance = 0;
        for (let i = 1; i < data.length; i++) {
          const prev = data[i - 1];
          const curr = data[i];
          if (prev.lat && prev.lng && curr.lat && curr.lng) {
            const dist = haversine(prev.lat, prev.lng, curr.lat, curr.lng);
            totalDistance += dist;
          }
        }
        gpxTrack.distance = Math.round(totalDistance / 10) / 100;
      }
    }

    await gpxTrack.save();

    res.json({ gpxTrack });
  } catch (error) {
    return handleError(error, res, { operation: 'updateGpx' });
  }
});

router.delete('/:id', authMiddleware, [
  param('id').isUUID().withMessage('Invalid GPX track ID'),
  validate
], async (req, res) => {
  try {
    const gpxTrack = await GpxTrack.findByPk(req.params.id);

    if (!gpxTrack) {
      return res.status(404).json({ error: 'GPX track not found' });
    }

    if (gpxTrack.file_path && fs.existsSync(gpxTrack.file_path)) {
      fs.unlinkSync(gpxTrack.file_path);
    }

    await gpxTrack.destroy();

    res.json({ message: 'GPX track deleted' });
  } catch (error) {
    return handleError(error, res, { operation: 'deleteGpx' });
  }
});

router.get('/:id/data', authMiddleware, async (req, res) => {
  try {
    const gpxTrack = await GpxTrack.findByPk(req.params.id);

    if (!gpxTrack) {
      return res.status(404).json({ error: 'GPX track not found' });
    }

    res.json({
      id: gpxTrack.id,
      name: gpxTrack.name,
      type: gpxTrack.type,
      color: gpxTrack.color,
      data: gpxTrack.data
    });
  } catch (error) {
    return handleError(error, res, { operation: 'getGpxData' });
  }
});

module.exports = router;
