const locationService = require('../services/location.service');
const logger = require('../utils/logger');

class LocationController {
  async updateLocation(req, res, next) {
    try {
      const userId = req.user.userId;
      const { eventId, coordinates, accuracy, altitude, speed, heading, metadata } = req.body;

      const location = await locationService.updateLocation({
        userId,
        eventId,
        coordinates,
        accuracy,
        altitude,
        speed,
        heading,
        metadata,
      });

      res.status(200).json({
        success: true,
        message: 'Location updated successfully',
        data: location,
      });
    } catch (error) {
      next(error);
    }
  }

  async getUserLocations(req, res, next) {
    try {
      const { userId } = req.params;
      const { eventId, limit = 50 } = req.query;

      const locations = await locationService.getUserLocations(userId, eventId, limit);

      res.status(200).json({
        success: true,
        message: 'User locations retrieved successfully',
        data: locations,
      });
    } catch (error) {
      next(error);
    }
  }

  async getEventLocations(req, res, next) {
    try {
      const { eventId } = req.params;
      const { limit = 100 } = req.query;

      const locations = await locationService.getEventLocations(eventId, limit);

      res.status(200).json({
        success: true,
        message: 'Event locations retrieved successfully',
        data: locations,
      });
    } catch (error) {
      next(error);
    }
  }

  async getNearbyUsers(req, res, next) {
    try {
      const { eventId } = req.params;
      const { coordinates, radius = 100 } = req.body;

      const users = await locationService.getNearbyUsers(eventId || req.body.eventId, coordinates, radius);

      res.status(200).json({
        success: true,
        message: 'Nearby users retrieved successfully',
        data: users,
      });
    } catch (error) {
      next(error);
    }
  }

  async getHeatmapData(req, res, next) {
    try {
      const { eventId } = req.params;
      const { startTime, endTime } = req.query;

      const heatmapData = await locationService.getHeatmapData(eventId, startTime, endTime);

      res.status(200).json({
        success: true,
        message: 'Heatmap data retrieved successfully',
        data: heatmapData,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new LocationController();
