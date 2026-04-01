const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
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

const handleError = (error, res, context = {}) => {
  const { operation, details, ...extra } = context;
  
  logger.error(`[${operation}] ${error.message}`, {
    operation,
    error: error.message,
    stack: error.stack,
    ...extra,
    ...details
  });

  const isProduction = process.env.NODE_ENV === 'production';
  const message = isProduction ? 'An unexpected error occurred' : error.message;

  res.status(500).json({ 
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { details: error.message })
  });
};

const handleValidationError = (error, res) => {
  logger.warn(`Validation error: ${error.message}`);
  res.status(400).json({ 
    error: 'Invalid request',
    details: error.message 
  });
};

const handleNotFound = (res, resource = 'Resource') => {
  res.status(404).json({ 
    error: `${resource} not found` 
  });
};

const handleUnauthorized = (res, message = 'Unauthorized') => {
  res.status(401).json({ 
    error: message 
  });
};

const handleForbidden = (res, message = 'Forbidden') => {
  res.status(403).json({ 
    error: message 
  });
};

const handleConflict = (res, message = 'Conflict') => {
  res.status(409).json({ 
    error: message 
  });
};

const logError = (error, context = '') => {
  logger.error(`${context} ${error.message}`, {
    error: error.message,
    stack: error.stack
  });
};

module.exports = {
  logger,
  handleError,
  handleValidationError,
  handleNotFound,
  handleUnauthorized,
  handleForbidden,
  handleConflict,
  logError
};