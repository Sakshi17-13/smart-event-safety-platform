const { User } = require('../models');
const tokenUtils = require('../utils/token.utils');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

class AuthService {
  createAuthResult(user, tokens) {
    return {
      user: this.sanitizeUser(user),
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      },
    };
  }

  async signup(userData) {
    try {
      const { firstName, lastName, email, password, role } = userData;

      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        throw new AppError('User with this email already exists', 409);
      }

      const user = await User.create({
        email: email.toLowerCase(),
        password,
        firstName,
        lastName,
        role,
        isVerified: false,
      });

      const verificationToken = user.generateVerificationToken();
      await user.save();

      const tokens = tokenUtils.generateTokenPair(user);

      user.refreshToken = tokenUtils.hashToken(tokens.refreshToken);
      await user.save();

      logger.info('User registered successfully', { userId: user._id, email: user.email, role: user.role });

      return this.createAuthResult(user, tokens);
    } catch (error) {
      logger.error('Signup error:', error);
      throw error;
    }
  }

  async login(email, password, ipAddress, userAgent) {
    try {
      const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
      if (!user) {
        throw new AppError('Invalid email or password', 401);
      }

      if (!user.isActive) {
        throw new AppError('Account has been deactivated', 403);
      }

      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        throw new AppError('Invalid email or password', 401);
      }

      const tokens = tokenUtils.generateTokenPair(user);

      user.refreshToken = tokenUtils.hashToken(tokens.refreshToken);
      user.lastLogin = new Date();
      user.addLoginHistory(ipAddress, userAgent, 'web', null);
      await user.save();

      logger.info('User logged in successfully', { userId: user._id, email: user.email, role: user.role });

      return this.createAuthResult(user, tokens);
    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    }
  }

  async refreshToken(refreshTokenString) {
    try {
      const decoded = tokenUtils.verifyRefreshToken(refreshTokenString);

      const user = await User.findById(decoded.userId).select('+refreshToken');
      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (!user.isActive) {
        throw new AppError('Account has been deactivated', 403);
      }

      const isTokenValid = tokenUtils.verifyTokenHash(refreshTokenString, user.refreshToken);
      if (!isTokenValid) {
        throw new AppError('Invalid refresh token', 401);
      }

      const newTokens = tokenUtils.generateTokenPair(user);

      user.refreshToken = tokenUtils.hashToken(newTokens.refreshToken);
      await user.save();

      logger.info('Token refreshed successfully', { userId: user._id });

      return this.createAuthResult(user, newTokens);
    } catch (error) {
      logger.error('Refresh token error:', error);
      throw error;
    }
  }

  async logout(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      user.refreshToken = null;
      await user.save();

      logger.info('User logged out successfully', { userId });

      return { message: 'Logout successful' };
    } catch (error) {
      logger.error('Logout error:', error);
      throw error;
    }
  }

  async logoutAllDevices(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      user.refreshToken = null;
      await user.save();

      logger.info('User logged out from all devices', { userId });

      return { message: 'Logged out from all devices' };
    } catch (error) {
      logger.error('Logout all devices error:', error);
      throw error;
    }
  }

  async verifyEmail(token) {
    try {
      const user = await User.findOne({
        verificationToken: token,
        verificationExpires: { $gt: new Date() },
      });

      if (!user) {
        throw new AppError('Invalid or expired verification token', 400);
      }

      user.isVerified = true;
      user.verificationToken = null;
      user.verificationExpires = null;
      await user.save();

      logger.info('Email verified successfully', { userId: user._id });

      return { message: 'Email verified successfully' };
    } catch (error) {
      logger.error('Email verification error:', error);
      throw error;
    }
  }

  async forgotPassword(email) {
    try {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        throw new AppError('User not found', 404);
      }

      const resetToken = user.generateResetToken();
      await user.save();

      logger.info('Password reset token generated', { userId: user._id });

      return {
        message: 'Password reset token generated',
        resetToken,
      };
    } catch (error) {
      logger.error('Forgot password error:', error);
      throw error;
    }
  }

  async resetPassword(token, newPassword) {
    try {
      const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: new Date() },
      }).select('+password');

      if (!user) {
        throw new AppError('Invalid or expired reset token', 400);
      }

      user.password = newPassword;
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();

      logger.info('Password reset successfully', { userId: user._id });

      return { message: 'Password reset successfully' };
    } catch (error) {
      logger.error('Reset password error:', error);
      throw error;
    }
  }

  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await User.findById(userId).select('+password');
      if (!user) {
        throw new AppError('User not found', 404);
      }

      const isPasswordValid = await user.comparePassword(currentPassword);
      if (!isPasswordValid) {
        throw new AppError('Current password is incorrect', 401);
      }

      user.password = newPassword;
      await user.save();

      logger.info('Password changed successfully', { userId });

      return { message: 'Password changed successfully' };
    } catch (error) {
      logger.error('Change password error:', error);
      throw error;
    }
  }

  async getProfile(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      return this.sanitizeUser(user);
    } catch (error) {
      logger.error('Get profile error:', error);
      throw error;
    }
  }

  async updateProfile(userId, updates) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      const allowedUpdates = ['firstName', 'lastName', 'phone', 'dateOfBirth', 'gender', 'emergencyContact', 'preferences'];
      const filteredUpdates = {};

      for (const key of allowedUpdates) {
        if (updates[key] !== undefined) {
          filteredUpdates[key] = updates[key];
        }
      }

      Object.assign(user, filteredUpdates);
      await user.save();

      logger.info('Profile updated successfully', { userId });

      return this.sanitizeUser(user);
    } catch (error) {
      logger.error('Update profile error:', error);
      throw error;
    }
  }

  async updateRole(userId, newRole) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      const validRoles = ['SUPER_ADMIN', 'EVENT_ORGANIZER', 'FAMILY'];
      if (!validRoles.includes(newRole)) {
        throw new AppError('Invalid role', 400);
      }

      user.role = newRole;
      await user.save();

      logger.info('User role updated', { userId, newRole });

      return this.sanitizeUser(user);
    } catch (error) {
      logger.error('Update role error:', error);
      throw error;
    }
  }

  sanitizeUser(user) {
    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.password;
    delete userObj.refreshToken;
    delete userObj.verificationToken;
    delete userObj.resetPasswordToken;
    delete userObj.__v;
    return userObj;
  }

  hasPermission(userRole, requiredRole) {
    const roleHierarchy = {
      SUPER_ADMIN: 3,
      EVENT_ORGANIZER: 2,
      FAMILY: 1,
    };

    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  }
}

module.exports = new AuthService();
