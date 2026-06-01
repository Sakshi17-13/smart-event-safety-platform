const familyService = require('../services/family.service');
const socketManager = require('../sockets/socket.manager');
const logger = require('../utils/logger');

class FamilyController {
  async browseNearbyEvents(req, res, next) {
    try {
      const events = await familyService.browseNearbyEvents(req.query);
      res.status(200).json({ success: true, message: 'Nearby events retrieved successfully', data: events });
    } catch (error) {
      next(error);
    }
  }

  async registerEvent(req, res, next) {
    try {
      const group = await familyService.registerEvent(req.user.userId, req.params.eventId);
      const payload = {
        eventId: String(group.event || req.params.eventId),
        eventName: group.eventName,
        userId: req.user.userId,
        groupId: String(group._id),
        familyGroupId: String(group._id),
        familyCode: group.code,
        familyGroupLabel: `Family ${String(group._id).slice(-4)}`,
        familyCount: group.familyCount,
        activeFamilies: group.activeFamilies,
        attendeeCount: group.attendeeCount,
        memberCount: group.memberCount,
        linkedDevices: group.linkedDevices,
        metrics: group.metrics,
        eventSummary: group.eventSummary,
        timestamp: new Date().toISOString(),
      };

      socketManager.sendToUser(req.user.userId, 'FAMILY_REGISTERED', payload);
      socketManager.sendToUser(req.user.userId, 'FAMILY_JOINED_EVENT', payload);
      socketManager.broadcastToEvent(payload.eventId, 'FAMILY_REGISTERED', payload);
      socketManager.broadcastToEvent(payload.eventId, 'FAMILY_JOINED_EVENT', payload);
      socketManager.broadcastToOrganizer(payload.eventId, 'ORGANIZER_FAMILY_REGISTERED', {
        ...payload,
        userId: undefined,
      });
      socketManager.broadcastToOrganizer(payload.eventId, 'FAMILY_JOINED_EVENT', {
        ...payload,
        userId: undefined,
      });
      if (group.eventSummary) {
        socketManager.broadcastToEvent(payload.eventId, 'EVENT_UPDATED', group.eventSummary);
        socketManager.broadcastToOrganizer(payload.eventId, 'EVENT_UPDATED', group.eventSummary);
        socketManager.broadcastToEventDirectory('EVENT_UPDATED', group.eventSummary);
      }

      res.status(200).json({ success: true, message: 'Registered for event successfully', data: group });
    } catch (error) {
      next(error);
    }
  }

  async createFamilyGroup(req, res, next) {
    try {
      const group = await familyService.createFamilyGroup(req.user.userId, req.body);
      const plainGroup = typeof group.toObject === 'function' ? group.toObject() : group;
      const payload = {
        ...plainGroup,
        groupId: String(group._id),
        familyGroupId: String(group._id),
        eventId: group.event ? String(group.event) : undefined,
        timestamp: new Date().toISOString(),
      };
      if (payload.eventId) {
        const metrics = await familyService.getFamilyMetrics(payload.eventId);
        payload.metrics = metrics;
        payload.familyCount = metrics.familyCount;
        payload.activeFamilies = metrics.activeFamilies;
        payload.attendeeCount = metrics.attendeeCount;
        payload.memberCount = metrics.memberCount;
        payload.linkedDevices = metrics.linkedDevices;
        payload.eventSummary = metrics.eventSummary;
      }
      logger.info('Family group created', { groupId: group._id, userId: req.user.userId });
      socketManager.sendToUser(req.user.userId, 'FAMILY_GROUP_CREATED', payload);
      socketManager.sendToUser(req.user.userId, 'FAMILY_CREATED', payload);
      if (group.event) {
        socketManager.broadcastToEvent(String(group.event), 'FAMILY_GROUP_CREATED', payload);
        socketManager.broadcastToEvent(String(group.event), 'FAMILY_CREATED', payload);
        socketManager.broadcastToOrganizer(String(group.event), 'ORGANIZER_FAMILY_REGISTERED', {
          ...payload,
          userId: undefined,
          familyGroupLabel: `Family ${String(group._id).slice(-4)}`,
        });
        socketManager.broadcastToOrganizer(String(group.event), 'FAMILY_CREATED', {
          ...payload,
          userId: undefined,
          familyGroupLabel: `Family ${String(group._id).slice(-4)}`,
        });
        if (payload.eventSummary) {
          socketManager.broadcastToEvent(payload.eventId, 'EVENT_UPDATED', payload.eventSummary);
          socketManager.broadcastToOrganizer(payload.eventId, 'EVENT_UPDATED', payload.eventSummary);
          socketManager.broadcastToEventDirectory('EVENT_UPDATED', payload.eventSummary);
        }
      }
      res.status(201).json({ success: true, message: 'Family group created successfully', data: group });
    } catch (error) {
      next(error);
    }
  }

