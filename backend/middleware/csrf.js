const sentinelHeader = 'x-requested-with';
const sentinelValue = 'XMLHttpRequest';

// CSRF protection: require a custom sentinel header on all state-changing requests.
// Browsers cannot set custom headers on cross-site requests without a preflight,
// and the express CORS allowlist blocks that preflight for cross-origin callers.
// Simple cross-site form posts (multipart/urlencoded) also cannot send this header,
// so cookie-authenticated CSRF attacks are rendered ineffective.
const csrfProtection = (req, res, next) => {
  const method = req.method.toLowerCase();
  if (method === 'get' || method === 'head' || method === 'options') {
    return next();
  }

  if (req.get(sentinelHeader) === sentinelValue) {
    return next();
  }

  return res.status(403).json({ error: 'Missing CSRF protection header' });
};

module.exports = { csrfProtection, sentinelHeader, sentinelValue };