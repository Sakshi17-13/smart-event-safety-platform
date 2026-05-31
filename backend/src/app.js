const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const apiRoutes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');
const createMockFallbackMiddleware = require('./middleware/mockFallback.middleware');
const { createCorsOptions } = require('./config/cors.config');

const app = express();
const isDevelopment = (process.env.NODE_ENV || 'development') === 'development';
const allowNoDb = isDevelopment && process.env.DEV_ALLOW_NO_DB === 'true';
const noDbAllowedPaths = new Set();

app.locals.dbAvailable = false;
app.locals.dbStatus = 'not_connected';
app.locals.dbError = null;

app.use(helmet());

const corsOptions = createCorsOptions();
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(morgan('combined'));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 2000 : 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', apiRateLimiter);

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    data: {
      database: {
        available: req.app.locals.dbAvailable,
        status: req.app.locals.dbStatus,
        error: req.app.locals.dbError,
      },
    },
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', createMockFallbackMiddleware({ allowNoDb }));

app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  if (req.app.locals.dbAvailable) return next();
  if (allowNoDb && noDbAllowedPaths.has(req.path)) return next();

  return res.status(503).json({
    success: false,
    message: allowNoDb
      ? 'Database is temporarily unavailable. The server is running in development fallback mode.'
      : 'Database is temporarily unavailable. Please try again shortly.',
    data: {
      database: {
        available: false,
        status: req.app.locals.dbStatus,
        error: req.app.locals.dbError,
      },
    },
  });
});

app.use('/api', apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
