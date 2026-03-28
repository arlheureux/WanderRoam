const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { GpxTrack } = require('../models');
const { authMiddleware } = require('../middleware/auth');

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
    if (file.originalname.endsWith('.fit')) {
      cb(null, true);
    } else {
      cb(new Error('Only FIT files are allowed'));
    }
  }
});

const parseFit = async (filePath) => {
  const { Decoder, Stream } = await import('@garmin/fitsdk');
  
  const buffer = fs.readFileSync(filePath);
  const stream = Stream.fromBuffer(buffer);
  const decoder = new Decoder(stream);
  const { messages, errors } = decoder.read();
  
  if (errors && errors.length > 0) {
    console.log('FIT decode warnings:', errors);
  }
  
  const records = [];
  
  for (const [mesgNum, msg] of Object.entries(messages)) {
    if (msg && msg.mesgType === 'record') {
      const record = {};
      for (const [key, value] of Object.entries(msg)) {
        if (key !== 'mesgType') {
          record[key] = value;
        }
      }
      records.push(record);
    }
  }
  
  return { records };
};

const convertFitToPoints = (fitData) => {
  const points = [];
  
  const records = fitData.records || [];
  
  for (const record of records) {
    if (record.position_lat !== undefined && record.position_long !== undefined) {
      let lat = record.position_lat;
      let lng = record.position_long;
      
      if (typeof lat === 'number' && typeof lng === 'number') {
        lat = lat * (180 / Math.pow(2, 31));
        lng = lng * (180 / Math.pow(2, 31));
        
        const ele = record.altitude || null;
        const time = record.timestamp || null;
        
        points.push({ lat, lng, ele, time });
      }
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

router.post('/upload', authMiddleware, upload.single('fit'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'FIT file is required' });
    }

    const { name, type, adventure_id } = req.body;

    const TYPE_COLORS = {
      walking: '#FF6B6B',
      hiking: '#FF9F43',
      cycling: '#4ECDC4',
      bus: '#A55EEA',
      metro: '#26DE81',
      train: '#45B7D1',
      boat: '#2D98DA',
      car: '#FC5C65',
      other: '#9B59B6'
    };

    const fitType = type || 'cycling';
    const color = TYPE_COLORS[fitType] || TYPE_COLORS.other;

    const fitData = await parseFit(req.file.path);
    const points = convertFitToPoints(fitData);
    
    if (points.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'No valid GPS data found in FIT file' });
    }
    
    const metadata = calculateGpxMetadata(points);

    const gpxTrack = await GpxTrack.create({
      name: name || req.file.originalname.replace('.fit', ''),
      type: fitType,
      color,
      file_path: req.file.path,
      data: points,
      adventure_id,
      distance: metadata.distance
    });

    res.status(201).json({ gpxTrack });
  } catch (error) {
    console.error('Upload FIT error:', error.message);
    res.status(500).json({ error: 'Failed to upload FIT file' });
  }
});

module.exports = router;
