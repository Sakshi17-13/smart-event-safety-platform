const mongoose = require('mongoose');

const incidentLogSchema = new mongoose.Schema(
  {
    incidentNumber: {
      type: String,
      unique: true,
      required: [true, 'Incident number is required'],
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
        values: ['medical', 'security', 'fire', 'weather', 'crowd', 'lost_person', 'theft', 'assault', 'accident', 'other'],
        message: '{VALUE} is not a valid incident type',
      },
      required: [true, 'Incident type is required'],
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
    status: {
      type: String,
      enum: ['reported', 'investigating', 'responding', 'resolved', 'closed'],
      default: 'reported',
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Incident title is required'],
      trim: true,
      minlength: [5, 'Title must be at least 5 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: [Number],
      address: String,
      landmark: String,
      area: String,
    },
    reporter: {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      name: String,
      role: String,
      contact: String,
      reportedAt: {
        type: Date,
        default: Date.now,
      },
      isAnonymous: {
        type: Boolean,
        default: false,
      },
    },
    involvedParties: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        name: String,
        role: String,
        involvement: {
          type: String,
          enum: ['victim', 'witness', 'suspect', 'bystander', 'staff'],
        },
        injuries: String,
        medicalAttention: {
          type: Boolean,
          default: false,
        },
      },
    ],
    responseTeam: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        role: String,
        assignedAt: Date,
        status: {
          type: String,
          enum: ['assigned', 'en_route', 'on_scene', 'completed'],
          default: 'assigned',
        },
        notes: String,
      },
    ],
    timeline: [
      {
        timestamp: {
          type: Date,
          default: Date.now,
        },
        action: String,
        description: String,
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        location: {
          type: {
            type: String,
            enum: ['Point'],
          },
          coordinates: [Number],
        },
      },
    ],
    actions: [
      {
        type: {
          type: String,
          enum: ['evacuation', 'medical_response', 'security_response', 'fire_response', 'crowd_control', 'search_rescue', 'lockdown', 'other'],
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
    resources: [
      {
        type: {
          type: String,
          enum: ['personnel', 'equipment', 'vehicle', 'medical', 'communication', 'other'],
        },
        name: String,
        quantity: Number,
        assignedAt: Date,
        releasedAt: Date,
        status: {
          type: String,
          enum: ['assigned', 'in_use', 'released', 'unavailable'],
          default: 'assigned',
        },
      },
    ],
    evidence: [
      {
        type: {
          type: String,
          enum: ['photo', 'video', 'document', 'audio', 'other'],
        },
        url: String,
        description: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      },
    ],
    communication: [
      {
        type: {
          type: String,
          enum: ['internal', 'external', 'broadcast', 'direct'],
        },
        channel: {
          type: String,
          enum: ['radio', 'phone', 'email', 'sms', 'app', 'pa_system'],
        },
        message: String,
        sentAt: Date,
        sentBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        recipients: [String],
      },
    ],
    resolution: {
      resolvedAt: Date,
      resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      summary: String,
      outcome: {
        type: String,
        enum: ['resolved', 'escalated', 'transferred', 'cancelled'],
      },
      followUpRequired: {
        type: Boolean,
        default: false,
      },
      followUpActions: [String],
      followUpDate: Date,
    },
    impact: {
      affectedAttendees: {
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
      disruptionLevel: {
        type: String,
        enum: ['none', 'minor', 'moderate', 'major', 'severe'],
        default: 'minor',
      },
    },
    lessonsLearned: {
      whatHappened: String,
      whyItHappened: String,
      whatWentWell: [String],
      whatCouldBeImproved: [String],
      recommendations: [String],
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

incidentLogSchema.index({ incidentNumber: 1 }, { unique: true });
incidentLogSchema.index({ event: 1, status: 1 });
incidentLogSchema.index({ event: 1, type: 1 });
incidentLogSchema.index({ event: 1, severity: 1 });
incidentLogSchema.index({ 'reporter.user': 1 });
incidentLogSchema.index({ location: '2dsphere' });
incidentLogSchema.index({ createdAt: -1 });
incidentLogSchema.index({ 'timeline.timestamp': -1 });
incidentLogSchema.index({ status: 1, severity: 1 });

incidentLogSchema.virtual('duration').get(function () {
  if (this.resolution && this.resolution.resolvedAt) {
    return this.resolution.resolvedAt - this.reporter.reportedAt;
  }
  return Date.now() - this.reporter.reportedAt;
});

incidentLogSchema.virtual('isActive').get(function () {
  return ['reported', 'investigating', 'responding'].includes(this.status);
});

incidentLogSchema.virtual('responseTime').get(function () {
  if (this.timeline.length > 1) {
    const firstResponse = this.timeline.find((t) => t.action === 'response_initiated');
    if (firstResponse) {
      return firstResponse.timestamp - this.reporter.reportedAt;
    }
  }
  return null;
});

incidentLogSchema.pre('validate', async function (next) {
  if (this.isNew && !this.incidentNumber) {
    this.incidentNumber = await this.generateIncidentNumber();
  }

  next();
});

incidentLogSchema.pre('save', async function (next) {
  if (this.isModified('status') && this.status === 'resolved') {
    this.resolution.resolvedAt = new Date();
  }

  next();
});

incidentLogSchema.methods.generateIncidentNumber = async function () {
  const year = new Date().getFullYear();
  const count = await this.constructor.countDocuments({
    incidentNumber: new RegExp(`^INC-${year}`),
  });
  const sequence = String(count + 1).padStart(4, '0');
  return `INC-${year}-${sequence}`;
};

incidentLogSchema.methods.addTimelineEntry = function (action, description, userId, location = null) {
  this.timeline.push({
    timestamp: new Date(),
    action,
    description,
    user: userId,
    location,
  });
};

incidentLogSchema.methods.assignResponder = function (userId, role) {
  const existing = this.responseTeam.find((r) => r.user.toString() === userId.toString());
  if (!existing) {
    this.responseTeam.push({
      user: userId,
      role,
      assignedAt: new Date(),
      status: 'assigned',
    });
    this.addTimelineEntry('responder_assigned', `Responder ${role} assigned`, userId);
  }
};

incidentLogSchema.methods.updateResponderStatus = function (userId, status, notes = null) {
  const responder = this.responseTeam.find((r) => r.user.toString() === userId.toString());
  if (responder) {
    responder.status = status;
    if (notes) responder.notes = notes;
    this.addTimelineEntry('responder_status_update', `Responder status updated to ${status}`, userId);
  }
};

incidentLogSchema.methods.addAction = function (type, description, userId) {
  this.actions.push({
    type,
    description,
    initiatedAt: new Date(),
    initiatedBy: userId,
    status: 'pending',
  });
  this.addTimelineEntry('action_initiated', `Action ${type} initiated`, userId);
};

incidentLogSchema.methods.updateActionStatus = function (actionIndex, status) {
  if (this.actions[actionIndex]) {
    this.actions[actionIndex].status = status;
    if (status === 'completed') {
      this.actions[actionIndex].completedAt = new Date();
    }
  }
};

incidentLogSchema.methods.addEvidence = function (type, url, description, userId) {
  this.evidence.push({
    type,
    url,
    description,
    uploadedAt: new Date(),
    uploadedBy: userId,
  });
};

incidentLogSchema.methods.addCommunication = function (type, channel, message, userId, recipients = []) {
  this.communication.push({
    type,
    channel,
    message,
    sentAt: new Date(),
    sentBy: userId,
    recipients,
  });
};

incidentLogSchema.methods.addInvolvedParty = function (userId, name, role, involvement, injuries = null) {
  this.involvedParties.push({
    user: userId,
    name,
    role,
    involvement,
    injuries,
    medicalAttention: !!injuries,
  });
};

incidentLogSchema.methods.resolve = function (userId, summary, outcome, followUpRequired = false) {
  this.status = 'resolved';
  this.resolution = {
    resolvedAt: new Date(),
    resolvedBy: userId,
    summary,
    outcome,
    followUpRequired,
  };
  this.addTimelineEntry('incident_resolved', `Incident resolved with outcome: ${outcome}`, userId);
};

incidentLogSchema.methods.escalate = function (userId, reason) {
  this.status = 'investigating';
  this.severity = this.severity === 'critical' ? 'critical' : 'high';
  this.addTimelineEntry('incident_escalated', `Incident escalated: ${reason}`, userId);
};

incidentLogSchema.statics.getActiveIncidents = function (eventId) {
  return this.find({
    event: eventId,
    status: { $in: ['reported', 'investigating', 'responding'] },
  }).sort({ severity: -1, createdAt: -1 });
};

incidentLogSchema.statics.getCriticalIncidents = function (eventId) {
  return this.find({
    event: eventId,
    severity: 'critical',
    status: { $ne: 'closed' },
  }).sort({ createdAt: -1 });
};

module.exports = mongoose.model('IncidentLog', incidentLogSchema);
