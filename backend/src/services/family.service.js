const mongoose = require('mongoose');
const { Event, FamilyGroup, DeviceTracking } = require('../models');
const { AppError } = require('../utils/errors');

const generateCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

const buildLeaderGuardian = (userId, data = {}) => ({
  user: userId,
  name: data.guardianName || data.name || 'Primary Guardian',
  relationship: 'guardian',
  role: 'leader',
  emergencyContact: true,
});

class FamilyService {
  buildEventSummary(event) {
    if (!event) return null;
    return {
      _id: event._id,
      name: event.name,
      description: event.description,
      status: event.status,
      category: event.category,
      venue: event.venue,
      schedule: event.schedule,
      statistics: event.statistics,
      location: event.venue?.name,
      capacity: event.venue?.capacity,
      date: event.schedule?.startDate,
      attendees: event.statistics?.totalAttendees || event.attendees?.length || 0,
      checkedIn: event.statistics?.checkedIn || 0,
    };
  }

  async getFamilyMetrics(eventId, event = null) {
    if (!eventId) {
      return {
        eventId: undefined,
        familyCount: 0,
        activeFamilies: 0,
        memberCount: 0,
        linkedDevices: 0,
        attendeeCount: 0,
        eventSummary: null,
      };
    }

    const [groups, eventDoc] = await Promise.all([
      FamilyGroup.find({ event: eventId, status: 'active' }).select('members guardians childMembers event status'),
      event || Event.findById(eventId),
    ]);

    const memberCount = groups.reduce((total, group) => (
      total + group.members.length + group.guardians.length + group.childMembers.length
    ), 0);
    const linkedDevices = groups.reduce((total, group) => (
      total + group.childMembers.filter((child) => child.deviceStatus === 'paired' || child.connected || child.paired).length
    ), 0);

    return {
      eventId: String(eventId),
      familyCount: groups.length,
      activeFamilies: groups.length,
      memberCount,
      linkedDevices,
      attendeeCount: eventDoc?.statistics?.totalAttendees || eventDoc?.attendees?.length || 0,
      eventSummary: this.buildEventSummary(eventDoc),
    };
  }

  async ensureFamilyEventRegistration(userId, eventId, group, event = null) {
    const eventDoc = event || await Event.findById(eventId);
    if (!eventDoc) throw new AppError('Event not found', 404);

    const attendee = eventDoc.attendees.find((item) => item.user.toString() === userId.toString());
    if (!attendee) {
      eventDoc.addAttendee(userId);
      const added = eventDoc.attendees.find((item) => item.user.toString() === userId.toString());
      if (added) added.familyGroupId = group._id;
    } else if (!attendee.familyGroupId) {
      attendee.familyGroupId = group._id;
    }

    await eventDoc.save();
    return eventDoc;
  }

  async browseNearbyEvents(filters = {}) {
    const query = {
      status: { $in: ['published', 'active', 'ongoing'] },
    };

    if (filters.search) {
      const search = new RegExp(String(filters.search), 'i');
      query.$or = [{ name: search }, { 'venue.name': search }, { category: search }];
    }

    return Event.find(query)
      .select('name description status category venue schedule statistics')
      .sort({ 'schedule.startDate': 1 })
      .limit(25);
  }

  async registerEvent(userId, eventId) {
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      throw new AppError('Invalid event id', 400);
    }

    const event = await Event.findById(eventId);
    if (!event) throw new AppError('Event not found', 404);

    let group = await FamilyGroup.findOne({
      leader: userId,
      event: eventId,
      status: 'active',
    });

    if (!group) {
      group = await FamilyGroup.create({
        name: 'My Family',
        leader: userId,
        event: eventId,
        members: [
          {
            user: userId,
            role: 'leader',
            relationship: 'other',
            emergencyContact: true,
          },
        ],
        guardians: [buildLeaderGuardian(userId)],
        childMembers: [],
      });
    }

    await this.ensureFamilyEventRegistration(userId, eventId, group, event);

    const metrics = await this.getFamilyMetrics(eventId, event);

