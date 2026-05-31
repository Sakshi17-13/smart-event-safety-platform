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
    ...splitOrigins(process.env.CLIENT_URL),
    ...splitOrigins(process.env.SOCKET_CORS_ORIGIN),
    ...splitOrigins(process.env.VERCEL_URL).map((url) => (url.startsWith('http') ? url : `https://${url}`)),
  ];

  const origins = new Set(configuredOrigins);

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

      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
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

      callback(new Error(`Origin ${origin} is not allowed by Socket.io CORS`));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  };
};

module.exports = {
  buildAllowedOrigins,
  createCorsOptions,
  createSocketCorsOptions,
};