  async getMyFamilyGroups(req, res, next) {
    try {
      const groups = await familyService.getMyFamilyGroups(req.user.userId);
      res.status(200).json({ success: true, message: 'Family groups retrieved successfully', data: groups });
    } catch (error) {
      next(error);
    }
  }

  async updateFamilyGroup(req, res, next) {
    try {
      const group = await familyService.updateFamilyGroup(req.user.userId, req.params.groupId, req.body);
      const payload = {
        groupId: String(group._id),
        familyGroupId: String(group._id),
        eventId: group.event ? String(group.event) : undefined,
        geofenceSettings: group.geofenceSettings,
        timestamp: new Date().toISOString(),
      };
      socketManager.broadcastToFamily(payload.familyGroupId, 'FAMILY_GROUP_UPDATED', payload);
      if (payload.eventId) socketManager.broadcastToOrganizer(payload.eventId, 'FAMILY_GROUP_UPDATED', payload);
      res.status(200).json({ success: true, message: 'Family group updated successfully', data: group });
    } catch (error) {
      next(error);
    }
  }

  async deleteFamilyGroup(req, res, next) {
    try {
      const result = await familyService.deleteFamilyGroup(req.user.userId, req.params.groupId);
      const payload = {
        groupId: String(result.groupId),
        familyGroupId: String(result.groupId),
        eventId: result.eventId ? String(result.eventId) : undefined,
        deviceIds: result.deviceIds,
        timestamp: new Date().toISOString(),
      };
      socketManager.broadcastToFamily(payload.familyGroupId, 'FAMILY_GROUP_DELETED', payload);
      if (payload.eventId) {
        socketManager.broadcastToEvent(payload.eventId, 'FAMILY_GROUP_DELETED', payload);
        socketManager.broadcastToOrganizer(payload.eventId, 'FAMILY_GROUP_DELETED', payload);
      }
      res.status(200).json({ success: true, message: 'Family group deleted successfully', data: payload });
    } catch (error) {
      next(error);
    }
  }

  async addChildMember(req, res, next) {
    try {
      const group = await familyService.addChildMember(req.user.userId, req.params.groupId, req.body);
      const payload = {
        groupId: String(group._id),
        familyGroupId: String(group._id),
        eventId: group.event ? String(group.event) : undefined,
        timestamp: new Date().toISOString(),
      };
      if (payload.eventId) {
        const metrics = await familyService.getFamilyMetrics(payload.eventId);
        payload.metrics = metrics;
        payload.familyCount = metrics.familyCount;
        payload.activeFamilies = metrics.activeFamilies;
        payload.attendeeCount = metrics.attendeeCount;
        payload.memberCount = metrics.memberCount;
        payload.linkedDevices = metrics.linkedDevices;
      }
      socketManager.broadcastToFamily(payload.familyGroupId, 'FAMILY_MEMBER_ADDED', payload);
      socketManager.broadcastToFamily(payload.familyGroupId, 'MEMBER_ADDED', payload);
      if (payload.eventId) {
        socketManager.broadcastToEvent(payload.eventId, 'MEMBER_ADDED', payload);
        socketManager.broadcastToOrganizer(payload.eventId, 'FAMILY_MEMBER_ADDED', payload);
        socketManager.broadcastToOrganizer(payload.eventId, 'MEMBER_ADDED', payload);
      }
      res.status(200).json({ success: true, message: 'Child member added successfully', data: group });
    } catch (error) {
      next(error);
    }
  }

  async updateChildMember(req, res, next) {
    try {
      const group = await familyService.updateChildMember(req.user.userId, req.params.groupId, req.params.childMemberId, req.body);
      const payload = {
        groupId: String(group._id),
        familyGroupId: String(group._id),
        eventId: group.event ? String(group.event) : undefined,
        childMemberId: String(req.params.childMemberId),
        timestamp: new Date().toISOString(),
      };
      socketManager.broadcastToFamily(payload.familyGroupId, 'FAMILY_MEMBER_UPDATED', payload);
      if (payload.eventId) socketManager.broadcastToOrganizer(payload.eventId, 'FAMILY_MEMBER_UPDATED', payload);
      res.status(200).json({ success: true, message: 'Child member updated successfully', data: group });
    } catch (error) {
      next(error);
    }
  }

