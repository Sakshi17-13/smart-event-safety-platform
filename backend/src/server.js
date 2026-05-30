const http = require('http');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = require('./app');
const socketManager = require('./sockets/socket.manager');
const logger = require('./utils/logger');

const PORT = parseInt(process.env.PORT, 10) || 5001;
const PORT_FALLBACK_LIMIT = parseInt(process.env.PORT_FALLBACK_LIMIT, 10) || 10;
const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGODB_URL ||
  process.env.MONGO_URI ||
  'mongodb://localhost:27017/smart-event-safety';

const server = http.createServer(app);
const isDevelopment = (process.env.NODE_ENV || 'development') === 'development';
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
    setDatabaseStatus('connecting');
    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: parseInt(process.env.MONGODB_POOL_SIZE, 10) || 10,
      serverSelectionTimeoutMS: parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS, 10) || 5000,
      socketTimeoutMS: parseInt(process.env.MONGODB_SOCKET_TIMEOUT_MS, 10) || 45000,
      family: 4,
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
      process.exit(1);
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
    logger.info('Socket.io initialized successfully');
  } catch (error) {
    logger.error('Socket.io initialization error:', error);
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
      resolve(port);
    };

    server.once('error', handleError);
    server.once('listening', handleListening);
    server.listen(port);
  });
}

async function startServer() {
  try {
    await initializeDatabase();
    await initializeSocket();

    const activePort = await listenOnPort(PORT);
    writeRuntimePort(activePort);
    logger.info(`Server running on port ${activePort}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    if (mongoose.connection.readyState === 0) {
      process.exit(0);
    }
    mongoose.connection.close(false, () => {
      logger.info('MongoDB connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    if (mongoose.connection.readyState === 0) {
      process.exit(0);
    }
    mongoose.connection.close(false, () => {
      logger.info('MongoDB connection closed');
      process.exit(0);
    });
  });
});

startServer();
