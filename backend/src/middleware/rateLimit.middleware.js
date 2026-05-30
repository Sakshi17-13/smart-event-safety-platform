const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

const isProduction = process.env.NODE_ENV === 'production';

const createRateLimiter = (windowMs = 15 * 60 * 1000, max = 100, message = 'Too many requests', options = {}) => {
  return rateLimit({
    windowMs,
    max,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    message: {
      success: false,
      message,
      data: null,
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        url: req.url,
        method: req.method,
        userId: req.user?.id,
      });
      res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later.',
        data: null,
      });
    },
    skip: (req) => {
      if (req.user && req.user.role === 'SUPER_ADMIN') {
        return true;
      }
      return false;
    },
  });
};

const authRateLimiter = createRateLimiter(
  isProduction ? 15 * 60 * 1000 : 60 * 1000,
  isProduction ? 5 : 300,
  'Too many authentication attempts',
  {
    skipSuccessfulRequests: !isProduction,
  }
);

const apiRateLimiter = createRateLimiter(
  15 * 60 * 1000,
  isProduction ? 100 : 1000,
  'Too many API requests'
);

const strictRateLimiter = createRateLimiter(
  60 * 1000,
  isProduction ? 10 : 120,
  'Too many requests from this IP'
);

module.exports = {
  createRateLimiter,
  authRateLimiter,
  apiRateLimiter,
  strictRateLimiter,
};
