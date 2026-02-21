const express = require('express');
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { generateToken, authMiddleware } = require('../middleware/auth');
const { Op } = require('sequelize');

const router = express.Router();

const ENABLE_REGISTRATION = process.env.ENABLE_REGISTRATION !== 'false';

router.post('/register', async (req, res) => {
  if (!ENABLE_REGISTRATION) {
    return res.status(403).json({ error: 'Registration is disabled' });
  }

  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    const existingUser = await User.findOne({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const existingUsername = await User.findOne({
      where: { username }
    });

    if (existingUsername) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const userCount = await User.count();
    const isFirstUser = userCount === 0;

    const user = await User.create({
      username,
      email,
      password_hash: hashedPassword,
      isAdmin: isFirstUser
    });

    const token = generateToken(user);

    res.status(201).json({
      token,
      user: { id: user.id, username: user.username, email: user.email, isAdmin: user.isAdmin }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Failed to register' });
  }
});

router.get('/config', (req, res) => {
  res.json({ registrationEnabled: ENABLE_REGISTRATION });
});

router.post('/login', async (req, res) => {
  try {
    const { email, username, password } = req.body;

    const loginField = email || username;
    if (!loginField || !password) {
      return res.status(400).json({ error: 'Username/email and password are required' });
    }

    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: loginField.toLowerCase() },
          { username: loginField.toLowerCase() }
        ]
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
        immich_url: user.immich_url,
        immich_api_key: user.immich_api_key ? '***' : null
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'username', 'email', 'isAdmin', 'createdAt']
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

router.put('/settings', authMiddleware, async (req, res) => {
  try {
    const { immich_url, immich_api_key } = req.body;

    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (immich_url !== undefined) user.immich_url = immich_url;
    if (immich_api_key !== undefined) user.immich_api_key = immich_api_key;

    await user.save();

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
        immich_url: user.immich_url,
        immich_api_key: user.immich_api_key ? '***' : null
      }
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
