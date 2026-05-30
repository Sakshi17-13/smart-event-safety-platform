const tokenUtils = require('../utils/token.utils');
const logger = require('../utils/logger');

class SocketAuthMiddleware {
  authenticate(socket, next) {
    try {
      const deviceId = socket.handshake.auth.deviceId;
      const familyCode = socket.handshake.auth.familyCode;
      const allowDeviceSession = (process.env.NODE_ENV || 'development') === 'development' && process.env.DEV_ALLOW_NO_DB === 'true';

      if (deviceId && familyCode && allowDeviceSession) {
        socket.user = {
          userId: deviceId,
          role: 'DEVICE',
          deviceId,
          familyCode,
          firstName: 'Wearable',
          lastName: 'Device',
        };

        logger.info('Development device socket authenticated', {
          socketId: socket.id,
          deviceId,
          familyCode,
        });

        return next();
      }

      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        logger.warn('Socket connection attempt without token', { ip: socket.handshake.address });
        return next(new Error('Authentication token required'));
      }

      const decoded = tokenUtils.verifyAccessToken(token);

      socket.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        firstName: decoded.firstName,
        lastName: decoded.lastName,
      };

      logger.info('Socket authenticated successfully', {
        socketId: socket.id,
        userId: socket.user.userId,
        role: socket.user.role,
      });

      next();
    } catch (error) {
      logger.warn('Socket authentication failed', {
        socketId: socket.id,
        error: error.message,
        ip: socket.handshake.address,
      });
      next(new Error('Authentication failed'));
    }
  }

  authorizeRole(...allowedRoles) {
    return (socket, next) => {
      try {
        if (!socket.user) {
          return next(new Error('Authentication required'));
        }

        const roleHierarchy = {
          SUPER_ADMIN: 3,
          EVENT_ORGANIZER: 2,
          FAMILY: 1,
        };

        const userRoleLevel = roleHierarchy[socket.user.role] || 0;
        const requiredRoleLevel = Math.max(...allowedRoles.map((role) => roleHierarchy[role] || 0));

        if (userRoleLevel < requiredRoleLevel) {
          logger.warn('Socket unauthorized role access attempt', {
            socketId: socket.id,
            userId: socket.user.userId,
            role: socket.user.role,
            requiredRoles: allowedRoles,
          });
          return next(new Error('Insufficient permissions'));
        }

        next();
      } catch (error) {
        logger.error('Socket authorization error:', error);
        next(new Error('Authorization failed'));
      }
    };
  }

  requireSuperAdmin = this.authorizeRole('SUPER_ADMIN');
  requireEventOrganizer = this.authorizeRole('SUPER_ADMIN', 'EVENT_ORGANIZER');
  requireFamily = this.authorizeRole('SUPER_ADMIN', 'EVENT_ORGANIZER', 'FAMILY');
}

module.exports = new SocketAuthMiddleware();
