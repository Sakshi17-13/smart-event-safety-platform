const alertService = require('../services/alert.service');
const logger = require('../utils/logger');

class AlertController {
  async createAlert(req, res, next) {
    try {
      const userId = req.user.userId;
      const alertData = req.body;

      const alert = await alertService.createAlert(userId, alertData);

      logger.info('Alert created', { alertId: alert.id, type: alert.type, userId });

      res.status(201).json({
        success: true,
        message: 'Alert created successfully',
        data: alert,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAlerts(req, res, next) {
    try {
      const { eventId } = req.params;
      const filters = req.query;

      const alerts = await alertService.getAlerts(eventId, filters);

      res.status(200).json({
        success: true,
        message: 'Alerts retrieved successfully',
        data: alerts,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAlertById(req, res, next) {
    try {
      const { alertId } = req.params;

      const alert = await alertService.getAlertById(alertId);

      res.status(200).json({
        success: true,
        message: 'Alert retrieved successfully',
        data: alert,
      });
    } catch (error) {
      next(error);
    }
  }

  async acknowledgeAlert(req, res, next) {
    try {
      const { alertId } = req.params;
      const userId = req.user.userId;

      const alert = await alertService.acknowledgeAlert(alertId, userId);

      logger.info('Alert acknowledged', { alertId, userId });

      res.status(200).json({
        success: true,
        message: 'Alert acknowledged successfully',
        data: alert,
      });
    } catch (error) {
      next(error);
    }
  }

  async resolveAlert(req, res, next) {
    try {
      const { alertId } = req.params;
      const userId = req.user.userId;
      const { resolution } = req.body;

      const alert = await alertService.resolveAlert(alertId, userId, resolution);

      logger.info('Alert resolved', { alertId, userId });

      res.status(200).json({
        success: true,
        message: 'Alert resolved successfully',
        data: alert,
      });
    } catch (error) {
      next(error);
    }
  }

  async dismissAlert(req, res, next) {
    try {
      const { alertId } = req.params;
      const userId = req.user.userId;

      const alert = await alertService.dismissAlert(alertId, userId);

      logger.info('Alert dismissed', { alertId, userId });

      res.status(200).json({
        success: true,
        message: 'Alert dismissed successfully',
        data: alert,
      });
    } catch (error) {
      next(error);
    }
  }

  async triggerEmergency(req, res, next) {
    try {
      const userId = req.user.userId;
      const { eventId, location, description } = req.body;

      const alert = await alertService.triggerEmergency(userId, eventId, location, description);

      logger.warn('Emergency alert triggered', { alertId: alert.id, userId, eventId });

      res.status(201).json({
        success: true,
        message: 'Emergency alert triggered',
        data: alert,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AlertController();
