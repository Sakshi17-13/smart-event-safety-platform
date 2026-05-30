const eventService = require('../services/event.service');
const socketManager = require('../sockets/socket.manager');
const logger = require('../utils/logger');

class EventController {
  async createEvent(req, res, next) {
    try {
      const organizerId = req.user.userId;
      const eventData = req.body;

      const event = await eventService.createEvent(organizerId, eventData);

      logger.info('Event created successfully', { eventId: event._id, organizerId });
      socketManager.sendToUser(organizerId, 'EVENT_CREATED', event);
      socketManager.broadcastToEventDirectory('EVENT_CREATED', event);

      res.status(201).json({
        success: true,
        message: 'Event created successfully',
        data: event,
      });
    } catch (error) {
      next(error);
    }
  }

  async getEvents(req, res, next) {
    try {
      const userId = req.user.userId;
      const filters = req.query;

      const events = await eventService.getEvents(userId, req.user.role, filters);

      res.status(200).json({
        success: true,
        data: events,
      });
    } catch (error) {
      next(error);
    }
  }

  async getEventById(req, res, next) {
    try {
      const { eventId } = req.params;
      const userId = req.user.userId;

      const event = await eventService.getEventById(eventId, userId, req.user.role);

      res.status(200).json({
        success: true,
        data: event,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateEvent(req, res, next) {
    try {
      const { eventId } = req.params;
      const userId = req.user.userId;
      const updates = req.body;

      const event = await eventService.updateEvent(eventId, userId, updates, req.user.role);

      logger.info('Event updated successfully', { eventId, userId });
      socketManager.broadcastToEvent(eventId, 'EVENT_UPDATED', event);
      socketManager.broadcastToOrganizer(eventId, 'EVENT_UPDATED', event);
      socketManager.broadcastToEventDirectory('EVENT_UPDATED', event);

      res.status(200).json({
        success: true,
        message: 'Event updated successfully',
        data: event,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteEvent(req, res, next) {
    try {
      const { eventId } = req.params;
      const userId = req.user.userId;

      await eventService.deleteEvent(eventId, userId, req.user.role);

      logger.info('Event deleted successfully', { eventId, userId });
      socketManager.broadcastToEvent(eventId, 'EVENT_DELETED', { eventId });
      socketManager.broadcastToOrganizer(eventId, 'EVENT_DELETED', { eventId });
      socketManager.broadcastToEventDirectory('EVENT_DELETED', { eventId });

      res.status(200).json({
        success: true,
        message: 'Event deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async addStaff(req, res, next) {
    try {
      const { eventId } = req.params;
      const userId = req.user.userId;
      const { staffId, role, permissions } = req.body;

      const event = await eventService.addStaff(eventId, userId, staffId, role, permissions);

      logger.info('Staff added to event', { eventId, staffId, role });

      res.status(200).json({
        success: true,
        message: 'Staff added successfully',
        data: event,
      });
    } catch (error) {
      next(error);
    }
  }

  async removeStaff(req, res, next) {
    try {
      const { eventId, staffId } = req.params;
      const userId = req.user.userId;

      const event = await eventService.removeStaff(eventId, userId, staffId);

      logger.info('Staff removed from event', { eventId, staffId });

      res.status(200).json({
        success: true,
        message: 'Staff removed successfully',
        data: event,
      });
    } catch (error) {
      next(error);
    }
  }

  async registerAttendee(req, res, next) {
    try {
      const { eventId } = req.params;
      const userId = req.user.userId;

      const event = await eventService.registerAttendee(eventId, userId);

      logger.info('Attendee registered for event', { eventId, userId });
      socketManager.broadcastToEvent(eventId, 'EVENT_UPDATED', event);
      socketManager.broadcastToOrganizer(eventId, 'EVENT_UPDATED', event);
      socketManager.broadcastToEventDirectory('EVENT_UPDATED', event);

      res.status(200).json({
        success: true,
        message: 'Registered successfully',
        data: event,
      });
    } catch (error) {
      next(error);
    }
  }

  async checkInAttendee(req, res, next) {
    try {
      const { eventId, attendeeId } = req.params;
      const userId = req.user.userId;

      const event = await eventService.checkInAttendee(eventId, attendeeId, userId);

      logger.info('Attendee checked in', { eventId, attendeeId });

      res.status(200).json({
        success: true,
        message: 'Check-in successful',
        data: event,
      });
    } catch (error) {
      next(error);
    }
  }

  async checkOutAttendee(req, res, next) {
    try {
      const { eventId, attendeeId } = req.params;
      const userId = req.user.userId;

      const event = await eventService.checkOutAttendee(eventId, attendeeId, userId);

      logger.info('Attendee checked out', { eventId, attendeeId });

      res.status(200).json({
        success: true,
        message: 'Check-out successful',
        data: event,
      });
    } catch (error) {
      next(error);
    }
  }

  async getEventStatistics(req, res, next) {
    try {
      const { eventId } = req.params;
      const userId = req.user.userId;

      const statistics = await eventService.getEventStatistics(eventId, userId, req.user.role);

      res.status(200).json({
        success: true,
        message: 'Event statistics retrieved successfully',
        data: statistics,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new EventController();
