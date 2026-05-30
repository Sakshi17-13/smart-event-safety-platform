const logger = require('../utils/logger');

const now = new Date();
const minutesAgo = (minutes) => new Date(now.getTime() - minutes * 60 * 1000).toISOString();
const minutesFromNow = (minutes) => new Date(now.getTime() + minutes * 60 * 1000).toISOString();

const events = [
  {
    _id: 'demo-event-1',
    name: 'Metro Music Festival',
    description: 'Live outdoor festival with active crowd coordination and family safety tracking.',
    status: 'active',
    category: 'festival',
    location: 'Central Grounds',
    date: now.toISOString(),
    attendees: 4820,
    venue: {
      name: 'Central Grounds',
      capacity: 8000,
      location: { type: 'Point', coordinates: [72.8777, 19.076] },
    },
    schedule: {
      startDate: minutesAgo(120),
      endDate: minutesFromNow(360),
    },
    statistics: {
      totalAttendees: 4820,
      checkedIn: 4390,
      activeAlerts: 4,
      totalIncidents: 7,
    },
  },
  {
    _id: 'demo-event-2',
    name: 'City Tech Expo',
    description: 'Indoor conference with responder teams, geofence zones, and attendee monitoring.',
    status: 'published',
    category: 'conference',
    location: 'Expo Hall B',
    date: minutesFromNow(1440),
    attendees: 1260,
    venue: {
      name: 'Expo Hall B',
      capacity: 3000,
      location: { type: 'Point', coordinates: [72.8712, 19.0821] },
    },
    schedule: {
      startDate: minutesFromNow(1440),
      endDate: minutesFromNow(1920),
    },
    statistics: {
      totalAttendees: 1260,
      checkedIn: 0,
      activeAlerts: 0,
      totalIncidents: 0,
    },
  },
];

const alerts = [
  {
    _id: 'demo-alert-1',
    alertNumber: 'ALT-DEMO-0001',
    event: 'demo-event-1',
    type: 'geofence',
    severity: 'high',
    status: 'active',
    title: 'Restricted Zone Breach',
    description: 'Geofence breach detected near backstage service gate.',
    location: 'Backstage Gate',
    createdAt: minutesAgo(3),
  },
  {
    _id: 'demo-alert-2',
    alertNumber: 'ALT-DEMO-0002',
    event: 'demo-event-1',
    type: 'crowd',
    severity: 'medium',
    status: 'active',
    title: 'Crowd Density Rising',
    description: 'Crowd density is increasing near Main Gate entrance.',
    location: 'Main Gate',
    createdAt: minutesAgo(8),
  },
  {
    _id: 'demo-alert-3',
    alertNumber: 'ALT-DEMO-0003',
    event: 'demo-event-1',
    type: 'medical',
    severity: 'high',
    status: 'acknowledged',
    title: 'Medical Assistance Required',
    description: 'Responder team dispatched to Hall B for attendee assistance.',
    location: 'Hall B',
    createdAt: minutesAgo(14),
  },
  {
    _id: 'demo-alert-4',
    alertNumber: 'ALT-DEMO-0004',
    event: 'demo-event-1',
    type: 'security',
    severity: 'low',
    status: 'resolved',
    title: 'Perimeter Check',
    description: 'Security patrol resolved a perimeter access concern.',
    location: 'North Perimeter',
    createdAt: minutesAgo(32),
  },
];

const locations = [
  {
    _id: 'demo-location-child-1',
    user: {
      _id: 'demo-child-1',
      firstName: 'Emma',
      lastName: 'Family',
      role: 'FAMILY',
    },
    event: 'demo-event-1',
    coordinates: { type: 'Point', coordinates: [72.8777, 19.076] },
    status: 'safe',
    label: 'Child tracking',
    lastSeen: minutesAgo(2),
    battery: { level: 82, isCharging: false },
  },
  {
    _id: 'demo-location-responder-1',
    user: {
      _id: 'demo-responder-1',
      firstName: 'Unit',
      lastName: 'Alpha',
      role: 'EVENT_ORGANIZER',
    },
    event: 'demo-event-1',
    coordinates: { type: 'Point', coordinates: [72.8791, 19.0752] },
    status: 'responding',
    label: 'Responder activity',
    lastSeen: minutesAgo(1),
    battery: { level: 67, isCharging: false },
  },
  {
    _id: 'demo-location-responder-2',
    user: {
      _id: 'demo-responder-2',
      firstName: 'Unit',
      lastName: 'Beta',
      role: 'EVENT_ORGANIZER',
    },
    event: 'demo-event-1',
    coordinates: { type: 'Point', coordinates: [72.8758, 19.0771] },
    status: 'active',
    label: 'Responder activity',
    lastSeen: minutesAgo(4),
    battery: { level: 91, isCharging: true },
  },
];

