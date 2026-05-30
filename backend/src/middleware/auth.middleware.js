const tokenUtils = require('../utils/token.utils');
const logger = require('../utils/logger');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');

const buildRequestUser = (decoded) => ({
  userId: decoded.userId,
  email: decoded.email,
  role: decoded.role,
  firstName: decoded.firstName,
  lastName: decoded.lastName,
  isVerified: decoded.isVerified,
});

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.substring(7);

    const decoded = tokenUtils.verifyAccessToken(token);

    req.user = buildRequestUser(decoded);

    logger.debug('User authenticated', { userId: req.user.userId, role: req.user.role });

    next();
  } catch (error) {
    if (error.message === 'Access token expired') {
      logger.warn('Expired token attempt', { ip: req.ip });
      return next(new UnauthorizedError('Token expired'));
    }
    if (error.message === 'Invalid access token') {
      logger.warn('Invalid token attempt', { ip: req.ip });
      return next(new UnauthorizedError('Invalid token'));
    }
    next(error);
  }
};

const roleMiddleware = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const roleHierarchy = {
        SUPER_ADMIN: 3,
        EVENT_ORGANIZER: 2,
        FAMILY: 1,
      };

      const userRoleLevel = roleHierarchy[req.user.role] || 0;
      const requiredRoleLevel = Math.min(...allowedRoles.map((role) => roleHierarchy[role] || 0).filter(Boolean));

      if (userRoleLevel < requiredRoleLevel) {
        logger.warn('Unauthorized role access attempt', {
          userId: req.user.userId,
          role: req.user.role,
          requiredRoles: allowedRoles,
        });
        throw new ForbiddenError('Insufficient permissions');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

const requireRole = (role) => {
  return roleMiddleware(role);
};

const requireSuperAdmin = roleMiddleware('SUPER_ADMIN');
const requireEventOrganizer = roleMiddleware('SUPER_ADMIN', 'EVENT_ORGANIZER');
const requireFamily = roleMiddleware('SUPER_ADMIN', 'EVENT_ORGANIZER', 'FAMILY');

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = tokenUtils.verifyAccessToken(token);
      req.user = buildRequestUser(decoded);
    }

    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!req.user.isVerified) {
      throw new ForbiddenError('Email verification required');
    }

    next();
  } catch (error) {
    next(error);
  }
};

const checkPermission = (permission) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const rolePermissions = {
        SUPER_ADMIN: ['all'],
        EVENT_ORGANIZER: ['create_events', 'manage_events', 'view_analytics', 'manage_attendees'],
        FAMILY: ['view_events', 'register_events', 'share_location', 'trigger_alerts'],
      };

      const userPermissions = rolePermissions[req.user.role] || [];

      if (!userPermissions.includes('all') && !userPermissions.includes(permission)) {
        throw new ForbiddenError('Insufficient permissions');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  authMiddleware,
  roleMiddleware,
  requireRole,
  requireSuperAdmin,
  requireEventOrganizer,
  requireFamily,
  optionalAuth,
  verifyEmail,
  checkPermission,
};
