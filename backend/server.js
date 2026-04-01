require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const { sequelize, Tag } = require('./models');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

const authRoutes = require('./routes/auth');
const adventuresRoutes = require('./routes/adventures');
const gpxRoutes = require('./routes/gpx');
const immichRoutes = require('./routes/immich');
const adminRoutes = require('./routes/admin');
const routingRoutes = require('./routes/routing');
const { sanitizeInput } = require('./middleware/sanitize');

const app = express();
app.set('trust proxy', 1);

const PORT = process.env.PORT || 5000;
const VERSION = 'v0.5.1';
const TAG = process.env.TAG || 'stable';

app.get('/api/version', (req, res) => {
  res.json({ version: VERSION, tag: TAG });
});

const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://frontend:3000'
};

app.use(cors(corsOptions));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', globalLimiter);

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many uploads, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const adventureLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many adventure requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

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

app.use('/api/auth', sanitizeInput, authRoutes);
app.use('/api/adventures', sanitizeInput, adventureLimiter, adventuresRoutes);
app.use('/api/gpx', sanitizeInput, uploadLimiter, gpxRoutes);
app.use('/api/routing', sanitizeInput, routingRoutes);
app.use('/api/immich', sanitizeInput, immichRoutes);
app.use('/api/admin', sanitizeInput, adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error', { 
    error: err.message, 
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  res.status(500).json({ error: 'Something went wrong!' });
});

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    
    await sequelize.sync({ alter: true });
    console.log('Database synchronized.');
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
