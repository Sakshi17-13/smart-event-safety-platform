const { Server } = require('socket.io');
const socketAuth = require('../middleware/socket.auth.middleware');
const logger = require('../utils/logger');
const { Event, FamilyGroup, User, DeviceTracking, Alert, IncidentLog } = require('../models');
const { createSocketCorsOptions } = require('../config/cors.config');

class SocketManager {
  constructor() {
    this.io = null;
    this.userSockets = new Map();
    this.eventRooms = new Map();
    this.familyRooms = new Map();
    this.organizerRooms = new Map();
  }

  initialize(server) {
    if (this.io) {
      logger.warn('Socket.io server already initialized');
      return this.io;
    }

    this.io = new Server(server, {
      cors: createSocketCorsOptions(),
      pingTimeout: 60000,
      pingInterval: 25000,
      transports: ['websocket', 'polling'],
    });

    this.io.use(socketAuth.authenticate.bind(socketAuth));

    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    logger.info('Socket.io server initialized', {
      transports: ['websocket', 'polling'],
      environment: process.env.NODE_ENV || 'development',
    });

    return this.io;
  }

  handleConnection(socket) {
    const userId = socket.user.userId;
    const role = socket.user.role;

    logger.info('Socket connected', { socketId: socket.id, userId, role });

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId).add(socket);
    socket.join('events:directory');

    socket.on('JOIN_EVENT', (data) => this.handleJoinEvent(socket, data));
    socket.on('JOIN_FAMILY', (data) => this.handleJoinFamily(socket, data));
    socket.on('JOIN_ORGANIZER', (data) => this.handleJoinOrganizer(socket, data));
    socket.on('JOIN_DEVICE_ROOMS', (data) => this.handleJoinDeviceRooms(socket, data));
    socket.on('LEAVE_EVENT', (data) => this.handleLeaveEvent(socket, data));
    socket.on('LEAVE_FAMILY', (data) => this.handleLeaveFamily(socket, data));
    socket.on('LEAVE_ORGANIZER', (data) => this.handleLeaveOrganizer(socket, data));
    socket.on('LOCATION_UPDATE', (data) => this.handleLocationUpdate(socket, data));
    socket.on('DEVICE_LOCATION_UPDATE', (data) => this.handleDeviceLocationUpdate(socket, data));
    socket.on('DEVICE_HEARTBEAT', (data) => this.handleDeviceHeartbeat(socket, data));
    socket.on('SOS_TRIGGERED', (data) => this.handleSOSTriggered(socket, data));
    socket.on('GEOFENCE_BREACH', (data) => this.handleGeofenceBreach(socket, data));
    socket.on('INCIDENT_CREATED', (data) => this.handleIncidentCreated(socket, data));
    socket.on('ALERT_ACKNOWLEDGED', (data) => this.handleAlertAcknowledged(socket, data));
    socket.on('disconnect', () => this.handleDisconnect(socket));