const dashboard = {
  activeEvents: events.filter((event) => ['active', 'ongoing', 'published'].includes(event.status)).length,
  totalAlerts: alerts.length,
  activeAlerts: alerts.filter((alert) => alert.status !== 'resolved').length,
  totalUsers: 154,
  systemHealth: 98,
  crowdIncidents: 3,
  geofenceBreaches: alerts.filter((alert) => alert.type === 'geofence').length,
  childTracking: {
    trackedChildren: 18,
    safe: 17,
    needsAttention: 1,
  },
  responderActivity: {
    activeResponders: 12,
    dispatched: 4,
    averageResponseMinutes: 6,
  },
  recentAlerts: alerts,
};

const eventStats = {
  total: events.length,
  active: dashboard.activeEvents,
  upcoming: 1,
  completed: 0,
  checkedIn: 4390,
  capacity: 11000,
  crowdIncidents: dashboard.crowdIncidents,
  geofenceBreaches: dashboard.geofenceBreaches,
};

const heatmap = locations.map((location) => ({
  latitude: location.coordinates.coordinates[1],
  longitude: location.coordinates.coordinates[0],
  weight: location.status === 'responding' ? 3 : 1,
  label: location.label,
  createdAt: location.lastSeen,
}));

const familyGroups = [
  {
    _id: 'demo-family-group-1',
    name: 'Demo Family',
    code: 'FAMDEMO1',
    event: 'demo-event-1',
    leader: 'demo-family',
    members: [{ user: 'demo-family', role: 'leader', relationship: 'parent' }],
    childMembers: [
      {
        _id: 'demo-child-1',
        name: 'Emma',
        age: 12,
        relationship: 'child',
        wearableDeviceId: 'WATCH-DEMO-001',
        deviceStatus: 'paired',
        paired: true,
        connected: true,
        lastLocation: { type: 'Point', coordinates: [72.8777, 19.076] },
        lastSeenAt: minutesAgo(2),
        batteryLevel: 82,
        geofenceStatus: 'inside',
        sosActive: false,
      },
      {
        _id: 'demo-child-2',
        name: 'Liam',
        age: 8,
        relationship: 'child',
        wearableDeviceId: null,
        deviceStatus: 'unpaired',
        paired: false,
        connected: false,
        lastLocation: { type: 'Point', coordinates: [72.8764, 19.0772] },
        lastSeenAt: minutesAgo(15),
        batteryLevel: null,
        geofenceStatus: 'unknown',
        sosActive: false,
      },
    ],
    devicePairings: [],
    statistics: { totalMembers: 3, activeMembers: 2, alertsTriggered: 0, checkIns: 1 },
  },
];

const organizerFamilySummary = [
  {
    groupId: 'demo-family-group-1',
    label: 'Family Group 1',
    memberCount: 3,
    linkedDevices: 1,
    geofenceBreaches: 0,
    status: 'normal',
  },
  {
    groupId: 'demo-family-group-2',
    label: 'Family Group 2',
    memberCount: 4,
    linkedDevices: 2,
    geofenceBreaches: 1,
    status: 'attention',
  },
];

const response = (res, message, data) =>
  res.status(200).json({
    success: true,
    message,
    data,
  });

