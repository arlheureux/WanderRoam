const express = require('express');
const bcrypt = require('bcryptjs');
const { body, param, query } = require('express-validator');
const { User, Adventure, GpxTrack, Picture, AdventureShare, AuditLog } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { handleError, logError } = require('../middleware/errorHandler');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');
const multer = require('multer');

const router = express.Router();

const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const UPLOAD_DIR = path.join(os.tmpdir(), 'wanderroam-restore');

const upload = multer({ dest: UPLOAD_DIR, limits: { fileSize: 500 * 1024 * 1024 } }); // 500MB limit

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const logAudit = async (adminUserId, action, targetUserId, details, req) => {
  try {
    await AuditLog.create({
      action,
      targetUserId,
      details,
      ipAddress: req.ip || req.connection.remoteAddress,
      adminUserId
    });
  } catch (err) {
    logError(err, '[AuditLog]');
  }
};

const adminMiddleware = async (req, res, next) => {
  const user = await User.findByPk(req.user.id);
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

router.get('/users', authMiddleware, adminMiddleware, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  validate
], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    const { count, rows } = await User.findAndCountAll({
      attributes: ['id', 'username', 'isAdmin', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    const usersWithStats = await Promise.all(rows.map(async (user) => {
      const adventureCount = await Adventure.count({ where: { user_id: user.id } });
      return {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt,
        adventureCount
      };
    }));

    res.json({ 
      users: usersWithStats,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    return handleError(error, res, { operation: 'getUsers' });
  }
});

router.post('/users', authMiddleware, adminMiddleware, [
  body('username').trim().notEmpty().withMessage('Username is required').isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters'),
  body('password').notEmpty().withMessage('Password is required').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  validate
], async (req, res) => {
  try {
    const { username, password } = req.body;

    const existingUsername = await User.findOne({ where: { username } });
    if (existingUsername) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      password_hash: hashedPassword,
      isAdmin: false
    });

    await logAudit(req.user.id, 'CREATE_USER', user.id, { username: user.username }, req);

    res.status(201).json({ 
      user: {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt,
        adventureCount: 0
      }
    });
  } catch (error) {
    return handleError(error, res, { operation: 'createUser' });
  }
});

router.delete('/users/:id', authMiddleware, adminMiddleware, [
  param('id').isUUID().withMessage('Invalid user ID'),
  validate
], async (req, res) => {
  try {
    const userId = req.params.id;
    
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.isAdmin) {
      return res.status(400).json({ error: 'Cannot delete admin user' });
    }

    const adventures = await Adventure.findAll({ where: { user_id: userId } });
    for (const adventure of adventures) {
      await GpxTrack.destroy({ where: { adventure_id: adventure.id } });
      await Picture.destroy({ where: { adventure_id: adventure.id } });
      await AdventureShare.destroy({ where: { AdventureId: adventure.id } });
      await adventure.destroy();
    }

    await AdventureShare.destroy({ where: { UserId: userId } });
    await user.destroy();

    await logAudit(req.user.id, 'DELETE_USER', userId, { username: user.username, adventureCount: adventures.length }, req);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    return handleError(error, res, { operation: 'deleteUser' });
  }
});

router.put('/users/:id/reset-password', authMiddleware, adminMiddleware, [
  param('id').isUUID().withMessage('Invalid user ID'),
  body('password').notEmpty().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  validate
], async (req, res) => {
  try {
    const userId = req.params.id;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password_hash = hashedPassword;
    await user.save();

    await logAudit(req.user.id, 'RESET_PASSWORD', userId, { username: user.username }, req);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    return handleError(error, res, { operation: 'resetPassword' });
  }
});

