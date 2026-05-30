const userService = require('../services/user.service');
const logger = require('../utils/logger');

class UserController {
  async getUsers(req, res, next) {
    try {
      const filters = req.query;

      const users = await userService.getUsers(filters);

      res.status(200).json({
        success: true,
        message: 'Users retrieved successfully',
        data: users,
      });
    } catch (error) {
      next(error);
    }
  }

  async getUserById(req, res, next) {
    try {
      const userId = req.params.userId || req.user.userId;

      const user = await userService.getUserById(userId);

      res.status(200).json({
        success: true,
        message: 'User retrieved successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateUser(req, res, next) {
    try {
      const userId = req.params.userId || req.user.userId;
      const updates = req.body;

      const user = await userService.updateUser(userId, updates);

      logger.info('User updated by admin', { userId, adminId: req.user.userId });

      res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteUser(req, res, next) {
    try {
      const { userId } = req.params;

      await userService.deleteUser(userId);

      logger.info('User deleted by admin', { userId, adminId: req.user.userId });

      res.status(200).json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateUserRole(req, res, next) {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      const user = await userService.updateUserRole(userId, role);

      logger.info('User role updated', { userId, role, adminId: req.user.userId });

      res.status(200).json({
        success: true,
        message: 'User role updated successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  async deactivateUser(req, res, next) {
    try {
      const { userId } = req.params;

      const user = await userService.deactivateUser(userId);

      logger.info('User deactivated', { userId, adminId: req.user.userId });

      res.status(200).json({
        success: true,
        message: 'User deactivated successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  async activateUser(req, res, next) {
    try {
      const { userId } = req.params;

      const user = await userService.activateUser(userId);

      logger.info('User activated', { userId, adminId: req.user.userId });

      res.status(200).json({
        success: true,
        message: 'User activated successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();