const createMockFallbackMiddleware = ({ allowNoDb }) => {
  return (req, res, next) => {
    if (!allowNoDb || req.app.locals.dbAvailable) return next();

    const method = req.method.toUpperCase();
    const path = req.path;

    logger.warn('Using mock fallback data because database is unavailable', {
      path,
      dbStatus: req.app.locals.dbStatus,
    });

    if (method === 'POST' && path.match(/^\/family\/events\/[^/]+\/register$/)) {
      return response(res, 'Registered for event successfully', {
        eventId: path.split('/')[3],
        registrationId: `REG-${Date.now()}`,
        status: 'registered',
      });
    }

    if (method === 'POST' && path === '/family/groups') {
      const group = {
        _id: `demo-family-group-${familyGroups.length + 1}`,
        name: req.body.name || 'My Family Group',
        code: `FAM${String(Date.now()).slice(-5)}`,
        event: req.body.eventId || 'demo-event-1',
        leader: 'demo-family',
        members: [{ user: 'demo-family', role: 'leader', relationship: 'parent' }],
        childMembers: req.body.childMembers || [],
        devicePairings: [],
        statistics: { totalMembers: 1 + (req.body.childMembers?.length || 0), activeMembers: 1, alertsTriggered: 0, checkIns: 0 },
      };
      familyGroups.unshift(group);
      return response(res, 'Family group created successfully', group);
    }

    if (method === 'POST' && path.match(/^\/family\/groups\/[^/]+\/children$/)) {
      const group = familyGroups.find((item) => item._id === path.split('/')[3]) || familyGroups[0];
      const child = {
        _id: `demo-child-${Date.now()}`,
        name: req.body.name || 'Child Member',
        age: req.body.age || 10,
        relationship: req.body.relationship || 'child',
        deviceStatus: 'unpaired',
        geofenceStatus: 'unknown',
      };
      group.childMembers.push(child);
      return response(res, 'Child member added successfully', group);
    }

    if (method === 'POST' && path.match(/^\/family\/groups\/[^/]+\/children\/[^/]+\/pairing-code$/)) {
      const parts = path.split('/');
      const group = familyGroups.find((item) => item._id === parts[3]) || familyGroups[0];
      const child = group.childMembers.find((item) => item._id === parts[5]) || group.childMembers[0];
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      group.devicePairings.forEach((item) => {
        if (item.childMemberId === child._id && item.status === 'pending') item.status = 'expired';
      });
      const pairing = {
        childMemberId: child._id,
        code,
        status: 'pending',
        expiresAt: minutesFromNow(5),
      };
      child.deviceStatus = 'pending';
      child.paired = false;
      child.connected = false;
      child.pairingCode = code;
      child.pairingCodeExpiresAt = pairing.expiresAt;
      group.devicePairings.push(pairing);
      return response(res, 'Pairing code generated successfully', {
        groupId: group._id,
        childMemberId: child._id,
        familyCode: group.code,
        pairingCode: code,
        expiresAt: pairing.expiresAt,
      });
    }

    if (method === 'POST' && path === '/family/devices/confirm-pairing') {
      const normalizedFamilyCode = String(req.body.familyCode || '').toUpperCase();
      const normalizedPairCode = String(req.body.pairCode || '').toUpperCase();
      const group = familyGroups.find(
        (item) => item.code === normalizedFamilyCode && item.devicePairings.some((pairing) => pairing.code === normalizedPairCode)
      );
      if (!group) {
        return res.status(404).json({
          success: false,
          message: 'Pairing code not found',
          data: null,
        });
      }

      const pairing = group.devicePairings.find((item) => item.code === normalizedPairCode);
      if (!pairing || pairing.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Pairing code already used or unavailable',
          data: null,
        });
      }

      if (new Date(pairing.expiresAt) < new Date()) {
        pairing.status = 'expired';
        const child = group.childMembers.find((item) => item._id === pairing.childMemberId);
        if (child?.deviceStatus === 'pending') {
          child.deviceStatus = 'unpaired';
          child.pairingCode = undefined;
          child.pairingCodeExpiresAt = undefined;
        }
        return res.status(400).json({
          success: false,
          message: 'Pairing code expired',
          data: null,
        });
      }

      const child = group.childMembers.find((item) => item._id === pairing.childMemberId) || group.childMembers[0];
      const deviceId = req.body.deviceId || `WATCH-${Date.now()}`;
      child.wearableDeviceId = deviceId;
      child.deviceStatus = 'paired';
      child.paired = true;
      child.connected = true;
      pairing.status = 'confirmed';
      pairing.deviceId = deviceId;
      const deviceSession = {
        sessionId: `SESSION-${Date.now()}-${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
        startedAt: new Date().toISOString(),
        status: 'active',
      };
      return response(res, 'Device paired successfully', {
        groupId: group._id,
        childMemberId: child._id,
        childName: child.name,
        familyCode: group.code,
        familyName: group.name,
        eventId: group.event,
        deviceId,
        paired: true,
        connected: true,
        status: 'connected',
        deviceSession,
      });
    }

    if (method === 'POST' && path.match(/^\/family\/devices\/[^/]+\/location$/)) {
      const deviceId = path.split('/')[3];
      const group = familyGroups.find((item) => item.childMembers.some((child) => child.wearableDeviceId === deviceId));
      const child = group?.childMembers.find((item) => item.wearableDeviceId === deviceId);
      if (!req.body.deviceSessionId || !group || !child || !child.paired || !child.connected || child.deviceStatus !== 'paired') {
        return res.status(403).json({
          success: false,
          message: req.body.deviceSessionId ? 'Device is not paired or connected' : 'Active device session is required before location tracking can start',
          data: null,
        });
      }
      child.lastLocation = { type: 'Point', coordinates: [req.body.longitude || 72.8777, req.body.latitude || 19.076] };
      child.lastSeenAt = new Date().toISOString();
      child.batteryLevel = req.body.batteryLevel || 76;
      child.geofenceStatus = req.body.geofenceStatus || 'inside';
      child.deviceStatus = 'paired';
      child.paired = true;
      child.connected = true;
      return response(res, 'Device location updated successfully', { groupId: group._id, childMemberId: child._id, deviceId, child });
    }

    if (method !== 'GET') return next();

    if (path === '/dashboard') {
      return response(res, 'Dashboard mock data retrieved successfully', dashboard);
    }

    if (path === '/family/events/nearby') {
      return response(res, 'Nearby events retrieved successfully', events);
    }

    if (path === '/family/groups/mine') {
      return response(res, 'Family groups retrieved successfully', familyGroups);
    }

    if (path.match(/^\/family\/organizer\/events\/[^/]+\/family-summary$/)) {
      const emergency = req.query.emergency === 'true';
      const summary = emergency
        ? organizerFamilySummary.map((group) => ({
            ...group,
            members: group.groupId === 'demo-family-group-1' ? familyGroups[0].childMembers.map((child) => ({ name: child.name, deviceStatus: child.deviceStatus })) : [],
          }))
        : organizerFamilySummary;
      return response(res, 'Family group summary retrieved successfully', summary);
    }

    if (path === '/events/stats') {
      return response(res, 'Event statistics mock data retrieved successfully', eventStats);
    }

    if (path === '/events') {
      return response(res, 'Events mock data retrieved successfully', events);
    }

    if (path.startsWith('/events/')) {
      const eventId = path.split('/')[2];
      const event = events.find((item) => item._id === eventId) || events[0];
      return response(res, 'Event mock data retrieved successfully', event);
    }

    if (path === '/alerts' || path.startsWith('/alerts/event/')) {
      return response(res, 'Alerts mock data retrieved successfully', alerts);
    }

    if (path.startsWith('/alerts/')) {
      const alertId = path.split('/')[2];
      const alert = alerts.find((item) => item._id === alertId) || alerts[0];
      return response(res, 'Alert mock data retrieved successfully', alert);
    }

    if (path === '/locations') {
      return response(res, 'Locations mock data retrieved successfully', locations);
    }

    if (path.startsWith('/locations/event/') && path.endsWith('/heatmap')) {
      return response(res, 'Heatmap mock data retrieved successfully', heatmap);
    }

    if (path.startsWith('/locations/event/')) {
      return response(res, 'Event locations mock data retrieved successfully', locations);
    }

    if (path.startsWith('/locations/user/')) {
      return response(res, 'User locations mock data retrieved successfully', locations.slice(0, 1));
    }

    return next();
  };
};

module.exports = createMockFallbackMiddleware;
