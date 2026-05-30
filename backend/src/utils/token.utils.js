const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class TokenUtils {
  constructor() {
    this.accessTokenSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'your-refresh-token-secret';
    this.accessTokenExpiry = process.env.JWT_EXPIRE || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRE || '7d';
    this.verificationTokenExpiry = '24h';
    this.resetTokenExpiry = '1h';
  }

  generateAccessToken(payload) {
    try {
      return jwt.sign(payload, this.accessTokenSecret, {
        expiresIn: this.accessTokenExpiry,
        issuer: 'smart-event-safety',
        audience: 'smart-event-safety-users',
      });
    } catch (error) {
      throw new Error('Failed to generate access token');
    }
  }

  generateRefreshToken(payload) {
    try {
      return jwt.sign(payload, this.refreshTokenSecret, {
        expiresIn: this.refreshTokenExpiry,
        issuer: 'smart-event-safety',
        audience: 'smart-event-safety-users',
      });
    } catch (error) {
      throw new Error('Failed to generate refresh token');
    }
  }

  verifyAccessToken(token) {
    try {
      return jwt.verify(token, this.accessTokenSecret, {
        issuer: 'smart-event-safety',
        audience: 'smart-event-safety-users',
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Access token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid access token');
      }
      throw new Error('Token verification failed');
    }
  }

  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, this.refreshTokenSecret, {
        issuer: 'smart-event-safety',
        audience: 'smart-event-safety-users',
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid refresh token');
      }
      throw new Error('Token verification failed');
    }
  }

  decodeToken(token) {
    try {
      return jwt.decode(token);
    } catch (error) {
      throw new Error('Failed to decode token');
    }
  }

  generateTokenPair(user) {
    const payload = {
      userId: user._id?.toString() || user.userId?.toString(),
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenExpiry,
    };
  }

  generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  generateResetToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  verifyTokenHash(token, hash) {
    const tokenHash = this.hashToken(token);
    return tokenHash === hash;
  }

  getTokenExpiration(token) {
    const decoded = this.decodeToken(token);
    if (decoded && decoded.exp) {
      return new Date(decoded.exp * 1000);
    }
    return null;
  }

  isTokenExpired(token) {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) return true;
    return new Date() > expiration;
  }

  getTimeUntilExpiration(token) {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) return 0;
    const now = new Date();
    const diff = expiration - now;
    return Math.max(0, diff);
  }

  shouldRefreshToken(token) {
    const timeUntilExpiration = this.getTimeUntilExpiration(token);
    const fiveMinutes = 5 * 60 * 1000;
    return timeUntilExpiration < fiveMinutes;
  }
}

module.exports = new TokenUtils();
