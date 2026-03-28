const DOMPurify = require('isomorphic-dompurify');

const sanitizeInput = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = DOMPurify.sanitize(req.body[key], { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
      }
    }
  }
  next();
};

module.exports = { sanitizeInput };