    return {
      _id: group._id,
      code: group.code,
      name: group.name,
      event: group.event,
      eventName: event.name,
      eventSummary: metrics.eventSummary,
      leader: group.leader,
      members: group.members,
      childMembers: group.childMembers,
      familyCount: metrics.familyCount,
      activeFamilies: metrics.activeFamilies,
      memberCount: metrics.memberCount,
      linkedDevices: metrics.linkedDevices,
      attendeeCount: metrics.attendeeCount,
      metrics,
    };
  }

  async createFamilyGroup(userId, data) {
    const existingQuery = {
      leader: userId,
      status: 'active',
    };

    if (data.eventId) {
      existingQuery.event = data.eventId;
    }

    const existingGroup = await FamilyGroup.findOne(existingQuery);
    if (existingGroup) {
      if (data.eventId) await this.ensureFamilyEventRegistration(userId, data.eventId, existingGroup);
      return existingGroup;
    }

    if (data.eventId) {
      const event = await Event.findById(data.eventId);
      if (!event) throw new AppError('Event not found', 404);
    }

    const group = await FamilyGroup.create({
      name: data.name,
      leader: userId,
      event: data.eventId,
      members: [
        {
          user: userId,
          role: 'leader',
          relationship: 'other',
          emergencyContact: true,
        },
      ],
      guardians: Array.isArray(data.guardians) && data.guardians.length
        ? data.guardians.map((guardian, index) => ({
            user: guardian.user || (index === 0 ? userId : undefined),
            name: guardian.name || guardian.fullName || (index === 0 ? data.guardianName : 'Guardian'),
            relationship: guardian.relationship || 'guardian',
            phone: guardian.phone || '',
            role: guardian.role || (index === 0 ? 'leader' : 'guardian'),
            emergencyContact: guardian.emergencyContact !== false,
          }))
        : [buildLeaderGuardian(userId, data)],
      childMembers: data.childMembers || [],
    });

    if (data.eventId) await this.ensureFamilyEventRegistration(userId, data.eventId, group);

    return group;
  }

  async getMyFamilyGroups(userId) {
    return FamilyGroup.find({
      $or: [{ leader: userId }, { 'members.user': userId }],
      status: 'active',
    }).populate('event', 'name status venue schedule');
  }

  async updateFamilyGroup(userId, groupId, data) {
    const group = await FamilyGroup.findOne({ _id: groupId, leader: userId, status: 'active' });
    if (!group) throw new AppError('Family group not found', 404);

    if (data.name) group.name = data.name;
    if (data.geofenceSettings) {
      group.geofenceSettings = {
        ...(group.geofenceSettings?.toObject ? group.geofenceSettings.toObject() : group.geofenceSettings || {}),
        ...data.geofenceSettings,
      };
    }
    if (data.settings) {
      group.settings = {
        ...(group.settings?.toObject ? group.settings.toObject() : group.settings || {}),
        ...data.settings,
      };
    }
    group.lastActivity = new Date();
    await group.save();
    return group;
  }

  async deleteFamilyGroup(userId, groupId) {
    const group = await FamilyGroup.findOne({ _id: groupId, leader: userId, status: 'active' });
    if (!group) throw new AppError('Family group not found', 404);

    const deviceIds = group.childMembers.map((child) => child.wearableDeviceId).filter(Boolean);
    group.childMembers = [];
    group.devicePairings = [];
    group.disband();
    await group.save();

    if (deviceIds.length) {
      await DeviceTracking.updateMany(
        { 'deviceInfo.deviceId': { $in: deviceIds } },
        { $set: { status: 'inactive', 'metadata.rawData.deletedAt': new Date() } }
      );
    }
    if (group.event) {
      await Event.updateOne(
        { _id: group.event, 'attendees.familyGroupId': group._id },
        { $unset: { 'attendees.$[attendee].familyGroupId': '' } },
        { arrayFilters: [{ 'attendee.familyGroupId': group._id }] }
      );
    }

    return { groupId: group._id, eventId: group.event, deviceIds };
  }

  async addChildMember(userId, groupId, childData) {
    const group = await FamilyGroup.findOne({ _id: groupId, leader: userId, status: 'active' });
    if (!group) throw new AppError('Family group not found', 404);

    group.childMembers.push({
      name: childData.name,
      age: childData.age,
      relationship: childData.relationship || 'child',
      deviceLabel: childData.deviceLabel,
      deviceStatus: 'unpaired',
      geofenceStatus: 'unknown',
    });
    await group.save();
    return group;
  }

  async updateChildMember(userId, groupId, childMemberId, childData) {
    const group = await FamilyGroup.findOne({ _id: groupId, leader: userId, status: 'active' });
    if (!group) throw new AppError('Family group not found', 404);

    const child = group.childMembers.id(childMemberId);
    if (!child) throw new AppError('Child member not found', 404);

    ['name', 'age', 'relationship'].forEach((field) => {
      if (childData[field] !== undefined) child[field] = childData[field];
    });
    if (childData.deviceLabel !== undefined) child.deviceLabel = childData.deviceLabel;
    group.lastActivity = new Date();
    await group.save();
    return group;
  }

  async removeChildMember(userId, groupId, childMemberId) {
    const group = await FamilyGroup.findOne({ _id: groupId, leader: userId, status: 'active' });
    if (!group) throw new AppError('Family group not found', 404);

    const child = group.childMembers.id(childMemberId);
    if (!child) throw new AppError('Child member not found', 404);

    const deviceId = child.wearableDeviceId;
    group.childMembers.pull(childMemberId);
    group.devicePairings = group.devicePairings.filter((pairing) => String(pairing.childMemberId) !== String(childMemberId));
    group.lastActivity = new Date();
    await group.save();

    if (deviceId) {
      await DeviceTracking.updateMany(
        {
          $or: [
            { 'deviceInfo.deviceId': deviceId },
            { 'metadata.rawData.childMemberId': childMemberId },
          ],
        },
        { $set: { status: 'inactive', 'metadata.rawData.deletedAt': new Date() } }
      );
    }

    return { group, removedChildId: childMemberId, deviceId };
  }

  async addGuardian(userId, groupId, guardianData) {
    const group = await FamilyGroup.findOne({ _id: groupId, leader: userId, status: 'active' });
    if (!group) throw new AppError('Family group not found', 404);

    group.guardians.push({
      name: guardianData.name,
      relationship: guardianData.relationship || 'guardian',
      phone: guardianData.phone || '',
      role: guardianData.role || 'guardian',
      emergencyContact: guardianData.emergencyContact !== false,
    });
    group.lastActivity = new Date();
    await group.save();
    return group;
  }

  async updateGuardian(userId, groupId, guardianId, guardianData) {
    const group = await FamilyGroup.findOne({ _id: groupId, leader: userId, status: 'active' });
    if (!group) throw new AppError('Family group not found', 404);

    const guardian = group.guardians.id(guardianId);
    if (!guardian) throw new AppError('Guardian not found', 404);
    if (guardian.role === 'leader') throw new AppError('Cannot edit primary guardian here', 400);

    ['name', 'relationship', 'phone'].forEach((field) => {
      if (guardianData[field] !== undefined) guardian[field] = guardianData[field];
    });
    group.lastActivity = new Date();
    await group.save();
    return group;
  }

  async removeGuardian(userId, groupId, guardianId) {
    const group = await FamilyGroup.findOne({ _id: groupId, leader: userId, status: 'active' });
    if (!group) throw new AppError('Family group not found', 404);

    const guardian = group.guardians.id(guardianId);
    if (!guardian) throw new AppError('Guardian not found', 404);
    if (guardian.role === 'leader') throw new AppError('Cannot remove primary guardian', 400);

    group.guardians.pull(guardianId);
    group.lastActivity = new Date();
    await group.save();
    return { group, removedGuardianId: guardianId };
  }

  async generatePairingCode(userId, groupId, childMemberId) {
    const group = await FamilyGroup.findOne({ _id: groupId, leader: userId });
    if (!group) throw new AppError('Family group not found', 404);

    const child = group.childMembers.id(childMemberId);
    if (!child) throw new AppError('Child member not found', 404);

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    group.devicePairings.forEach((pairing) => {
      if (String(pairing.childMemberId) === String(child._id) && pairing.status === 'pending') {
        pairing.status = 'expired';
      }
    });

    child.pairingCode = code;
    child.pairingCodeExpiresAt = expiresAt;
    child.deviceStatus = 'pending';
    child.paired = false;
    child.connected = false;
    group.devicePairings.push({
      childMemberId: child._id,
      code,
      status: 'pending',
      expiresAt,
    });

    await group.save();
    return { groupId, childMemberId, familyCode: group.code, pairingCode: code, expiresAt };
  }

  async confirmPairing(familyCode, pairCode, deviceId, deviceMeta = {}) {
    if (!familyCode || !pairCode || !deviceId) {
      throw new AppError('Family code, pair code, and device ID are required', 400);
    }

    const normalizedFamilyCode = familyCode.toUpperCase();
    const normalizedPairCode = pairCode.toUpperCase();

    const group = await FamilyGroup.findOne({
      code: normalizedFamilyCode,
      'devicePairings.code': normalizedPairCode,
    });
    if (!group) throw new AppError('Pairing code not found', 404);

    const pairing = group.devicePairings.find((item) => item.code === normalizedPairCode);
    if (!pairing || pairing.status !== 'pending') {
      throw new AppError('Pairing code already used or unavailable', 400);
    }

    if (!pairing || pairing.expiresAt < new Date()) {
      if (pairing) pairing.status = 'expired';
      const expiredChild = pairing ? group.childMembers.id(pairing.childMemberId) : null;
      if (expiredChild && expiredChild.deviceStatus === 'pending') {
        expiredChild.deviceStatus = 'unpaired';
        expiredChild.pairingCode = undefined;
        expiredChild.pairingCodeExpiresAt = undefined;
      }
      await group.save();
      throw new AppError('Pairing code expired', 400);
    }

    const child = group.childMembers.id(pairing.childMemberId);
    if (!child) throw new AppError('Child member not found', 404);
    if (!group.event) throw new AppError('Family group must be linked to an event before pairing a device', 400);

    const initialCoordinates =
      child.lastLocation?.coordinates?.length === 2
        ? child.lastLocation.coordinates
        : [0, 0];
    const deviceTracking = await DeviceTracking.create({
      user: group.leader,
      event: group.event,
      deviceInfo: {
        deviceId,
        deviceType: 'web',
      },
      location: {
        type: 'Point',
        coordinates: initialCoordinates,
      },
      battery: {},
      network: {
        type: 'unknown',
      },
      activity: {
        type: 'unknown',
        confidence: 0,
      },
      metadata: {
        source: 'passive',
        isSimulated: false,
        rawData: {
          familyGroupId: group._id,
          childMemberId: child._id,
          pairingCodeId: pairing._id,
        },
      },
      status: 'active',
    });

    pairing.status = 'confirmed';
    pairing.deviceId = deviceId;
    pairing.confirmedAt = new Date();
    child.wearableDeviceId = deviceId;
    child.deviceStatus = 'paired';
    child.paired = true;
    child.connected = true;
    await group.save();

    return {
      groupId: group._id,
      childMemberId: child._id,
      childName: child.name,
      familyCode: group.code,
      familyName: group.name,
      eventId: group.event,
      deviceId,
      deviceType: deviceMeta.deviceType,
      deviceLabel: deviceMeta.deviceLabel,
      paired: true,
      connected: true,
      status: 'connected',
      deviceSession: {
        sessionId: deviceTracking.sessionInfo.sessionId,
        trackingId: deviceTracking._id,
        startedAt: deviceTracking.sessionInfo.sessionStart,
        status: deviceTracking.status,
      },
    };
  }

  async updateDeviceLocation(deviceId, locationData) {
    if (!locationData.deviceSessionId) {
      throw new AppError('Active device session is required before location tracking can start', 403);
    }

    const group = await FamilyGroup.findOne({ 'childMembers.wearableDeviceId': deviceId });
    if (!group) throw new AppError('Linked device not found', 404);

    const child = group.childMembers.find((item) => item.wearableDeviceId === deviceId);
    if (!child?.paired || !child?.connected || child.deviceStatus !== 'paired') {
      throw new AppError('Device is not paired or connected', 403);
    }
    const deviceSession = await DeviceTracking.findOne({
      'deviceInfo.deviceId': deviceId,
      'sessionInfo.sessionId': locationData.deviceSessionId,
      status: 'active',
    });
    if (!deviceSession) {
      throw new AppError('Active device session not found', 403);
    }

    deviceSession.location = {
      type: 'Point',
      coordinates: [locationData.longitude, locationData.latitude],
    };
    deviceSession.battery = {
      ...deviceSession.battery,
      level: locationData.batteryLevel,
    };
    deviceSession.network = {
      ...deviceSession.network,
      type: locationData.signalStatus === 'lost' ? 'none' : 'unknown',
    };
    deviceSession.geofenceStatus = {
      ...deviceSession.geofenceStatus,
      inside: locationData.geofenceStatus !== 'outside',
    };
    await deviceSession.save();

    child.lastLocation = {
      type: 'Point',
      coordinates: [locationData.longitude, locationData.latitude],
    };
    child.lastSeenAt = new Date();
    child.batteryLevel = locationData.batteryLevel;
    child.geofenceStatus = locationData.geofenceStatus || 'inside';
    child.deviceStatus = 'paired';
    child.paired = true;
    child.connected = true;
    await group.save();

    return { groupId: group._id, childMemberId: child._id, deviceId, child };
  }

  async getOrganizerFamilySummary(eventId, emergency = false) {
    const [groups, metrics] = await Promise.all([
      FamilyGroup.find({ event: eventId, status: 'active' }),
      this.getFamilyMetrics(eventId),
    ]);

    return {
      groups: groups.map((group, index) => ({
        groupId: group._id,
        label: `Family Group ${index + 1}`,
        memberCount: group.childMembers.length + group.members.length + group.guardians.length,
        linkedDevices: group.childMembers.filter((child) => child.deviceStatus === 'paired' || child.connected || child.paired).length,
        geofenceBreaches: group.childMembers.filter((child) => child.geofenceStatus === 'outside').length,
        members: emergency ? group.childMembers.map((child) => ({ name: child.name, status: child.deviceStatus })) : undefined,
      })),
      metrics,
    };
  }
}

module.exports = new FamilyService();
