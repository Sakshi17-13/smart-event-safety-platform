const { Event } = require('../models');
const { AppError } = require('../utils/errors');

class EventService {
  buildVisibilityQuery(userId, role) {
    if (role === 'SUPER_ADMIN') return {};

    if (role === 'EVENT_ORGANIZER') {
      return {
        $or: [
          { organizer: userId },
          { staff: { $elemMatch: { user: userId, isActive: true } } },
        ],
      };
    }

    return { 'attendees.user': userId };
  }

  canViewEvent(event, userId, role) {
    if (role === 'SUPER_ADMIN') return true;
    if (this.canManageEvent(event, userId, role)) return true;
    return event.attendees?.some((attendee) => attendee.user.toString() === userId?.toString());
  }

  canManageEvent(event, userId, role) {
    if (role === 'SUPER_ADMIN') return true;
    if (event.organizer?.toString() === userId?.toString()) return true;
    return event.staff?.some((staff) => staff.user.toString() === userId?.toString() && staff.isActive);
  }

  normalizeEventData(eventData = {}) {
    const startDate = new Date(eventData.schedule?.startDate || eventData.date || Date.now());
    const endDate = new Date(eventData.schedule?.endDate || startDate.getTime() + 8 * 60 * 60 * 1000);
    const latitude = Number(eventData.latitude ?? eventData.venue?.location?.coordinates?.[1] ?? 19.076);
    const longitude = Number(eventData.longitude ?? eventData.venue?.location?.coordinates?.[0] ?? 72.8777);
    const venueName = eventData.venue?.name || eventData.location || 'Event Venue';
    const address = eventData.venue?.address || {};

    return {
      name: eventData.name,
      description: eventData.description,
      category: eventData.category || 'other',
      status: eventData.status || 'draft',
      venue: {
        ...eventData.venue,
        name: venueName,
        address: {
          ...address,
          city: address.city || eventData.city || venueName,
          country: address.country || eventData.country || 'India',
        },
        location: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        capacity: Number(eventData.venue?.capacity || eventData.capacity || 1),
      },
      schedule: {
        ...eventData.schedule,
        startDate,
        endDate,
        timezone: eventData.schedule?.timezone || eventData.timezone || 'Asia/Kolkata',
      },
    };
  }

  serializeEvent(event) {
    const eventObj = event.toObject ? event.toObject() : { ...event };
    return {
      ...eventObj,
      location: eventObj.venue?.name,
      latitude: eventObj.venue?.location?.coordinates?.[1],
      longitude: eventObj.venue?.location?.coordinates?.[0],
      capacity: eventObj.venue?.capacity,
      date: eventObj.schedule?.startDate,
      attendees: eventObj.statistics?.totalAttendees || eventObj.attendees?.length || 0,
      checkedIn: eventObj.statistics?.checkedIn || 0,
    };
  }

  async createEvent(organizerId, eventData) {
    const event = await Event.create({
      ...this.normalizeEventData(eventData),
      organizer: organizerId,
    });
    return this.serializeEvent(event);
  }

  async getEvents(userId, role, filters = {}) {
    const query = this.buildVisibilityQuery(userId, role);

    if (filters.status) query.status = filters.status;
    if (filters.category) query.category = filters.category;
    if (filters.organizer && role === 'SUPER_ADMIN') query.organizer = filters.organizer;

    const events = await Event.find(query)
      .populate('organizer', 'firstName lastName email role')
      .sort({ 'schedule.startDate': 1, createdAt: -1 });
    return events.map((event) => this.serializeEvent(event));
  }

  async getEventById(eventId, userId, role = null) {
    const event = await Event.findById(eventId)
      .populate('organizer', 'firstName lastName email role')
      .populate('staff.user', 'firstName lastName email role')
      .populate('attendees.user', 'firstName lastName email role');

    if (!event) {
      throw new AppError('Event not found', 404);
    }

    if (!this.canViewEvent(event, userId, role)) {
      throw new AppError('Not authorized to view this event', 403);
    }

    return this.serializeEvent(event);
  }

