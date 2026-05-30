const morgan = require('morgan');
const logger = require('../utils/logger');

morgan.token('user-id', (req) => req.user?.userId || 'anonymous');
morgan.token('user-role', (req) => req.user?.role || 'none');

const morganFormat = ':method :url :status :response-time ms - :res[content-length] - :user-id (:user-role)';

const loggerMiddleware = morgan(morganFormat, {
  stream: {
    write: (message) => {
      logger.info(message.trim());
    },
  },
});

const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userId: req.user?.userId,
      userAgent: req.get('user-agent'),
    });
  });

  next();
};

module.exports = {
  loggerMiddleware,
  requestLogger,
};