  async removeChildMember(req, res, next) {
    try {
      const result = await familyService.removeChildMember(req.user.userId, req.params.groupId, req.params.childMemberId);
      const payload = {
        groupId: String(result.group._id),
        familyGroupId: String(result.group._id),
        eventId: result.group.event ? String(result.group.event) : undefined,
        childMemberId: String(result.removedChildId),
        deviceId: result.deviceId,
        timestamp: new Date().toISOString(),
      };
      socketManager.broadcastToFamily(payload.familyGroupId, 'FAMILY_MEMBER_REMOVED', payload);
      if (payload.eventId) {
        socketManager.broadcastToEvent(payload.eventId, 'FAMILY_MEMBER_REMOVED', payload);
        socketManager.broadcastToOrganizer(payload.eventId, 'FAMILY_MEMBER_REMOVED', payload);
      }
      res.status(200).json({ success: true, message: 'Child member removed successfully', data: payload });
    } catch (error) {
      next(error);
    }
  }

  async addGuardian(req, res, next) {
    try {
      const group = await familyService.addGuardian(req.user.userId, req.params.groupId, req.body);
      const payload = {
        groupId: String(group._id),
        familyGroupId: String(group._id),
        eventId: group.event ? String(group.event) : undefined,
        memberType: 'guardian',
        timestamp: new Date().toISOString(),
      };
      if (payload.eventId) {
        const metrics = await familyService.getFamilyMetrics(payload.eventId);
        payload.metrics = metrics;
        payload.familyCount = metrics.familyCount;
        payload.activeFamilies = metrics.activeFamilies;
        payload.attendeeCount = metrics.attendeeCount;
        payload.memberCount = metrics.memberCount;
        payload.linkedDevices = metrics.linkedDevices;
      }
      socketManager.broadcastToFamily(payload.familyGroupId, 'FAMILY_MEMBER_ADDED', payload);
      socketManager.broadcastToFamily(payload.familyGroupId, 'MEMBER_ADDED', payload);
      if (payload.eventId) {
        socketManager.broadcastToEvent(payload.eventId, 'MEMBER_ADDED', payload);
        socketManager.broadcastToOrganizer(payload.eventId, 'FAMILY_MEMBER_ADDED', payload);
        socketManager.broadcastToOrganizer(payload.eventId, 'MEMBER_ADDED', payload);
      }
      res.status(200).json({ success: true, message: 'Guardian added successfully', data: group });
    } catch (error) {
      next(error);
    }
  }

  async updateGuardian(req, res, next) {
    try {
      const group = await familyService.updateGuardian(req.user.userId, req.params.groupId, req.params.guardianId, req.body);
      res.status(200).json({ success: true, message: 'Guardian updated successfully', data: group });
    } catch (error) {
      next(error);
    }
  }

  async removeGuardian(req, res, next) {
    try {
      const result = await familyService.removeGuardian(req.user.userId, req.params.groupId, req.params.guardianId);
      const payload = {
        groupId: String(result.group._id),
        familyGroupId: String(result.group._id),
        eventId: result.group.event ? String(result.group.event) : undefined,
        guardianId: String(result.removedGuardianId),
        timestamp: new Date().toISOString(),
      };
      socketManager.broadcastToFamily(payload.familyGroupId, 'FAMILY_GUARDIAN_REMOVED', payload);
      if (payload.eventId) socketManager.broadcastToOrganizer(payload.eventId, 'FAMILY_GUARDIAN_REMOVED', payload);
      res.status(200).json({ success: true, message: 'Guardian removed successfully', data: payload });
    } catch (error) {
      next(error);
    }
  }

  async generatePairingCode(req, res, next) {
    try {
      const pairing = await familyService.generatePairingCode(req.user.userId, req.params.groupId, req.params.childMemberId);
      res.status(201).json({ success: true, message: 'Pairing code generated successfully', data: pairing });
    } catch (error) {
      next(error);
    }
  }