  async updateEvent(eventId, userId, updates, role = null) {
    const event = await Event.findById(eventId);
    if (!event) throw new AppError('Event not found', 404);

    if (!this.canManageEvent(event, userId, role)) {
      throw new AppError('Not authorized to update this event', 403);
    }

    Object.assign(event, this.normalizeEventData({ ...event.toObject(), ...updates }));
    await event.save();
    return this.serializeEvent(event);
  }

  async deleteEvent(eventId, userId, role = null) {
    const event = await Event.findById(eventId);
    if (!event) throw new AppError('Event not found', 404);

    if (!this.canManageEvent(event, userId, role)) {
      throw new AppError('Not authorized to delete this event', 403);
    }

    await event.deleteOne();
  }

  async addStaff(eventId, userId, staffId, role, permissions = [], assignedAreas = []) {
    const event = await Event.findById(eventId);
    if (!event) throw new AppError('Event not found', 404);

    if (!this.canManageEvent(event, userId)) {
      throw new AppError('Not authorized to manage event staff', 403);
    }

    event.addStaff(staffId, role, permissions, assignedAreas);
    await event.save();
    return event;
  }

  async removeStaff(eventId, userId, staffId) {
    const event = await Event.findById(eventId);
    if (!event) throw new AppError('Event not found', 404);

    if (!this.canManageEvent(event, userId)) {
      throw new AppError('Not authorized to manage event staff', 403);
    }

    event.removeStaff(staffId);
    await event.save();
    return event;
  }

  async registerAttendee(eventId, userId) {
    const event = await Event.findById(eventId);
    if (!event) throw new AppError('Event not found', 404);

    const alreadyRegistered = event.attendees.some((attendee) => attendee.user.toString() === userId.toString());
    if (!alreadyRegistered) {
      event.addAttendee(userId);
      await event.save();
    }
    return this.serializeEvent(event);
  }

  async checkInAttendee(eventId, attendeeId) {
    const event = await Event.findById(eventId);
    if (!event) throw new AppError('Event not found', 404);

    event.checkInAttendee(attendeeId);
    await event.save();
    return event;
  }

  async checkOutAttendee(eventId, attendeeId) {
    const event = await Event.findById(eventId);
    if (!event) throw new AppError('Event not found', 404);

    event.checkOutAttendee(attendeeId);
    await event.save();
    return event;
  }

  async getEventStatistics(eventId, userId, role = null) {
    if (!eventId) {
      const visibleQuery = this.buildVisibilityQuery(userId, role);
      const [total, active, upcoming, completed, events] = await Promise.all([
        Event.countDocuments(visibleQuery),
        Event.countDocuments({ ...visibleQuery, status: { $in: ['active', 'ongoing', 'published'] } }),
        Event.countDocuments({ ...visibleQuery, 'schedule.startDate': { $gt: new Date() } }),
        Event.countDocuments({ ...visibleQuery, status: 'completed' }),
        Event.find(visibleQuery).select('statistics venue attendees'),
      ]);

      return {
        total,
        active,
        upcoming,
        completed,
        checkedIn: events.reduce((sum, event) => sum + (event.statistics?.checkedIn || 0), 0),
        totalAttendees: events.reduce((sum, event) => sum + (event.statistics?.totalAttendees || event.attendees?.length || 0), 0),
        capacity: events.reduce((sum, event) => sum + (event.venue?.capacity || 0), 0),
      };
    }

    const event = await Event.findById(eventId).select('organizer staff attendees statistics venue schedule status');
    if (!event) throw new AppError('Event not found', 404);

    if (!this.canViewEvent(event, userId, role)) {
      throw new AppError('Not authorized to view this event', 403);
    }

    event.updateStatistics();
    return {
      statistics: event.statistics,
      capacity: event.venue.capacity,
      status: event.status,
      schedule: event.schedule,
      attendanceRate: event.attendanceRate,
      occupancyRate: event.occupancyRate,
    };
  }
}

module.exports = new EventService();
