const logger = require('../utils/logger');
const { createSocketCorsOptions } = require('./cors.config');

class SocketConfig {
  constructor() {
    this.port = parseInt(process.env.SOCKET_PORT) || 5001;
    this.pingTimeout = parseInt(process.env.SOCKET_PING_TIMEOUT) || 60000;
    this.pingInterval = parseInt(process.env.SOCKET_PING_INTERVAL) || 25000;
    this.maxHttpBufferSize = 1e6;
    this.transports = ['websocket', 'polling'];
    this.redis = {
      enabled: process.env.REDIS_ENABLED === 'true',
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || '',
    };
  }

  getOptions() {
    return {
      cors: createSocketCorsOptions(),
      pingTimeout: this.pingTimeout,
      pingInterval: this.pingInterval,
      maxHttpBufferSize: this.maxHttpBufferSize,
      transports: this.transports,
      allowUpgrades: true,
    };
  }

  getAdapterOptions() {
    if (this.redis.enabled) {
      return {
        host: this.redis.host,
        port: this.redis.port,
        password: this.redis.password,
      };
    }
    return null;
  }
}

module.exports = new SocketConfig();
