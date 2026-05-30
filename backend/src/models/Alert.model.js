const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
  {
    alertNumber: {
      type: String,
      unique: true,
      required: [true, 'Alert number is required'],
      index: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event is required'],
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: ['emergency', 'warning', 'info', 'geofence', 'system', 'medical', 'security', 'weather', 'crowd'],
        message: '{VALUE} is not a valid alert type',
      },
      required: [true, 'Alert type is required'],
      index: true,
    },
    severity: {
      type: String,
      enum: {
        values: ['low', 'medium', 'high', 'critical'],
        message: '{VALUE} is not a valid severity level',
      },
      required: [true, 'Severity is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Alert title is required'],
      trim: true,
      minlength: [5, 'Title must be at least 5 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    source: {
      type: {
        type: String,
        enum: ['user', 'system', 'geofence', 'admin', 'device', 'api'],
        required: true,
      },
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      deviceId: String,
      ipAddress: String,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
        validate: {
          validator: function (v) {
            return v.length === 2 && v[0] >= -180 && v[0] <= 180 && v[1] >= -90 && v[1] <= 90;
          },
          message: 'Invalid coordinates',
        },
      },
      accuracy: Number,
      altitude: Number,
      address: String,
      landmark: String,
      area: String,
    },
    affectedUsers: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        notified: {
          type: Boolean,
          default: false,
        },
        acknowledged: {
          type: Boolean,
          default: false,
        },
        acknowledgedAt: Date,
        response: String,
      },
    ],
    affectedAreas: [
      {
        name: String,
        location: {
          type: {
            type: String,
            enum: ['Point'],
          },
          coordinates: [Number],
        },
        radius: Number,
      },
    ],
    status: {
      type: String,
      enum: ['active', 'acknowledged', 'responding', 'resolved', 'dismissed', 'escalated'],
      default: 'active',
      index: true,
    },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    acknowledgedAt: {
      type: Date,
    },
    acknowledgedLocation: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: [Number],
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    resolvedAt: {
      type: Date,
    },
    resolvedLocation: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: [Number],
    },
    resolution: {
      type: String,
      trim: true,
      maxlength: [1000, 'Resolution cannot exceed 1000 characters'],
    },
    actions: [
      {
        type: {
          type: String,
          enum: ['evacuate', 'shelter', 'lockdown', 'medical', 'security', 'crowd_control', 'search_rescue', 'custom'],
        },
        description: String,
        initiatedAt: Date,
        initiatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        completedAt: Date,
        status: {
          type: String,
          enum: ['pending', 'in_progress', 'completed', 'cancelled'],
          default: 'pending',
        },
      },
    ],
    metadata: {
      geofenceId: mongoose.Schema.Types.ObjectId,
      geofenceName: String,
      triggeredBy: String,
      incidentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'IncidentLog',
      },
      deviceTrackingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DeviceTracking',
      },
      additionalData: mongoose.Schema.Types.Mixed,
    },
    notifications: {
      sent: {
        type: Boolean,
        default: false,
      },
      channels: {
        push: {
          type: Boolean,
          default: true,
        },
        sms: {
          type: Boolean,
          default: false,
        },
        email: {
          type: Boolean,
          default: false,
        },
        inApp: {
          type: Boolean,
          default: true,
        },
        broadcast: {
          type: Boolean,
          default: false,
        },
      },
      sentAt: Date,
      recipients: {
        type: Number,
        default: 0,
      },
      failed: {
        type: Number,
        default: 0,
      },
    },
    escalation: {
      level: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },
      escalatedAt: Date,
      escalatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      reason: String,
    },
    response: {
      responseTime: Number,
      firstResponder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      firstResponseAt: Date,
      totalResponders: {
        type: Number,
        default: 0,
      },
    },
    impact: {
      estimatedAffected: {
        type: Number,
        default: 0,
      },
      actualAffected: {
        type: Number,
        default: 0,
      },
      injuries: {
        type: Number,
        default: 0,
      },
      fatalities: {
        type: Number,
        default: 0,
      },
      propertyDamage: {
        type: Boolean,
        default: false,
      },
    },
    tags: [String],
    customFields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

alertSchema.index({ alertNumber: 1 }, { unique: true });
alertSchema.index({ event: 1, status: 1 });
alertSchema.index({ event: 1, type: 1 });
alertSchema.index({ event: 1, severity: 1 });
alertSchema.index({ type: 1, severity: 1 });
alertSchema.index({ 'source.userId': 1 });
alertSchema.index({ location: '2dsphere' });
alertSchema.index({ createdAt: -1 });
alertSchema.index({ status: 1, severity: 1 });
alertSchema.index({ 'affectedUsers.user': 1 });
alertSchema.index({ 'metadata.incidentId': 1 });

alertSchema.virtual('isActive').get(function () {
  return this.status === 'active';
});

alertSchema.virtual('isAcknowledged').get(function () {
  return this.status === 'acknowledged';
});

alertSchema.virtual('isResolved').get(function () {
  return this.status === 'resolved';
});

alertSchema.virtual('duration').get(function () {
  if (this.resolvedAt) {
    return this.resolvedAt - this.createdAt;
  }
  return Date.now() - this.createdAt;
});

alertSchema.virtual('responseDuration').get(function () {
  if (this.response && this.response.firstResponseAt) {
    return this.response.firstResponseAt - this.createdAt;
  }
  return null;
});

alertSchema.virtual('acknowledgementDuration').get(function () {
  if (this.acknowledgedAt) {
    return this.acknowledgedAt - this.createdAt;
  }
  return null;
});

alertSchema.pre('validate', async function (next) {
  if (this.isNew && !this.alertNumber) {
    this.alertNumber = await this.generateAlertNumber();
  }

  next();
});

