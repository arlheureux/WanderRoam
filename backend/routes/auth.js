const express = require('express');
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { generateToken, authMiddleware } = require('../middleware/auth');

const router = express.Router();

const ENABLE_REGISTRATION = process.env.ENABLE_REGISTRATION !== 'false';

const failedAttempts = new Map();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function getClientIp(req) {
  return req.ip || req.connection.remoteAddress || 'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const record = failedAttempts.get(ip);
  
  if (!record) {
    return true;
  }
  
  if (now - record.resetTime > RATE_LIMIT_WINDOW) {
    failedAttempts.delete(ip);
    return true;
  }
  
  return record.count < MAX_ATTEMPTS;
}

function recordFailedAttempt(ip) {
  const now = Date.now();
  const record = failedAttempts.get(ip);
  
  if (!record || now - record.resetTime > RATE_LIMIT_WINDOW) {
    failedAttempts.set(ip, { count: 1, resetTime: now });
  } else {
    record.count += 1;
    record.resetTime = now;
  }
}

function resetFailedAttempts(ip) {
  failedAttempts.delete(ip);
}

router.post('/register', async (req, res) => {
  if (!ENABLE_REGISTRATION) {
    return res.status(403).json({ error: 'Registration is disabled' });
  }

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const existingUsername = await User.findOne({
      where: { username: username.toLowerCase() }
    });

    if (existingUsername) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const userCount = await User.count();
    const isFirstUser = userCount === 0;

    const user = await User.create({
      username: username.toLowerCase(),
      password_hash: hashedPassword,
      isAdmin: isFirstUser
    });

    const token = generateToken(user);

    res.status(201).json({
      token,
      user: { id: user.id, username: user.username, isAdmin: user.isAdmin }
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
  const clientIp = getClientIp(req);
  
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Too many attempts, please try again later' });
  }

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await User.findOne({
      where: { username: username.toLowerCase() }
    });

    if (!user) {
      recordFailedAttempt(clientIp);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      recordFailedAttempt(clientIp);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    resetFailedAttempts(clientIp);

    const token = generateToken(user);

    res.json({
      user: {
        id: user.id,
        username: user.username,
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
      attributes: ['id', 'username', 'isAdmin', 'createdAt']
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
