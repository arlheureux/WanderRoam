const express = require('express');
const bcrypt = require('bcryptjs');
const { body, param, query } = require('express-validator');
const { User, Adventure, GpxTrack, Picture, AdventureShare, AuditLog } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { handleError, logError } = require('../middleware/errorHandler');

const router = express.Router();

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

module.exports = router;