  async confirmPairing(req, res, next) {
    try {
      const result = await familyService.confirmPairing(
        req.body.familyCode,
        req.body.pairCode,
        req.body.deviceId,
        {
          deviceType: req.body.deviceType,
          deviceLabel: req.body.deviceLabel,
          batteryLevel: req.body.batteryLevel,
          signalStatus: req.body.signalStatus,
        }
      );
      const payload = {
        ...result,
        groupId: String(result.groupId),
        familyGroupId: String(result.groupId),
        eventId: result.eventId ? String(result.eventId) : undefined,
        childMemberId: String(result.childMemberId),
        timestamp: new Date().toISOString(),
      };
      if (payload.eventId) {
        const metrics = await familyService.getFamilyMetrics(payload.eventId);
        payload.metrics = metrics;
        payload.familyCount = metrics.familyCount;
        payload.activeFamilies = metrics.activeFamilies;
        payload.attendeeCount = metrics.attendeeCount;
        payload.memberCount = metrics.memberCount;
        payload.linkedDevices = metrics.linkedDevices;
      }
      socketManager.broadcastToFamily(payload.familyGroupId, 'DEVICE_PAIRED', payload);
      socketManager.broadcastToFamily(payload.familyGroupId, 'device:connected', payload);
      socketManager.broadcastToFamily(payload.familyGroupId, 'DEVICE_STATUS_UPDATED', {
        ...payload,
        status: 'connected',
        batteryLevel: payload.batteryLevel,
        signalStatus: payload.signalStatus || 'strong',
        lastSeenAt: payload.lastSeenAt || payload.timestamp,
      });
      if (payload.eventId) {
        socketManager.broadcastToEvent(payload.eventId, 'DEVICE_PAIRED', payload);
        socketManager.broadcastToEvent(payload.eventId, 'device:connected', payload);
        socketManager.broadcastToOrganizer(payload.eventId, 'device:connected', {
          ...payload,
          childName: undefined,
          familyName: undefined,
        });
        socketManager.broadcastToOrganizer(payload.eventId, 'DEVICE_PAIRED', {
          ...payload,
          childName: undefined,
          familyName: undefined,
        });
      }
      res.status(200).json({ success: true, message: 'Device paired successfully', data: result });
    } catch (error) {
      next(error);
    }
  }

  async updateDeviceLocation(req, res, next) {
    try {
      const result = await familyService.updateDeviceLocation(req.params.deviceId, req.body);
      const payload = {
        eventId: result.eventId ? String(result.eventId) : undefined,
        familyGroupId: String(result.groupId),
        groupId: String(result.groupId),
        childMemberId: String(result.childMemberId),
        deviceId: result.deviceId,
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        location: { latitude: req.body.latitude, longitude: req.body.longitude },
        battery: req.body.battery ?? req.body.batteryLevel,
        signal: req.body.signal || req.body.signalStatus,
        batteryLevel: req.body.batteryLevel ?? req.body.battery,
        signalStatus: req.body.signalStatus || req.body.signal,
        geofenceStatus: result.child?.geofenceStatus,
        trackingState: result.trackingState,
        trackingLabel: result.trackingLabel,
        privacyBoundary: result.privacyBoundary,
        sessionStatus: result.sessionStatus,
        trackingPaused: result.trackingPaused,
        timestamp: new Date().toISOString(),
      };
      socketManager.broadcastToFamily(payload.familyGroupId, 'DEVICE_LOCATION_UPDATED', payload);
      socketManager.broadcastToFamily(payload.familyGroupId, 'TRACKING_PRIVACY_BOUNDARY', payload);
      if (payload.trackingPaused) {
        socketManager.broadcastToFamily(payload.familyGroupId, 'DEVICE_TRACKING_PAUSED', payload);
        socketManager.broadcastToFamily(payload.familyGroupId, 'DEVICE_DISCONNECTED', payload);
      }
      if (payload.eventId) {
        socketManager.broadcastToEvent(payload.eventId, 'DEVICE_LOCATION_UPDATED', payload);
        socketManager.broadcastToOrganizer(payload.eventId, payload.trackingPaused ? 'DEVICE_TRACKING_PAUSED' : 'ORGANIZER_DEVICE_LOCATION_UPDATE', {
          ...payload,
          childMemberId: undefined,
          deviceId: undefined,
          familyGroupLabel: `Family ${payload.familyGroupId.slice(-4)}`,
        });
      }
      res.status(200).json({ success: true, message: 'Device location updated successfully', data: result });
    } catch (error) {
      next(error);
    }
  }

  async getOrganizerFamilySummary(req, res, next) {
    try {
      const groups = await familyService.getOrganizerFamilySummary(req.params.eventId, req.query.emergency === 'true');
      res.status(200).json({ success: true, message: 'Family group summary retrieved successfully', data: groups });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new FamilyController();
