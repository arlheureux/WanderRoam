const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const bcrypt = require('bcryptjs');
const { User, Adventure, GpxTrack, Picture, AdventureShare, AuditLog } = require('../models');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { handleError } = require('../middleware/errorHandler');
const { query, body, param, validationResult } = require('express-validator');

// Escape shell arguments to prevent command injection
function escapeShellArg(arg) {
  if (typeof arg !== 'string') arg = String(arg);
  // Remove or escape shell metacharacters (control chars stripped intentionally)
  // eslint-disable-next-line no-control-regex
  return arg.replace(/["'\\`$(){}[\]*?~<>|&;!#\n\r\x0B\x1B]/g, '');
}
const os = require('os');
const multer = require('multer');

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
    console.error('[AuditLog]', err);
  }
};

const RESTORE_WARNING = 'The .env file inside the backup was extracted to /app/.env but does not override variables provided by docker-compose env_file - review your host .env manually.';

const runCommand = (cmd, options = {}) => new Promise((resolve, reject) => {
  exec(cmd, options, (error, stdout, stderr) => {
    if (error) return reject(new Error(`${stderr || stdout || error.message}`.trim()));
    resolve({ stdout, stderr });
  });
});

const performRestore = async (backupFilePath) => {
  const tempDir = path.join(os.tmpdir(), `restore-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  try {
    await runCommand(`tar -xzf "${backupFilePath}" -C "${tempDir}"`);

    const dbDumpPath = path.join(tempDir, 'database.dump');
    const databaseRestored = fs.existsSync(dbDumpPath);
    if (databaseRestored) {
      const dbHost = process.env.DB_HOST || 'postgres';
      const dbPort = process.env.DB_PORT || '5432';
      const dbUser = process.env.DB_USER;
      const dbName = process.env.DB_NAME;
      const cmd = `/usr/bin/pg_restore -h ${escapeShellArg(dbHost)} -p ${escapeShellArg(dbPort)} -U ${escapeShellArg(dbUser)} -d ${escapeShellArg(dbName)} -c --if-exists ${escapeShellArg(dbDumpPath)}`;
      await runCommand(cmd, { env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD } });
    }

    const uploadsSrc = path.join(tempDir, 'uploads');
    const uploadsDest = path.join(__dirname, '..', 'uploads');
    let uploadsRestored = false;
    if (fs.existsSync(uploadsSrc)) {
      fs.rmSync(uploadsDest, { recursive: true, force: true });
      fs.mkdirSync(uploadsDest, { recursive: true });
      fs.cpSync(uploadsSrc, uploadsDest, { recursive: true });
      uploadsRestored = true;
    }

    const envSrc = path.join(tempDir, '.env');
    if (fs.existsSync(envSrc)) {
      fs.copyFileSync(envSrc, path.join(__dirname, '..', '.env'));
    }

    return { databaseRestored, uploadsRestored };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

router.get('/users', authMiddleware, adminMiddleware, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
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
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
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
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
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
  body('newPassword').notEmpty().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
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
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
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

    const dbHost = process.env.DB_HOST || 'postgres';
    const dbPort = process.env.DB_PORT || '5432';
    const dbUser = process.env.DB_USER;
    const dbName = process.env.DB_NAME;
    const dbDumpPath = path.join(tempDir, 'database.dump');
    await new Promise((resolve, reject) => {
      const cmd = `PGPASSWORD=${escapeShellArg(process.env.DB_PASSWORD)} /usr/bin/pg_dump -h ${escapeShellArg(dbHost)} -p ${escapeShellArg(dbPort)} -U ${escapeShellArg(dbUser)} -d ${escapeShellArg(dbName)} -F c -f ${escapeShellArg(dbDumpPath)}`;
      exec(cmd, (error, stdout, stderr) => {
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

    await logAudit(req.user.id, 'CREATE_BACKUP', null, { filename: backupFilename }, req);

    res.json({ message: 'Backup created successfully', filename: backupFilename });
  } catch (error) {
    return handleError(error, res, { operation: 'createBackup' });
  }
});

router.get('/backups', authMiddleware, adminMiddleware, async (req, res) => {
  try {
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

router.get('/backups/:filename', authMiddleware, adminMiddleware, [
  param('filename').matches(/^[\w.-]+$/).withMessage('Invalid filename'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
], async (req, res) => {
  try {
    const filePath = path.join(BACKUP_DIR, req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Backup not found' });
    res.download(filePath, req.params.filename);
  } catch (error) {
    return handleError(error, res, { operation: 'downloadBackup' });
  }
});

router.delete('/backups/:filename', authMiddleware, adminMiddleware, [
  param('filename').matches(/^[\w.-]+$/).withMessage('Invalid filename'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
], async (req, res) => {
  try {
    const filePath = path.join(BACKUP_DIR, req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Backup not found' });
    fs.unlinkSync(filePath);
    await logAudit(req.user.id, 'DELETE_BACKUP', null, { filename: req.params.filename }, req);
    res.json({ message: 'Backup deleted successfully' });
  } catch (error) {
    return handleError(error, res, { operation: 'deleteBackup' });
  }
});

router.post('/restore/existing', authMiddleware, adminMiddleware, [
  body('filename').matches(/^[\w.-]+$/).withMessage('Invalid filename'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
], async (req, res) => {
  try {
    const backupDirResolved = path.resolve(BACKUP_DIR);
    const backupFilePath = path.resolve(BACKUP_DIR, req.body.filename);
    if (!backupFilePath.startsWith(backupDirResolved + path.sep)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    if (!fs.existsSync(backupFilePath)) return res.status(404).json({ error: 'Backup not found' });

    const restored = await performRestore(backupFilePath);

    await logAudit(req.user.id, 'RESTORE_BACKUP', null, { filename: req.body.filename, source: 'existing', ...restored }, req);

    res.json({
      message: 'Restore completed. Please restart the stack to apply new configuration.',
      warning: RESTORE_WARNING,
      restored
    });
  } catch (error) {
    return handleError(error, res, { operation: 'restoreBackup' });
  }
});

router.post('/restore/upload', authMiddleware, adminMiddleware, upload.single('backup'), async (req, res) => {
  let uploadCleaned = false;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No backup file uploaded' });
    }

    const restored = await performRestore(req.file.path);
    fs.unlinkSync(req.file.path);
    uploadCleaned = true;

    await logAudit(req.user.id, 'RESTORE_BACKUP', null, { filename: req.file.originalname, source: 'upload', ...restored }, req);

    res.json({
      message: 'Restore completed. Please restart the stack to apply new configuration.',
      warning: RESTORE_WARNING,
      restored
    });
  } catch (error) {
    return handleError(error, res, { operation: 'restoreBackup' });
  } finally {
    if (!uploadCleaned && req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

module.exports = router;
