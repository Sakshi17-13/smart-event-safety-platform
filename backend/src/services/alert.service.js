const { Alert, Event } = require('../models');
const { AppError } = require('../utils/errors');

class AlertService {
  normalizeLocation(location) {
    if (!location) return undefined;
    if (location.type === 'Point' && Array.isArray(location.coordinates)) return location;
    if (Array.isArray(location)) {
      return { type: 'Point', coordinates: location };
    }
    if (location.longitude !== undefined && location.latitude !== undefined) {
      return {
        type: 'Point',
        coordinates: [location.longitude, location.latitude],
        accuracy: location.accuracy,
        altitude: location.altitude,
        address: location.address,
        landmark: location.landmark,
        area: location.area,
      };
    }
    if (location.lng !== undefined && location.lat !== undefined) {
      return {
        type: 'Point',
        coordinates: [location.lng, location.lat],
        accuracy: location.accuracy,
        altitude: location.altitude,
        address: location.address,
        landmark: location.landmark,
        area: location.area,
      };
    }
    return location;
  }

  async createAlert(userId, alertData) {
    const event = await Event.findById(alertData.event || alertData.eventId);
    if (!event) throw new AppError('Event not found', 404);

    return Alert.create({
      ...alertData,
      event: alertData.event || alertData.eventId,
      location: this.normalizeLocation(alertData.location),
      source: alertData.source || {
        type: 'user',
        userId,
      },
    });
  }

  async getAlerts(eventId, filters = {}) {
    const query = {};
    if (eventId) query.event = eventId;
    if (filters.status) query.status = filters.status;
    if (filters.type) query.type = filters.type;
    if (filters.severity) query.severity = filters.severity;

    const limit = Math.min(parseInt(filters.limit, 10) || 50, 200);

    return Alert.find(query)
      .populate('event', 'name status schedule')
      .populate('source.userId', 'firstName lastName email role')
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  async getAlertById(alertId) {
    const alert = await Alert.findById(alertId)
      .populate('event', 'name status schedule')
      .populate('source.userId', 'firstName lastName email role');

    if (!alert) throw new AppError('Alert not found', 404);
    return alert;
  }

  async acknowledgeAlert(alertId, userId) {
    const alert = await this.getAlertById(alertId);
    alert.acknowledge(userId);
    await alert.save();
    return alert;
  }

  async resolveAlert(alertId, userId, resolution = '') {
    const alert = await this.getAlertById(alertId);
    alert.resolve(userId, resolution);
    await alert.save();
    return alert;
  }

  async dismissAlert(alertId, userId) {
    const alert = await this.getAlertById(alertId);
    alert.dismiss(userId);
    await alert.save();
    return alert;
  }

  async triggerEmergency(userId, eventId, location, description = 'Emergency SOS triggered') {
    return this.createAlert(userId, {
      event: eventId,
      type: 'emergency',
      severity: 'critical',
      title: 'SOS Alert',
      description,
      location,
      notifications: {
        sent: true,
        sentAt: new Date(),
      },
    });
  }
}

module.exports = new AlertService();