router.put('/users/:id/toggle-admin', authMiddleware, adminMiddleware, [
  param('id').isUUID().withMessage('Invalid user ID'),
  validate
], async (req, res) => {
  try {
    const userId = req.params.id;

    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot modify your own admin status' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.isAdmin = !user.isAdmin;
    await user.save();

    await logAudit(req.user.id, 'TOGGLE_ADMIN', userId, { username: user.username, isAdmin: user.isAdmin }, req);

    res.json({ 
      message: `User is now ${user.isAdmin ? 'admin' : 'regular user'}`,
      user: {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    return handleError(error, res, { operation: 'toggleAdmin' });
  }
});

router.post('/backup', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `wanderroam_backup_${timestamp}.tar.gz`;
    const backupPath = path.join(BACKUP_DIR, backupFilename);
    const tempDir = path.join(os.tmpdir(), `backup-${timestamp}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const dbConnectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST || 'postgres'}:5432/${process.env.DB_NAME}`;
    const dbDumpPath = path.join(tempDir, 'database.dump');
    await new Promise((resolve, reject) => {
      exec(`/usr/bin/pg_dump "${dbConnectionString}" -F c -f "${dbDumpPath}"`, (error, stdout, stderr) => {
        if (error) return reject(new Error(`Database backup failed: ${stderr}`));
        resolve();
      });
    });

    const uploadsSrc = path.join(__dirname, '..', 'uploads');
    const uploadsBackupPath = path.join(tempDir, 'uploads');
    if (fs.existsSync(uploadsSrc)) {
      fs.cpSync(uploadsSrc, uploadsBackupPath, { recursive: true });
    }

    const envSrc = path.join(__dirname, '..', '.env');
    const envBackupPath = path.join(tempDir, '.env');
    if (fs.existsSync(envSrc)) {
      fs.copyFileSync(envSrc, envBackupPath);
    }

    await new Promise((resolve, reject) => {
      exec(`tar -czf "${backupPath}" -C "${tempDir}" .`, (error, stdout, stderr) => {
        if (error) return reject(new Error(`Archive creation failed: ${stderr}`));
        resolve();
      });
    });

    fs.rmSync(tempDir, { recursive: true, force: true });

    res.json({ message: 'Backup created successfully', filename: backupFilename });
  } catch (error) {
    return handleError(error, res, { operation: 'createBackup' });
  }
});

router.get('/backups', [
  query('token').optional()
], async (req, res) => {
  try {
    const token = req.query.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
    if (!token) return res.status(401).json({ error: 'No token provided' });
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.id);
      if (!user || !user.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.tar.gz'));
    const backups = files.map(f => {
      const filePath = path.join(BACKUP_DIR, f);
      const stats = fs.statSync(filePath);
      return { filename: f, size: stats.size, createdAt: stats.birthtime };
    }).sort((a, b) => b.createdAt - a.createdAt);
    res.json({ backups });
  } catch (error) {
    return handleError(error, res, { operation: 'listBackups' });
  }
});

router.get('/backups/:filename', [
  param('filename').matches(/^[\w\-\.]+$/).withMessage('Invalid filename'),
  validate
], async (req, res) => {
  try {
    const token = req.query.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.id);
      if (!user || !user.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const filePath = path.join(BACKUP_DIR, req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Backup not found' });
    res.download(filePath, req.params.filename);
  } catch (error) {
    return handleError(error, res, { operation: 'downloadBackup' });
  }
});

router.post('/restore/existing', [
  query('token').optional()
], async (req, res) => {
  try {
    const token = req.query.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
    if (!token) return res.status(401).json({ error: 'No token provided' });
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.id);
      if (!user || !user.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (!req.body.filename) {
      return res.status(400).json({ error: 'No backup filename provided' });
    }

    const backupFilePath = path.join(BACKUP_DIR, req.body.filename);
    if (!fs.existsSync(backupFilePath)) return res.status(404).json({ error: 'Backup not found' });

    const tempDir = path.join(os.tmpdir(), `restore-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    await new Promise((resolve, reject) => {
      exec(`tar -xzf "${backupFilePath}" -C "${tempDir}"`, (error, stdout, stderr) => {
        if (error) return reject(new Error(`Extract failed: ${stderr}`));
        resolve();
      });
    });

    const dbDumpPath = path.join(tempDir, 'database.dump');
    if (fs.existsSync(dbDumpPath)) {
      const dbConnectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST || 'postgres'}:5432/${process.env.DB_NAME}`;
      await new Promise((resolve, reject) => {
        exec(`/usr/bin/pg_restore -d "${dbConnectionString}" -c --no-comments "${dbDumpPath}" 2>&1 | grep -v "transaction_timeout" | grep -v "ignored on restore"`, (error, stdout, stderr) => {
          if (error && stderr && !stderr.includes('ignored on restore')) return reject(new Error(`Database restore failed: ${stderr}`));
          resolve();
        });
      });
    }

    const uploadsSrc = path.join(tempDir, 'uploads');
    const uploadsDest = path.join(__dirname, '..', 'uploads');
    if (fs.existsSync(uploadsSrc)) {
      fs.readdirSync(uploadsSrc).forEach(file => {
        fs.cpSync(path.join(uploadsSrc, file), path.join(uploadsDest, file), { recursive: true, force: true });
      });
    }

    const envSrc = path.join(tempDir, '.env');
    const envDest = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envSrc)) fs.copyFileSync(envSrc, envDest);

    fs.rmSync(tempDir, { recursive: true, force: true });

    res.json({
      message: 'Restore completed. Please restart the stack to apply new configuration.',
      warning: 'Database credentials from backup have been applied. This is intended for new/empty instances.'
    });
  } catch (error) {
    return handleError(error, res, { operation: 'restoreBackup' });
  }
});

router.post('/restore/upload', upload.single('backup'), [
  query('token').optional()
], async (req, res) => {
  try {
    const token = req.query.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
    if (!token) return res.status(401).json({ error: 'No token provided' });
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.id);
      if (!user || !user.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No backup file uploaded' });
    }

    const backupFilePath = req.file.path;
    const tempDir = path.join(os.tmpdir(), `restore-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    await new Promise((resolve, reject) => {
      exec(`tar -xzf "${backupFilePath}" -C "${tempDir}"`, (error, stdout, stderr) => {
        if (error) return reject(new Error(`Extract failed: ${stderr}`));
        resolve();
      });
    });

    const dbDumpPath = path.join(tempDir, 'database.dump');
    if (fs.existsSync(dbDumpPath)) {
      const dbConnectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST || 'postgres'}:5432/${process.env.DB_NAME}`;
      await new Promise((resolve, reject) => {
        exec(`/usr/bin/pg_restore -d "${dbConnectionString}" -c --no-comments "${dbDumpPath}" 2>&1 | grep -v "transaction_timeout" | grep -v "ignored on restore"`, (error, stdout, stderr) => {
          if (error && stderr && !stderr.includes('ignored on restore')) return reject(new Error(`Database restore failed: ${stderr}`));
          resolve();
        });
      });
    }

    const uploadsSrc = path.join(tempDir, 'uploads');
    const uploadsDest = path.join(__dirname, '..', 'uploads');
    if (fs.existsSync(uploadsSrc)) {
      fs.readdirSync(uploadsSrc).forEach(file => {
        fs.cpSync(path.join(uploadsSrc, file), path.join(uploadsDest, file), { recursive: true, force: true });
      });
    }

    const envSrc = path.join(tempDir, '.env');
    const envDest = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envSrc)) fs.copyFileSync(envSrc, envDest);

    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.unlinkSync(req.file.path);

    res.json({
      message: 'Restore completed. Please restart the stack to apply new configuration.',
      warning: 'Database credentials from backup have been applied. This is intended for new/empty instances.'
    });
  } catch (error) {
    return handleError(error, res, { operation: 'restoreBackup' });
  }
});

module.exports = router;
