const mongoose = require('mongoose');

const organizerAssignmentSchema = new mongoose.Schema(
  {
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Organizer is required'],
      index: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event is required'],
      index: true,
    },
    role: {
      type: String,
      enum: {
        values: ['primary', 'co_organizer', 'assistant', 'supervisor', 'coordinator'],
        message: '{VALUE} is not a valid organizer role',
      },
      required: [true, 'Role is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended', 'revoked', 'completed'],
      default: 'pending',
      index: true,
    },
    permissions: {
      eventManagement: {
        create: {
          type: Boolean,
          default: false,
        },
        edit: {
          type: Boolean,
          default: false,
        },
        delete: {
          type: Boolean,
          default: false,
        },
        publish: {
          type: Boolean,
          default: false,
        },
      },
      attendeeManagement: {
        view: {
          type: Boolean,
          default: true,
        },
        add: {
          type: Boolean,
          default: false,
        },
        remove: {
          type: Boolean,
          default: false,
        },
        checkIn: {
          type: Boolean,
          default: true,
        },
        checkOut: {
          type: Boolean,
          default: true,
        },
        ban: {
          type: Boolean,
          default: false,
        },
      },
      staffManagement: {
        view: {
          type: Boolean,
          default: true,
        },
        add: {
          type: Boolean,
          default: false,
        },
        remove: {
          type: Boolean,
          default: false,
        },
        assign: {
          type: Boolean,
          default: false,
        },
      },
      alertManagement: {
        view: {
          type: Boolean,
          default: true,
        },
        create: {
          type: Boolean,
          default: true,
        },
        acknowledge: {
          type: Boolean,
          default: true,
        },
        resolve: {
          type: Boolean,
          default: false,
        },
        dismiss: {
          type: Boolean,
          default: false,
        },
      },
      incidentManagement: {
        view: {
          type: Boolean,
          default: true,
        },
        create: {
          type: Boolean,
          default: true,
        },
        edit: {
          type: Boolean,
          default: false,
        },
        resolve: {
          type: Boolean,
          default: false,
        },
        escalate: {
          type: Boolean,
          default: false,
        },
      },
      analytics: {
        view: {
          type: Boolean,
          default: true,
        },
        export: {
          type: Boolean,
          default: false,
        },
      },
      communication: {
        broadcast: {
          type: Boolean,
          default: false,
        },
        direct: {
          type: Boolean,
          default: true,
        },
        emergency: {
          type: Boolean,
          default: true,
        },
      },
      geofencing: {
        view: {
          type: Boolean,
          default: true,
        },
        create: {
          type: Boolean,
          default: false,
        },
        edit: {
          type: Boolean,
          default: false,
        },
        delete: {
          type: Boolean,
          default: false,
        },
      },
      settings: {
        view: {
          type: Boolean,
          default: true,
        },
        edit: {
          type: Boolean,
          default: false,
        },
      },
    },
    assignedAreas: [
      {
        name: String,
        description: String,
        location: {
          type: {
            type: String,
            enum: ['Point'],
          },
          coordinates: [Number],
        },
        radius: Number,
        responsibilities: [String],
      },
    ],
    responsibilities: [String],
    schedule: {
      startDate: Date,
      endDate: Date,
      shifts: [
        {
          name: String,
          startTime: String,
          endTime: String,
          daysOfWeek: [Number],
        },
      ],
    },
    contact: {
      phone: String,
      email: String,
      radioChannel: String,
      alternateContact: String,
    },
    performance: {
      eventsOrganized: {
        type: Number,
        default: 0,
      },
      attendeesManaged: {
        type: Number,
        default: 0,
      },
      alertsHandled: {
        type: Number,
        default: 0,
      },
      incidentsResolved: {
        type: Number,
        default: 0,
      },
      averageResponseTime: Number,
      rating: {
        type: Number,
        min: 1,
        max: 5,
        default: null,
      },
      feedback: [
        {
          from: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
          },
          rating: Number,
          comment: String,
          date: {
            type: Date,
            default: Date.now,
          },
        },
      ],
    },
    notes: {
      type: String,
      maxlength: [2000, 'Notes cannot exceed 2000 characters'],
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    activatedAt: Date,
    suspendedAt: Date,
    revokedAt: Date,
    completedAt: Date,
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    revocationReason: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

organizerAssignmentSchema.index({ organizer: 1, status: 1 });
organizerAssignmentSchema.index({ event: 1, status: 1 });
organizerAssignmentSchema.index({ event: 1, role: 1 });
organizerAssignmentSchema.index({ organizer: 1, event: 1 }, { unique: true });
organizerAssignmentSchema.index({ assignedAt: -1 });
organizerAssignmentSchema.index({ status: 1, role: 1 });

organizerAssignmentSchema.virtual('isActive').get(function () {
  return this.status === 'active';
});

organizerAssignmentSchema.virtual('isPrimary').get(function () {
  return this.role === 'primary';
});

organizerAssignmentSchema.virtual('assignmentDuration').get(function () {
  if (this.activatedAt && (this.completedAt || this.revokedAt || this.suspendedAt)) {
    return (this.completedAt || this.revokedAt || this.suspendedAt) - this.activatedAt;
  }
  if (this.activatedAt) {
    return Date.now() - this.activatedAt;
  }
  return null;
});

organizerAssignmentSchema.virtual('hasFullPermissions').get(function () {
  return this.role === 'primary';
});

organizerAssignmentSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    const now = new Date();

    switch (this.status) {
      case 'active':
        if (!this.activatedAt) {
          this.activatedAt = now;
        }
        break;
      case 'suspended':
        this.suspendedAt = now;
        break;
      case 'revoked':
        this.revokedAt = now;
        break;
      case 'completed':
        this.completedAt = now;
        break;
    }
  }

  if (this.isNew && this.role === 'primary') {
    this.permissions = this.grantFullPermissions();
  }

  next();
});

