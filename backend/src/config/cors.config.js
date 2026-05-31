const logger = require('../utils/logger');

const DEFAULT_PRODUCTION_ORIGINS = ['https://smart-event-safety-platform.vercel.app'];
const DEFAULT_DEVELOPMENT_ORIGINS = ['http://localhost:3000', 'http://localhost:5173'];

const splitOrigins = (value) => (
  (value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);

const buildAllowedOrigins = () => {
  const configuredOrigins = [
    ...splitOrigins(process.env.CORS_ORIGIN),
    ...splitOrigins(process.env.CORS_ORIGINS),
    ...splitOrigins(process.env.CLIENT_URL),
    ...splitOrigins(process.env.CLIENT_ORIGIN),
    ...splitOrigins(process.env.FRONTEND_URL),
    ...splitOrigins(process.env.FRONTEND_ORIGIN),
    ...splitOrigins(process.env.SOCKET_CORS_ORIGIN),
    ...splitOrigins(process.env.VERCEL_URL).map((url) => (url.startsWith('http') ? url : `https://${url}`)),
  ];

  const origins = new Set([...DEFAULT_PRODUCTION_ORIGINS, ...configuredOrigins]);

  if ((process.env.NODE_ENV || 'development') !== 'production') {
    DEFAULT_DEVELOPMENT_ORIGINS.forEach((origin) => origins.add(origin));
  }

  return Array.from(origins);
};

const isAllowedVercelPreview = (origin) => {
  try {
    const { hostname, protocol } = new URL(origin);
    return protocol === 'https:' && hostname.endsWith('.vercel.app') && process.env.ALLOW_VERCEL_PREVIEWS === 'true';
  } catch {
    return false;
  }
};

const isOriginAllowed = (origin, allowedOrigins = buildAllowedOrigins()) => (
  !origin || allowedOrigins.includes(origin) || isAllowedVercelPreview(origin)
);

const createCorsOptions = () => {
  const allowedOrigins = buildAllowedOrigins();

  return {
    origin(origin, callback) {
      if (isOriginAllowed(origin, allowedOrigins)) {
        callback(null, true);
        return;
      }

      logger.warn('CORS blocked request origin', {
        origin,
        allowedOrigins,
        environment: process.env.NODE_ENV || 'development',
      });
      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 204,
  };
};

const createSocketCorsOptions = () => {
  const allowedOrigins = buildAllowedOrigins();

  return {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin, allowedOrigins)) {
        callback(null, true);
        return;
      }

      logger.warn('Socket.io CORS blocked request origin', {
        origin,
        allowedOrigins,
        environment: process.env.NODE_ENV || 'development',
      });
      callback(new Error(`Origin ${origin} is not allowed by Socket.io CORS`));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
  };
};

module.exports = {
  buildAllowedOrigins,
  createCorsOptions,
  createSocketCorsOptions,
};