    socket.emit('CONNECTED', {
      socketId: socket.id,
      userId,
      role,
      timestamp: new Date().toISOString(),
    });
  }

  handleJoinDeviceRooms(socket, data) {
    try {
      const { eventId, familyGroupId, deviceId } = data;
      const joinedRooms = [];

      if (deviceId) {
        socket.join(`device:${deviceId}`);
        joinedRooms.push(`device:${deviceId}`);
      }

      if (familyGroupId) {
        socket.join(`family:${familyGroupId}`);
        joinedRooms.push(`family:${familyGroupId}`);
      }

      if (eventId) {
        socket.join(`event:${eventId}`);
        socket.join(`organizer:${eventId}`);
        joinedRooms.push(`event:${eventId}`, `organizer:${eventId}`);
      }

      socket.emit('JOINED_DEVICE_ROOMS', {
        deviceId,
        eventId,
        familyGroupId,
        rooms: joinedRooms,
        timestamp: new Date().toISOString(),
      });

      logger.info('Device joined realtime rooms', {
        socketId: socket.id,
        deviceId,
        eventId,
        familyGroupId,
      });
    } catch (error) {
      logger.error('Error joining device rooms:', error);
      socket.emit('ERROR', { message: 'Failed to join device rooms' });
    }
  }

  async touchDeviceActivity({ deviceId, timestamp, batteryLevel, signalStatus }) {
    if (!deviceId) return;
    const group = await FamilyGroup.findOne({ 'childMembers.wearableDeviceId': deviceId });
    if (!group) return;

    const child = group.childMembers.find((item) => item.wearableDeviceId === deviceId);
    if (!child) return;

    child.lastSeenAt = new Date(timestamp);
    child.deviceStatus = 'paired';
    child.connected = true;
    child.paired = true;
    if (batteryLevel !== undefined) child.batteryLevel = batteryLevel;
    if (signalStatus) child.signalStatus = signalStatus;
    await group.save();
  }

  async handleJoinEvent(socket, data) {
    try {
      const { eventId } = data;
      const userId = socket.user.userId;
      const role = socket.user.role;

      if (process.env.DEV_ALLOW_NO_DB === 'true' && Event.db.readyState !== 1) {
        const roomName = `event:${eventId}`;
        socket.join(roomName);
        socket.emit('JOINED_EVENT', {
          eventId,
          roomName,
          timestamp: new Date().toISOString(),
        });
        logger.warn('Joined event room without DB validation in development fallback', { socketId: socket.id, userId, eventId });
        return;
      }

      const event = await Event.findById(eventId);
      if (!event) {
        socket.emit('ERROR', { message: 'Event not found' });
        return;
      }

      const isAttendee = event.attendees.some((a) => a.user.toString() === userId);
      const isStaff = event.staff.some((s) => s.user.toString() === userId);
      const isOrganizer = event.organizer.toString() === userId;

      if (role !== 'SUPER_ADMIN' && !isAttendee && !isStaff && !isOrganizer) {
        socket.emit('ERROR', { message: 'Not authorized to join this event' });
        return;
      }

      const roomName = `event:${eventId}`;
      socket.join(roomName);

      if (!this.eventRooms.has(eventId)) {
        this.eventRooms.set(eventId, new Set());
      }
      this.eventRooms.get(eventId).add(userId);

      socket.emit('JOINED_EVENT', {
        eventId,
        roomName,
        timestamp: new Date().toISOString(),
      });

      this.io.to(roomName).emit('USER_JOINED_EVENT', {
        userId,
        firstName: socket.user.firstName,
        lastName: socket.user.lastName,
        role: socket.user.role,
        timestamp: new Date().toISOString(),
      });

      logger.info('User joined event room', { socketId: socket.id, userId, eventId });
    } catch (error) {
      logger.error('Error joining event room:', error);
      socket.emit('ERROR', { message: 'Failed to join event room' });
    }
  }

  async handleJoinFamily(socket, data) {
    try {
      const { familyGroupId } = data;
      const userId = socket.user.userId;

      if (process.env.DEV_ALLOW_NO_DB === 'true' && FamilyGroup.db.readyState !== 1) {
        const roomName = `family:${familyGroupId}`;
        socket.join(roomName);

        if (!this.familyRooms.has(familyGroupId)) {
          this.familyRooms.set(familyGroupId, new Set());
        }
        this.familyRooms.get(familyGroupId).add(userId);

        socket.emit('JOINED_FAMILY', {
          familyGroupId,
          roomName,
          timestamp: new Date().toISOString(),
        });

        logger.warn('Joined family room without DB validation in development fallback', { socketId: socket.id, userId, familyGroupId });
        return;
      }

      const familyGroup = await FamilyGroup.findById(familyGroupId);
      if (!familyGroup) {
        socket.emit('ERROR', { message: 'Family group not found' });
        return;
      }

      const isMember = familyGroup.members.some((m) => m.user.toString() === userId);
      if (!isMember) {
        socket.emit('ERROR', { message: 'Not a member of this family group' });
        return;
      }

      const roomName = `family:${familyGroupId}`;
      socket.join(roomName);

      if (!this.familyRooms.has(familyGroupId)) {
        this.familyRooms.set(familyGroupId, new Set());
      }
      this.familyRooms.get(familyGroupId).add(userId);

      socket.emit('JOINED_FAMILY', {
        familyGroupId,
        roomName,
        timestamp: new Date().toISOString(),
      });

      this.io.to(roomName).emit('USER_JOINED_FAMILY', {
        userId,
        firstName: socket.user.firstName,
        lastName: socket.user.lastName,
        role: socket.user.role,
        timestamp: new Date().toISOString(),
      });

      logger.info('User joined family room', { socketId: socket.id, userId, familyGroupId });
    } catch (error) {
      logger.error('Error joining family room:', error);
      socket.emit('ERROR', { message: 'Failed to join family room' });
    }
  }

  async handleJoinOrganizer(socket, data) {
    try {
      const { eventId } = data;
      const userId = socket.user.userId;
      const role = socket.user.role;

      if (role !== 'SUPER_ADMIN' && role !== 'EVENT_ORGANIZER') {
        socket.emit('ERROR', { message: 'Not authorized to join organizer room' });
        return;
      }

      if (process.env.DEV_ALLOW_NO_DB === 'true' && Event.db.readyState !== 1) {
        const roomName = `organizer:${eventId}`;
        socket.join(roomName);

        if (!this.organizerRooms.has(eventId)) {
          this.organizerRooms.set(eventId, new Set());
        }
        this.organizerRooms.get(eventId).add(userId);

        socket.emit('JOINED_ORGANIZER', {
          eventId,
          roomName,
          timestamp: new Date().toISOString(),
        });

        logger.warn('Joined organizer room without DB validation in development fallback', { socketId: socket.id, userId, eventId });
        return;
      }

      const event = await Event.findById(eventId);
      if (!event) {
        socket.emit('ERROR', { message: 'Event not found' });
        return;
      }

      const isOrganizer = event.organizer.toString() === userId;
      const isStaff = event.staff.some((s) => s.user.toString() === userId);

      if (role !== 'SUPER_ADMIN' && !isOrganizer && !isStaff) {
        socket.emit('ERROR', { message: 'Not authorized to join organizer room' });
        return;
      }

      const roomName = `organizer:${eventId}`;
      socket.join(roomName);

      if (!this.organizerRooms.has(eventId)) {
        this.organizerRooms.set(eventId, new Set());
      }
      this.organizerRooms.get(eventId).add(userId);

      socket.emit('JOINED_ORGANIZER', {
        eventId,
        roomName,
        timestamp: new Date().toISOString(),
      });

      logger.info('User joined organizer room', { socketId: socket.id, userId, eventId });
    } catch (error) {
      logger.error('Error joining organizer room:', error);
      socket.emit('ERROR', { message: 'Failed to join organizer room' });
    }
  }

  handleLeaveEvent(socket, data) {
    try {
      const { eventId } = data;
      const userId = socket.user.userId;

      const roomName = `event:${eventId}`;
      socket.leave(roomName);

      if (this.eventRooms.has(eventId)) {
        this.eventRooms.get(eventId).delete(userId);
      }

      socket.emit('LEFT_EVENT', {
        eventId,
        timestamp: new Date().toISOString(),
      });

      this.io.to(roomName).emit('USER_LEFT_EVENT', {
        userId,
        timestamp: new Date().toISOString(),
      });

      logger.info('User left event room', { socketId: socket.id, userId, eventId });
    } catch (error) {
      logger.error('Error leaving event room:', error);
    }
  }

  handleLeaveFamily(socket, data) {
    try {
      const { familyGroupId } = data;
      const userId = socket.user.userId;

      const roomName = `family:${familyGroupId}`;
      socket.leave(roomName);

      if (this.familyRooms.has(familyGroupId)) {
        this.familyRooms.get(familyGroupId).delete(userId);
      }

      socket.emit('LEFT_FAMILY', {
        familyGroupId,
        timestamp: new Date().toISOString(),
      });

      this.io.to(roomName).emit('USER_LEFT_FAMILY', {
        userId,
        timestamp: new Date().toISOString(),
      });

      logger.info('User left family room', { socketId: socket.id, userId, familyGroupId });
    } catch (error) {
      logger.error('Error leaving family room:', error);
    }
  }

  handleLeaveOrganizer(socket, data) {
    try {
      const { eventId } = data;
      const userId = socket.user.userId;

      const roomName = `organizer:${eventId}`;
      socket.leave(roomName);

      if (this.organizerRooms.has(eventId)) {
        this.organizerRooms.get(eventId).delete(userId);
      }

      socket.emit('LEFT_ORGANIZER', {
        eventId,
        timestamp: new Date().toISOString(),
      });

      logger.info('User left organizer room', { socketId: socket.id, userId, eventId });
    } catch (error) {
      logger.error('Error leaving organizer room:', error);
    }
  }

  async handleLocationUpdate(socket, data) {
    try {
      const { eventId, location, accuracy, altitude, heading, speed, battery, network, activity } = data;
      const userId = socket.user.userId;

      const deviceTracking = await DeviceTracking.create({
        user: userId,
        event: eventId,
        deviceInfo: {
          deviceId: socket.id,
          deviceType: 'web',
        },
        location: {
          type: 'Point',
          coordinates: [location.longitude, location.latitude],
          accuracy,
          altitude,
          heading,
          speed,
        },
        battery,
        network,
        activity,
        status: 'active',
      });

      const roomName = `event:${eventId}`;
      this.io.to(roomName).emit('LOCATION_UPDATED', {
        userId,
        firstName: socket.user.firstName,
        lastName: socket.user.lastName,
        location,
        accuracy,
        altitude,
        heading,
        speed,
        battery,
        timestamp: new Date().toISOString(),
      });

      const organizerRoomName = `organizer:${eventId}`;
      this.io.to(organizerRoomName).emit('ORGANIZER_LOCATION_UPDATE', {
        userId,
        firstName: socket.user.firstName,
        lastName: socket.user.lastName,
        location,
        accuracy,
        battery,
        timestamp: new Date().toISOString(),
      });

      logger.debug('Location update broadcasted', { userId, eventId });
    } catch (error) {
      logger.error('Error handling location update:', error);
    }
  }

  async handleDeviceLocationUpdate(socket, data) {
    try {
      const { eventId, familyGroupId, memberId, childMemberId, deviceId, latitude, longitude, location, accuracy, battery, signal, batteryLevel, signalStatus, geofenceStatus, geofenceState, distanceMeters, zone, sosActive, deviceSession, trackingState, trackingLabel, privacyBoundary, sessionStatus, trackingPaused } = data;
      const timestamp = data.timestamp || new Date().toISOString();
      const resolvedMemberId = childMemberId || memberId;
      const resolvedLocation = location || (
        Number.isFinite(latitude) && Number.isFinite(longitude)
          ? { latitude, longitude }
          : undefined
      );
      const resolvedBattery = batteryLevel ?? battery;
      const resolvedSignal = signalStatus || signal;
      const payload = {
        eventId,
        familyGroupId,
        memberId: resolvedMemberId,
        childMemberId: resolvedMemberId,
        deviceId,
        latitude: resolvedLocation?.latitude,
        longitude: resolvedLocation?.longitude,
        location: resolvedLocation,
        accuracy,
        battery: resolvedBattery,
        signal: resolvedSignal,
        batteryLevel: resolvedBattery,
        signalStatus: resolvedSignal,
        geofenceStatus,
        geofenceState,
        distanceMeters,
        zone,
        deviceSession,
        trackingState,
        trackingLabel,
        privacyBoundary,
        sessionStatus,
        trackingPaused: Boolean(trackingPaused),
        sosActive: Boolean(sosActive),
        timestamp,
      };

      if (!trackingPaused) {
        await this.touchDeviceActivity({ deviceId, timestamp, batteryLevel: resolvedBattery, signalStatus: resolvedSignal });
      }

      if (familyGroupId) {
        this.io.to(`family:${familyGroupId}`).emit('DEVICE_LOCATION_UPDATED', payload);
        this.io.to(`family:${familyGroupId}`).emit('child-location-update', {
          childId: resolvedMemberId,
          deviceId,
          memberId: resolvedMemberId,
          latitude: resolvedLocation?.latitude,
          longitude: resolvedLocation?.longitude,
          lat: resolvedLocation?.latitude,
          lng: resolvedLocation?.longitude,
          accuracy,
          battery: resolvedBattery,
          signal: resolvedSignal,
          batteryLevel: resolvedBattery,
          geofenceStatus,
          geofenceState,
          distanceMeters,
          zone,
          signalStatus: resolvedSignal,
          deviceSession,
          trackingState,
          trackingLabel,
          privacyBoundary,
          sessionStatus,
          trackingPaused: Boolean(trackingPaused),
          timestamp,
        });
      }

      if (eventId) {
        this.io.to(`event:${eventId}`).emit('DEVICE_LOCATION_UPDATED', payload);
        this.io.to(`organizer:${eventId}`).emit('ORGANIZER_DEVICE_LOCATION_UPDATE', {
          eventId,
          familyGroupId,
          deviceId,
          memberId: resolvedMemberId,
          childMemberId: resolvedMemberId,
          latitude: resolvedLocation?.latitude,
          longitude: resolvedLocation?.longitude,
          location: resolvedLocation,
          battery: resolvedBattery,
          signal: resolvedSignal,
          batteryLevel: resolvedBattery,
          signalStatus: resolvedSignal,
          geofenceStatus,
          trackingState,
          trackingLabel,
          privacyBoundary,
          sessionStatus,
          trackingPaused: Boolean(trackingPaused),
          sosActive: Boolean(sosActive),
          timestamp,
        });
      }

      logger.debug('Device location update broadcasted', { deviceId, eventId, familyGroupId });
    } catch (error) {
      logger.error('Error handling device location update:', error);
      socket.emit('ERROR', { message: 'Failed to broadcast device location' });
    }
  }

  async handleDeviceHeartbeat(socket, data) {
    try {
      const { eventId, familyGroupId, childMemberId, deviceId, batteryLevel, signalStatus, deviceSession, reconnected } = data;
      const timestamp = new Date().toISOString();
      const payload = {
        eventId,
        familyGroupId,
        childMemberId,
        deviceId,
        batteryLevel,
        signalStatus,
        status: 'connected',
        deviceSession,
        lastSeenAt: timestamp,
        timestamp,
      };

      await this.touchDeviceActivity({ deviceId, timestamp, batteryLevel, signalStatus });

      if (familyGroupId) {
        this.io.to(`family:${familyGroupId}`).emit('DEVICE_STATUS_UPDATED', payload);
        if (reconnected) this.io.to(`family:${familyGroupId}`).emit('DEVICE_RECONNECTED', payload);
      }

      if (eventId) {
        this.io.to(`event:${eventId}`).emit('DEVICE_STATUS_UPDATED', payload);
        this.io.to(`organizer:${eventId}`).emit('DEVICE_STATUS_UPDATED', payload);
        if (reconnected) {
          this.io.to(`event:${eventId}`).emit('DEVICE_RECONNECTED', payload);
          this.io.to(`organizer:${eventId}`).emit('DEVICE_RECONNECTED', payload);
        }
      }
    } catch (error) {
      logger.error('Error handling device heartbeat:', error);
      socket.emit('ERROR', { message: 'Failed to update device heartbeat' });
    }
  }

  async handleSOSTriggered(socket, data) {
    try {
      const { eventId, location, message, severity } = data;
      const userId = socket.user.userId;

      const alert = await Alert.create({
        event: eventId,
        type: 'emergency',
        severity: severity || 'critical',
        title: 'SOS Alert',
        description: message || 'Emergency SOS triggered',
        source: {
          type: 'user',
          userId,
        },
        location: {
          type: 'Point',
          coordinates: [location.longitude, location.latitude],
        },
        status: 'active',
        notifications: {
          sent: true,
          sentAt: new Date(),
        },
      });

      const roomName = `event:${eventId}`;
      this.io.to(roomName).emit('SOS_ALERT', {
        alertId: alert._id,
        userId,
        firstName: socket.user.firstName,
        lastName: socket.user.lastName,
        location,
        message,
        severity,
        timestamp: new Date().toISOString(),
      });

      const organizerRoomName = `organizer:${eventId}`;
      this.io.to(organizerRoomName).emit('ORGANIZER_SOS_ALERT', {
        alertId: alert._id,
        userId,
        firstName: socket.user.firstName,
        lastName: socket.user.lastName,
        location,
        message,
        severity,
        timestamp: new Date().toISOString(),
      });

      logger.warn('SOS alert triggered', { userId, eventId, alertId: alert._id });
    } catch (error) {
      logger.error('Error handling SOS trigger:', error);
    }
  }

  async handleGeofenceBreach(socket, data) {
    try {
      const { eventId, geofenceId, geofenceName, breachType, location, severity } = data;
      const userId = socket.user.userId;

      const alert = await Alert.create({
        event: eventId,
        type: 'geofence',
        severity: severity || 'warning',
        title: `Geofence ${breachType}`,
        description: `User ${breachType} geofence: ${geofenceName}`,
        source: {
          type: 'system',
          userId,
        },
        location: {
          type: 'Point',
          coordinates: [location.longitude, location.latitude],
        },
        status: 'active',
        metadata: {
          geofenceId,
          geofenceName,
          triggeredBy: userId,
        },
        notifications: {
          sent: true,
          sentAt: new Date(),
        },
      });

      const roomName = `event:${eventId}`;
      this.io.to(roomName).emit('GEOFENCE_BREACH_ALERT', {
        alertId: alert._id,
        userId,
        firstName: socket.user.firstName,
        lastName: socket.user.lastName,
        geofenceId,
        geofenceName,
        breachType,
        location,
        severity,
        timestamp: new Date().toISOString(),
      });

      const organizerRoomName = `organizer:${eventId}`;
      this.io.to(organizerRoomName).emit('ORGANIZER_GEOFENCE_BREACH', {
        alertId: alert._id,
        userId,
        firstName: socket.user.firstName,
        lastName: socket.user.lastName,
        geofenceId,
        geofenceName,
        breachType,
        location,
        severity,
        timestamp: new Date().toISOString(),
      });

      logger.warn('Geofence breach detected', { userId, eventId, geofenceId, breachType });
    } catch (error) {
      logger.error('Error handling geofence breach:', error);
    }
  }

  async handleIncidentCreated(socket, data) {
    try {
      const { eventId, incidentId, type, severity, title, description, location } = data;
      const userId = socket.user.userId;

      const roomName = `event:${eventId}`;
      this.io.to(roomName).emit('INCIDENT_BROADCAST', {
        incidentId,
        userId,
        firstName: socket.user.firstName,
        lastName: socket.user.lastName,
        type,
        severity,
        title,
        description,
        location,
        timestamp: new Date().toISOString(),
      });

      const organizerRoomName = `organizer:${eventId}`;
      this.io.to(organizerRoomName).emit('ORGANIZER_INCIDENT', {
        incidentId,
        userId,
        firstName: socket.user.firstName,
        lastName: socket.user.lastName,
        type,
        severity,
        title,
        description,
        location,
        timestamp: new Date().toISOString(),
      });

      logger.warn('Incident broadcasted', { userId, eventId, incidentId, type });
    } catch (error) {
      logger.error('Error handling incident broadcast:', error);
    }
  }

  async handleAlertAcknowledged(socket, data) {
    try {
      const { alertId, eventId } = data;
      const userId = socket.user.userId;

      const alert = await Alert.findById(alertId);
      if (!alert) {
        socket.emit('ERROR', { message: 'Alert not found' });
        return;
      }

      alert.acknowledge(userId);
      await alert.save();

      const roomName = `event:${eventId}`;
      this.io.to(roomName).emit('ALERT_ACKNOWLEDGED', {
        alertId,
        userId,
        firstName: socket.user.firstName,
        lastName: socket.user.lastName,
        timestamp: new Date().toISOString(),
      });

      const organizerRoomName = `organizer:${eventId}`;
      this.io.to(organizerRoomName).emit('ORGANIZER_ALERT_ACKNOWLEDGED', {
        alertId,
        userId,
        firstName: socket.user.firstName,
        lastName: socket.user.lastName,
        timestamp: new Date().toISOString(),
      });

      logger.info('Alert acknowledged', { userId, alertId });
    } catch (error) {
      logger.error('Error handling alert acknowledgment:', error);
    }
  }

  handleDisconnect(socket) {
    const userId = socket.user.userId;

    const userSocketSet = this.userSockets.get(userId);
    if (userSocketSet) {
      userSocketSet.delete(socket);
      if (userSocketSet.size === 0) {
        this.userSockets.delete(userId);
      }
    }

    this.eventRooms.forEach((users, eventId) => {
      if (users.has(userId)) {
        users.delete(userId);
        const roomName = `event:${eventId}`;
        this.io.to(roomName).emit('USER_LEFT_EVENT', {
          userId,
          timestamp: new Date().toISOString(),
        });
      }
    });

    this.familyRooms.forEach((users, familyGroupId) => {
      if (users.has(userId)) {
        users.delete(userId);
        const roomName = `family:${familyGroupId}`;
        this.io.to(roomName).emit('USER_LEFT_FAMILY', {
          userId,
          timestamp: new Date().toISOString(),
        });
      }
    });

    this.organizerRooms.forEach((users, eventId) => {
      if (users.has(userId)) {
        users.delete(userId);
      }
    });

    logger.info('Socket disconnected', { socketId: socket.id, userId });
  }

  broadcastToEvent(eventId, event, data) {
    const roomName = `event:${eventId}`;
    this.io.to(roomName).emit(event, data);
  }

  broadcastToOrganizer(eventId, event, data) {
    const roomName = `organizer:${eventId}`;
    this.io.to(roomName).emit(event, data);
  }

  broadcastToFamily(familyGroupId, event, data) {
    const roomName = `family:${familyGroupId}`;
    this.io.to(roomName).emit(event, data);
  }

  broadcastToEventDirectory(event, data) {
    this.io.to('events:directory').emit(event, data);
  }

  sendToUser(userId, event, data) {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.forEach((socket) => socket.emit(event, data));
    }
  }

  getEventRoomSize(eventId) {
    const roomName = `event:${eventId}`;
    const room = this.io.sockets.adapter.rooms.get(roomName);
    return room ? room.size : 0;
  }

  getFamilyRoomSize(familyGroupId) {
    const roomName = `family:${familyGroupId}`;
    const room = this.io.sockets.adapter.rooms.get(roomName);
    return room ? room.size : 0;
  }

  getOrganizerRoomSize(eventId) {
    const roomName = `organizer:${eventId}`;
    const room = this.io.sockets.adapter.rooms.get(roomName);
    return room ? room.size : 0;
  }

  getConnectedUsers() {
    return Array.from(this.userSockets.values()).reduce((count, sockets) => count + sockets.size, 0);
  }
}

module.exports = new SocketManager();
