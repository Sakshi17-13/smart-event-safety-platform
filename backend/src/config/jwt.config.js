const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

class JWTConfig {
  constructor() {
    this.accessTokenSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'your-refresh-token-secret';
    this.accessTokenExpiry = process.env.JWT_EXPIRE || '7d';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRE || '30d';
  }

  generateAccessToken(payload) {
    try {
      return jwt.sign(payload, this.accessTokenSecret, {
        expiresIn: this.accessTokenExpiry,
      });
    } catch (error) {
      logger.error('Error generating access token:', error);
      throw error;
    }
  }

  generateRefreshToken(payload) {
    try {
      return jwt.sign(payload, this.refreshTokenSecret, {
        expiresIn: this.refreshTokenExpiry,
      });
    } catch (error) {
      logger.error('Error generating refresh token:', error);
      throw error;
    }
  }

  verifyAccessToken(token) {
    try {
      return jwt.verify(token, this.accessTokenSecret);
    } catch (error) {
      logger.error('Error verifying access token:', error);
      throw error;
    }
  }

  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, this.refreshTokenSecret);
    } catch (error) {
      logger.error('Error verifying refresh token:', error);
      throw error;
    }
  }

  decodeToken(token) {
    try {
      return jwt.decode(token);
    } catch (error) {
      logger.error('Error decoding token:', error);
      throw error;
    }
  }
}

module.exports = new JWTConfig();
