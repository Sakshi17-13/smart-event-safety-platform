const http = require('http');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = require('./app');
const socketManager = require('./sockets/socket.manager');
const logger = require('./utils/logger');

const DEFAULT_DEVELOPMENT_PORT = 5001;
const PORT = parseInt(process.env.PORT, 10) || DEFAULT_DEVELOPMENT_PORT;
const HOST = process.env.HOST || '0.0.0.0';
const PORT_FALLBACK_LIMIT = parseInt(process.env.PORT_FALLBACK_LIMIT, 10) || 10;
const isDevelopment = (process.env.NODE_ENV || 'development') === 'development';
const environment = process.env.NODE_ENV || 'development';
const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGODB_URL ||
  process.env.MONGO_URI ||
  (isDevelopment ? 'mongodb://localhost:27017/smart-event-safety' : null);

const server = http.createServer(app);
server.keepAliveTimeout = parseInt(process.env.SERVER_KEEP_ALIVE_TIMEOUT_MS, 10) || 65000;
server.headersTimeout = parseInt(process.env.SERVER_HEADERS_TIMEOUT_MS, 10) || 66000;

const runtimeDir = path.resolve(__dirname, '../.runtime');
const runtimePortFile = path.join(runtimeDir, 'backend-port.json');

function setDatabaseStatus(status, error = null) {
  app.locals.dbAvailable = status === 'connected';
  app.locals.dbStatus = status;
  app.locals.dbError = error ? error.message : null;
}

function writeRuntimePort(activePort) {
  if (!isDevelopment) return;

  try {
    fs.mkdirSync(runtimeDir, { recursive: true });
    fs.writeFileSync(
      runtimePortFile,
      JSON.stringify(
        {
          port: activePort,
          url: `http://localhost:${activePort}`,
          pid: process.pid,
          updatedAt: new Date().toISOString(),
        },
        null,
        2
      )
    );
  } catch (error) {
    logger.warn('Unable to write backend runtime port file', { message: error.message });
  }
}

async function initializeDatabase() {
  try {
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI is required in production');
    }

    setDatabaseStatus('connecting');
    logger.info('MongoDB connection starting', {
      environment,
      hasMongoUri: Boolean(MONGODB_URI),
      serverSelectionTimeoutMs: parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS, 10) || 5000,
    });

    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: parseInt(process.env.MONGODB_POOL_SIZE, 10) || 10,
      serverSelectionTimeoutMS: parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS, 10) || 5000,
      socketTimeoutMS: parseInt(process.env.MONGODB_SOCKET_TIMEOUT_MS, 10) || 45000,
      family: 4,
      autoIndex: isDevelopment,
    });
    logger.info('MongoDB connected successfully', {
      host: mongoose.connection.host,
      database: mongoose.connection.name,
    });
    setDatabaseStatus('connected');
  } catch (error) {
    setDatabaseStatus('unavailable', error);
    logger.error('MongoDB connection failed. DB-dependent API routes are disabled temporarily.', {
      message: error.message,
      degradedMode: isDevelopment,
    });

    if (!isDevelopment) {
      throw error;
    }
  }
}

mongoose.connection.on('connected', () => {
  setDatabaseStatus('connected');
});

mongoose.connection.on('disconnected', () => {
  setDatabaseStatus('disconnected');
  logger.warn('MongoDB disconnected. DB-dependent API routes are temporarily unavailable.');
});

mongoose.connection.on('error', (error) => {
  setDatabaseStatus('error', error);
  logger.error('MongoDB connection error:', error);
});

async function initializeSocket() {
  try {
    socketManager.initialize(server);
    logger.info('Socket.io initialized successfully', { environment });
  } catch (error) {
    logger.error('Socket.io initialization error:', error);
    throw error;
  }
}

function listenOnPort(port, attemptsRemaining = PORT_FALLBACK_LIMIT) {
  return new Promise((resolve, reject) => {
    const handleError = (error) => {
      if (error.code === 'EADDRINUSE' && isDevelopment && attemptsRemaining > 0) {
        const nextPort = port + 1;
        logger.warn(`Port ${port} is already in use. Trying port ${nextPort}.`);
        server.removeListener('listening', handleListening);
        listenOnPort(nextPort, attemptsRemaining - 1).then(resolve).catch(reject);
        return;
      }

      reject(error);
    };

    const handleListening = () => {
      server.removeListener('error', handleError);
      const address = server.address();
      resolve({
        port: address?.port || port,
        host: address?.address || HOST,
      });
    };

    server.once('error', handleError);
    server.once('listening', handleListening);
    server.listen(port, HOST);
  });
}

async function startServer() {
  try {
    logger.info('Server startup beginning', {
      environment,
      port: PORT,
      host: HOST,
      renderService: Boolean(process.env.RENDER || process.env.RENDER_SERVICE_ID),
    });

    await initializeDatabase();
    await initializeSocket();

    const bind = await listenOnPort(PORT);
    const activePort = bind.port;
    writeRuntimePort(activePort);
    logger.info('Server bind successful', {
      host: bind.host,
      port: activePort,
      environment,
      mongodbStatus: app.locals.dbStatus,
      socketInitialized: Boolean(socketManager.io),
    });
  } catch (error) {
    logger.error('Failed to start server', {
      message: error.message,
      stack: error.stack,
      environment,
      port: PORT,
      host: HOST,
      mongodbStatus: app.locals.dbStatus,
    });
    process.exit(1);
  }
}

function shutdown(signal) {
  logger.info(`${signal} signal received: closing HTTP server`);

  const forceExitTimer = setTimeout(() => {
    logger.error('Forced shutdown after timeout', { signal });
    process.exit(1);
  }, parseInt(process.env.SHUTDOWN_TIMEOUT_MS, 10) || 10000);
  forceExitTimer.unref();

  const closeDatabaseAndExit = () => {
    if (mongoose.connection.readyState === 0) {
      clearTimeout(forceExitTimer);
      process.exit(0);
    }

    mongoose.connection.close(false, () => {
      logger.info('MongoDB connection closed');
      clearTimeout(forceExitTimer);
      process.exit(0);
    });
  };

  if (!server.listening) {
    logger.info('HTTP server was not listening during shutdown');
    closeDatabaseAndExit();
    return;
  }

  server.close(() => {
    logger.info('HTTP server closed');
    closeDatabaseAndExit();
  });
}

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (!isDevelopment) return;
  shutdown('unhandledRejection');
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  shutdown('SIGINT');
});

startServer();