alertSchema.pre('save', async function (next) {
  if (this.isModified('status')) {
    const now = new Date();

    switch (this.status) {
      case 'acknowledged':
        if (!this.acknowledgedAt) {
          this.acknowledgedAt = now;
        }
        break;
      case 'resolved':
        if (!this.resolvedAt) {
          this.resolvedAt = now;
        }
        break;
      case 'escalated':
        if (this.escalation.level === 0) {
          this.escalation.level = 1;
        }
        if (!this.escalation.escalatedAt) {
          this.escalation.escalatedAt = now;
        }
        break;
    }
  }

  if (this.isModified('affectedUsers')) {
    this.notifications.recipients = this.affectedUsers.length;
    this.notifications.failed = this.affectedUsers.filter((u) => !u.notified).length;
    this.impact.actualAffected = this.affectedUsers.length;
  }

  next();
});

alertSchema.methods.generateAlertNumber = async function () {
  const year = new Date().getFullYear();
  const count = await this.constructor.countDocuments({
    alertNumber: new RegExp(`^ALT-${year}`),
  });
  const sequence = String(count + 1).padStart(4, '0');
  return `ALT-${year}-${sequence}`;
};

alertSchema.methods.acknowledge = function (userId, location = null) {
  this.status = 'acknowledged';
  this.acknowledgedBy = userId;
  this.acknowledgedAt = new Date();
  if (location) {
    this.acknowledgedLocation = location;
  }
};

alertSchema.methods.resolve = function (userId, resolution, location = null) {
  this.status = 'resolved';
  this.resolvedBy = userId;
  this.resolvedAt = new Date();
  this.resolution = resolution;
  if (location) {
    this.resolvedLocation = location;
  }
};

alertSchema.methods.dismiss = function (userId) {
  this.status = 'dismissed';
  this.resolvedBy = userId;
  this.resolvedAt = new Date();
};

alertSchema.methods.escalate = function (userId, reason, level = null) {
  this.status = 'escalated';
  this.escalation.escalatedBy = userId;
  this.escalation.escalatedAt = new Date();
  this.escalation.reason = reason;
  if (level !== null) {
    this.escalation.level = level;
  } else {
    this.escalation.level = Math.min(this.escalation.level + 1, 5);
  }
};

alertSchema.methods.addAction = function (type, description, userId) {
  this.actions.push({
    type,
    description,
    initiatedAt: new Date(),
    initiatedBy: userId,
    status: 'pending',
  });
};

alertSchema.methods.updateActionStatus = function (actionIndex, status) {
  if (this.actions[actionIndex]) {
    this.actions[actionIndex].status = status;
    if (status === 'completed') {
      this.actions[actionIndex].completedAt = new Date();
    }
  }
};

alertSchema.methods.addAffectedUser = function (userId) {
  const existing = this.affectedUsers.find((u) => u.user.toString() === userId.toString());
  if (!existing) {
    this.affectedUsers.push({
      user: userId,
      notified: false,
      acknowledged: false,
    });
  }
};

alertSchema.methods.markUserNotified = function (userId) {
  const user = this.affectedUsers.find((u) => u.user.toString() === userId.toString());
  if (user) {
    user.notified = true;
  }
};

alertSchema.methods.markUserAcknowledged = function (userId, response = null) {
  const user = this.affectedUsers.find((u) => u.user.toString() === userId.toString());
  if (user) {
    user.acknowledged = true;
    user.acknowledgedAt = new Date();
    if (response) {
      user.response = response;
    }
  }
};

alertSchema.methods.recordFirstResponse = function (userId) {
  if (!this.response.firstResponder) {
    this.response.firstResponder = userId;
    this.response.firstResponseAt = new Date();
    this.response.responseTime = this.response.firstResponseAt - this.createdAt;
  }
  this.response.totalResponders += 1;
};

alertSchema.methods.sendNotifications = function (channels = ['push', 'inApp']) {
  this.notifications.sent = true;
  this.notifications.sentAt = new Date();
  this.notifications.channels = {
    push: channels.includes('push'),
    sms: channels.includes('sms'),
    email: channels.includes('email'),
    inApp: channels.includes('inApp'),
    broadcast: channels.includes('broadcast'),
  };
};

alertSchema.methods.updateImpact = function (impactData) {
  if (impactData.estimatedAffected !== undefined) {
    this.impact.estimatedAffected = impactData.estimatedAffected;
  }
  if (impactData.injuries !== undefined) {
    this.impact.injuries = impactData.injuries;
  }
  if (impactData.fatalities !== undefined) {
    this.impact.fatalities = impactData.fatalities;
  }
  if (impactData.propertyDamage !== undefined) {
    this.impact.propertyDamage = impactData.propertyDamage;
  }
};

alertSchema.statics.getActiveAlerts = function (eventId) {
  return this.find({
    event: eventId,
    status: { $in: ['active', 'acknowledged', 'responding', 'escalated'] },
  }).sort({ severity: -1, createdAt: -1 });
};

alertSchema.statics.getCriticalAlerts = function (eventId) {
  return this.find({
    event: eventId,
    severity: 'critical',
    status: { $ne: 'resolved' },
  }).sort({ createdAt: -1 });
};

alertSchema.statics.getAlertsByUser = function (userId, eventId = null) {
  const query = { 'affectedUsers.user': userId };
  if (eventId) {
    query.event = eventId;
  }
  return this.find(query)
    .populate('event', 'name schedule status')
    .sort({ createdAt: -1 });
};

alertSchema.statics.getUnacknowledgedAlerts = function (eventId) {
  return this.find({
    event: eventId,
    status: 'active',
  }).sort({ severity: -1, createdAt: -1 });
};

module.exports = mongoose.model('Alert', alertSchema);
