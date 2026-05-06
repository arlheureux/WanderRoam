const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '1h';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const authMiddleware = (req, res, next) => {
  console.log('Auth middleware - path:', req.path, 'method:', req.method);
  
  // Try cookie first, then header (backward compatible)
  const token = req.cookies?.token || (req.headers.authorization && req.headers.authorization.replace('Bearer ', ''));
  
  if (!token) {
    console.log('Auth middleware - No token');
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Auth middleware - Token valid, user:', decoded.username);
    req.user = decoded;
    next();
  } catch (error) {
    console.log('Auth middleware - Invalid token:', error.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const adminMiddleware = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, username: user.username, isAdmin: user.isAdmin },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
};

module.exports = {
  authMiddleware,
  adminMiddleware,
  generateToken
};
