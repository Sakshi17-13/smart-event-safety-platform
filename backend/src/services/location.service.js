const { Location, User } = require('../models');
const { AppError } = require('../utils/errors');

class LocationService {
  normalizeCoordinates(coordinates) {
    if (Array.isArray(coordinates)) return coordinates;
    if (coordinates?.longitude !== undefined && coordinates?.latitude !== undefined) {
      return [coordinates.longitude, coordinates.latitude];
    }
    if (coordinates?.lng !== undefined && coordinates?.lat !== undefined) {
      return [coordinates.lng, coordinates.lat];
    }
    throw new AppError('Valid coordinates are required', 400);
  }

  async updateLocation({ userId, eventId, coordinates, accuracy, altitude, speed, heading, metadata }) {
    const normalizedCoordinates = this.normalizeCoordinates(coordinates);

    const location = await Location.create({
      user: userId,
      event: eventId,
      coordinates: {
        type: 'Point',
        coordinates: normalizedCoordinates,
      },
      accuracy,
      altitude,
      speed,
      heading,
      metadata,
    });

    await User.findByIdAndUpdate(userId, {
      'metadata.lastLocation': {
        type: 'Point',
        coordinates: normalizedCoordinates,
      },
      'metadata.lastLocationUpdate': new Date(),
      'metadata.locationAccuracy': accuracy,
      'metadata.batteryLevel': metadata?.batteryLevel,
      'metadata.isCharging': metadata?.isCharging,
    });

    return location;
  }

  async getUserLocations(userId, eventId, limit = 50) {
    const query = { user: userId };
    if (eventId) query.event = eventId;

    return Location.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit, 10) || 50, 200));
  }

  async getEventLocations(eventId, limit = 100) {
    return Location.find({ event: eventId })
      .populate('user', 'firstName lastName email role')
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit, 10) || 100, 500));
  }

  async getNearbyUsers(eventId, coordinates, radius = 100) {
    const normalizedCoordinates = this.normalizeCoordinates(coordinates);
    const query = {
      coordinates: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: normalizedCoordinates,
          },
          $maxDistance: radius,
        },
      },
    };
    if (eventId) query.event = eventId;

    return Location.find(query)
      .populate('user', 'firstName lastName email role')
      .limit(100);
  }

  async getHeatmapData(eventId, startTime, endTime) {
    const match = { event: eventId };
    if (startTime || endTime) {
      match.createdAt = {};
      if (startTime) match.createdAt.$gte = new Date(startTime);
      if (endTime) match.createdAt.$lte = new Date(endTime);
    }

    return Location.aggregate([
      { $match: match },
      {
        $project: {
          latitude: { $arrayElemAt: ['$coordinates.coordinates', 1] },
          longitude: { $arrayElemAt: ['$coordinates.coordinates', 0] },
          weight: { $literal: 1 },
          createdAt: 1,
        },
      },
    ]);
  }
}

module.exports = new LocationService();
