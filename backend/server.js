require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { sequelize, Tag } = require('./models');

const authRoutes = require('./routes/auth');
const adventuresRoutes = require('./routes/adventures');
const gpxRoutes = require('./routes/gpx');
const immichRoutes = require('./routes/immich');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5000;
const VERSION = 'v0.3';
const TAG = process.env.TAG || 'stable';

app.get('/api/version', (req, res) => {
  res.json({ version: VERSION, tag: TAG });
});

const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://frontend:3000'
};

app.use(cors(corsOptions));

app.use((req, res, next) => {
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    next();
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});

app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const uploadDir = process.env.UPLOAD_DIR || '/app/uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/gpx+xml' || 
        file.originalname.endsWith('.gpx')) {
      cb(null, true);
    } else {
      cb(new Error('Only GPX files are allowed'));
    }
  }
});

app.use('/uploads', express.static(uploadDir));

app.use('/api/auth', authRoutes);
app.use('/api/adventures', adventuresRoutes);
app.use('/api/gpx', gpxRoutes);
app.use('/api/immich', immichRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    
    await sequelize.sync({ alter: true });
    console.log('Database synchronized.');
    
    const PREDEFINED_TAGS = [
      { name: 'Hiking', color: '#FF9F43', type: 'activity' },
      { name: 'Cycling', color: '#4ECDC4', type: 'activity' },
      { name: 'Walking', color: '#FF6B6B', type: 'activity' },
      { name: 'Running', color: '#26DE81', type: 'activity' },
      { name: 'Swimming', color: '#45B7D1', type: 'activity' },
      { name: 'Skiing', color: '#A55EEA', type: 'activity' },
      { name: 'Kayaking', color: '#2D98DA', type: 'activity' },
      { name: 'Mountain', color: '#9B59B6', type: 'location' },
      { name: 'Sea', color: '#45B7D1', type: 'location' },
      { name: 'Forest', color: '#26DE81', type: 'location' },
      { name: 'City', color: '#FC5C65', type: 'location' }
    ];

    for (const tag of PREDEFINED_TAGS) {
      await Tag.findOrCreate({
        where: { name: tag.name },
        defaults: tag
      });
    }
    console.log('Tags seeded.');
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
};

startServer();