organizerAssignmentSchema.methods.grantFullPermissions = function () {
  return {
    eventManagement: {
      create: true,
      edit: true,
      delete: true,
      publish: true,
    },
    attendeeManagement: {
      view: true,
      add: true,
      remove: true,
      checkIn: true,
      checkOut: true,
      ban: true,
    },
    staffManagement: {
      view: true,
      add: true,
      remove: true,
      assign: true,
    },
    alertManagement: {
      view: true,
      create: true,
      acknowledge: true,
      resolve: true,
      dismiss: true,
    },
    incidentManagement: {
      view: true,
      create: true,
      edit: true,
      resolve: true,
      escalate: true,
    },
    analytics: {
      view: true,
      export: true,
    },
    communication: {
      broadcast: true,
      direct: true,
      emergency: true,
    },
    geofencing: {
      view: true,
      create: true,
      edit: true,
      delete: true,
    },
    settings: {
      view: true,
      edit: true,
    },
  };
};

organizerAssignmentSchema.methods.activate = function () {
  this.status = 'active';
  if (!this.activatedAt) {
    this.activatedAt = new Date();
  }
};

organizerAssignmentSchema.methods.suspend = function (reason) {
  this.status = 'suspended';
  this.notes = reason || this.notes;
};

organizerAssignmentSchema.methods.revoke = function (revokedBy, reason) {
  this.status = 'revoked';
  this.revokedBy = revokedBy;
  this.revocationReason = reason;
};

organizerAssignmentSchema.methods.complete = function () {
  this.status = 'completed';
  if (!this.completedAt) {
    this.completedAt = new Date();
  }
};

organizerAssignmentSchema.methods.updatePermission = function (category, permission, value) {
  if (this.permissions[category] && typeof this.permissions[category][permission] === 'boolean') {
    this.permissions[category][permission] = value;
  }
};

organizerAssignmentSchema.methods.hasPermission = function (category, permission) {
  if (this.role === 'primary') return true;
  return this.permissions[category] && this.permissions[category][permission];
};

organizerAssignmentSchema.methods.addAssignedArea = function (name, description, location, radius, responsibilities) {
  this.assignedAreas.push({
    name,
    description,
    location,
    radius,
    responsibilities,
  });
};

organizerAssignmentSchema.methods.removeAssignedArea = function (areaId) {
  this.assignedAreas = this.assignedAreas.filter((area) => area._id.toString() !== areaId.toString());
};

organizerAssignmentSchema.methods.addShift = function (name, startTime, endTime, daysOfWeek) {
  this.schedule.shifts.push({
    name,
    startTime,
    endTime,
    daysOfWeek,
  });
};

organizerAssignmentSchema.methods.updatePerformance = function (metrics) {
  if (metrics.eventsOrganized !== undefined) {
    this.performance.eventsOrganized = metrics.eventsOrganized;
  }
  if (metrics.attendeesManaged !== undefined) {
    this.performance.attendeesManaged = metrics.attendeesManaged;
  }
  if (metrics.alertsHandled !== undefined) {
    this.performance.alertsHandled = metrics.alertsHandled;
  }
  if (metrics.incidentsResolved !== undefined) {
    this.performance.incidentsResolved = metrics.incidentsResolved;
  }
  if (metrics.averageResponseTime !== undefined) {
    this.performance.averageResponseTime = metrics.averageResponseTime;
  }
};

organizerAssignmentSchema.methods.addFeedback = function (fromUser, rating, comment) {
  this.performance.feedback.push({
    from: fromUser,
    rating,
    comment,
    date: new Date(),
  });

  this.updateAverageRating();
};

organizerAssignmentSchema.methods.updateAverageRating = function () {
  if (this.performance.feedback.length > 0) {
    const sum = this.performance.feedback.reduce((acc, f) => acc + f.rating, 0);
    this.performance.rating = sum / this.performance.feedback.length;
  }
};

organizerAssignmentSchema.statics.getActiveOrganizers = function (eventId) {
  return this.find({
    event: eventId,
    status: 'active',
  })
    .populate('organizer', 'firstName lastName email phone')
    .sort({ role: 1, assignedAt: 1 });
};

organizerAssignmentSchema.statics.getByOrganizer = function (organizerId, status = null) {
  const query = { organizer: organizerId };
  if (status) {
    query.status = status;
  }
  return this.find(query)
    .populate('event', 'name schedule status')
    .sort({ assignedAt: -1 });
};

organizerAssignmentSchema.statics.getPrimaryOrganizer = function (eventId) {
  return this.findOne({
    event: eventId,
    role: 'primary',
    status: 'active',
  }).populate('organizer', 'firstName lastName email phone');
};

module.exports = mongoose.model('OrganizerAssignment', organizerAssignmentSchema);
