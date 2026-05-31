const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Event name is required'],
      trim: true,
      minlength: [3, 'Event name must be at least 3 characters'],
      maxlength: [200, 'Event name cannot exceed 200 characters'],
      index: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Organizer is required'],
      index: true,
    },
    category: {
      type: String,
      enum: {
        values: ['concert', 'conference', 'festival', 'sports', 'exhibition', 'wedding', 'corporate', 'other'],
        message: '{VALUE} is not a valid event category',
      },
      default: 'other',
      index: true,
    },
    venue: {
      name: {
        type: String,
        required: [true, 'Venue name is required'],
        trim: true,
      },
      address: {
        street: {
          type: String,
          trim: true,
        },
        city: {
          type: String,
          required: [true, 'City is required'],
          trim: true,
        },
        state: {
          type: String,
          trim: true,
        },
        country: {
          type: String,
          required: [true, 'Country is required'],
          trim: true,
        },
        zipCode: {
          type: String,
          trim: true,
        },
      },
      location: {
        type: {
          type: String,
          enum: ['Point'],
          required: true,
        },
        coordinates: {
          type: [Number],
          required: true,
          validate: {
            validator: function (v) {
              return v.length === 2 && v[0] >= -180 && v[0] <= 180 && v[1] >= -90 && v[1] <= 90;
            },
            message: 'Invalid coordinates',
          },
        },
      },
      capacity: {
        type: Number,
        required: [true, 'Venue capacity is required'],
        min: [1, 'Capacity must be at least 1'],
        max: [1000000, 'Capacity cannot exceed 1,000,000'],
      },
      facilities: [String],
      accessInstructions: String,
    },
    safetyRadiusMeters: {
      type: Number,
      required: [true, 'Active festival radius is required'],
      default: 170,
      min: [10, 'Active festival radius must be at least 10 meters'],
      max: [100000, 'Active festival radius cannot exceed 100,000 meters'],
    },
    privacyBoundary: {
      activeFestivalRadiusMeters: {
        type: Number,
        default: 170,
        min: 10,
      },
      nearBoundaryThreshold: {
        type: Number,
        default: 0.85,
        min: 0.5,
        max: 0.98,
      },
      autoExpireAfterInactiveMinutes: {
        type: Number,
        default: 20,
        min: 1,
        max: 1440,
      },
    },
    schedule: {
      startDate: {
        type: Date,
        required: [true, 'Start date is required'],
        index: true,
      },
      endDate: {
        type: Date,
        required: [true, 'End date is required'],
        index: true,
      },
      timezone: {
        type: String,
        default: 'UTC',
        validate: {
          validator: function (v) {
            return /^([A-Za-z]+\/[A-Za-z_]+)$/.test(v);
          },
          message: 'Invalid timezone format',
        },
      },
      checkInStart: Date,
      checkInEnd: Date,
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'published', 'active', 'ongoing', 'completed', 'cancelled', 'suspended'],
        message: '{VALUE} is not a valid event status',
      },
      default: 'draft',
      index: true,
    },
    settings: {
      public: {
        type: Boolean,
        default: false,
      },
      requireRegistration: {
        type: Boolean,
        default: true,
      },
      requireApproval: {
        type: Boolean,
        default: false,
      },
      enableGeofencing: {
        type: Boolean,
        default: true,
      },
      enableEmergencyAlerts: {
        type: Boolean,
        default: true,
      },
      enableAnalytics: {
        type: Boolean,
        default: true,
      },
      checkInRequired: {
        type: Boolean,
        default: false,
      },
      allowFamilyGroups: {
        type: Boolean,
        default: true,
      },
      maxGroupSize: {
        type: Number,
        default: 10,
        min: 1,
        max: 50,
      },
      locationTrackingInterval: {
        type: Number,
        default: 5000,
        min: 1000,
        max: 60000,
      },
    },
    geofences: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        type: {
          type: String,
          enum: ['circle', 'polygon'],
          required: true,
        },
        coordinates: {
          type: mongoose.Schema.Types.Mixed,
          required: true,
        },
        radius: {
          type: Number,
          required: function () {
            return this.type === 'circle';
          },
          min: 1,
        },
        alertType: {
          type: String,
          enum: ['entry', 'exit', 'both'],
          default: 'both',
        },
        severity: {
          type: String,
          enum: ['info', 'warning', 'danger', 'critical'],
          default: 'warning',
        },
        isActive: {
          type: Boolean,
          default: true,
        },
        notificationChannels: {
          type: [String],
          enum: ['push', 'sms', 'email', 'in-app'],
          default: ['push', 'in-app'],
        },
      },
    ],
    staff: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        role: {
          type: String,
          enum: ['admin', 'security', 'medical', 'volunteer', 'coordinator'],
          default: 'volunteer',
          required: true,
        },
        permissions: [String],
        assignedAreas: [String],
        isActive: {
          type: Boolean,
          default: true,
        },
        assignedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    attendees: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        status: {
          type: String,
          enum: ['registered', 'approved', 'checked-in', 'checked-out', 'banned'],
          default: 'registered',
        },
        ticketId: {
          type: String,
          unique: true,
          sparse: true,
        },
        ticketType: String,
        checkInTime: Date,
        checkOutTime: Date,
        checkInLocation: {
          type: {
            type: String,
            enum: ['Point'],
          },
          coordinates: [Number],
        },
        familyGroupId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'FamilyGroup',
        },
        notes: String,
        registeredAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    statistics: {
      totalAttendees: {
        type: Number,
        default: 0,
      },
      checkedIn: {
        type: Number,
        default: 0,
      },
      checkedOut: {
        type: Number,
        default: 0,
      },
      activeAlerts: {
        type: Number,
        default: 0,
      },
      peakAttendance: {
        type: Number,
        default: 0,
      },
      peakTime: Date,
      averageDuration: Number,
      totalAlerts: {
        type: Number,
        default: 0,
      },
      totalIncidents: {
        type: Number,
        default: 0,
      },
    },
    emergencyContacts: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        phone: {
          type: String,
          required: true,
          trim: true,
          match: [/^\+?[\d\s-()]+$/, 'Please provide a valid phone number'],
        },
        role: {
          type: String,
          required: true,
          trim: true,
        },
        email: {
          type: String,
          trim: true,
          match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
        },
        priority: {
          type: Number,
          default: 1,
          min: 1,
          max: 10,
        },
      },
    ],
    safetyProtocols: {
      evacuationRoutes: [String],
      assemblyPoints: [
        {
          name: String,
          location: {
            type: {
              type: String,
              enum: ['Point'],
            },
            coordinates: [Number],
          },
          capacity: Number,
        },
      ],
      medicalStations: [
        {
          name: String,
          location: {
            type: {
              type: String,
              enum: ['Point'],
            },
            coordinates: [Number],
          },
          staff: Number,
        },
      ],
      securityPosts: [
        {
          name: String,
          location: {
            type: {
              type: String,
              enum: ['Point'],
            },
            coordinates: [Number],
          },
          contact: String,
        },
      ],
    },
    media: {
      imageUrl: String,
      images: [String],
      videos: [String],
      documents: [
        {
          name: String,
          url: String,
          type: String,
        },
      ],
    },
    tags: {
      type: [String],
      validate: {
        validator: function (v) {
          return v.length <= 20;
        },
        message: 'Cannot have more than 20 tags',
      },
    },
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

eventSchema.index({ organizer: 1, status: 1 });
eventSchema.index({ status: 1, 'schedule.startDate': 1 });
eventSchema.index({ 'schedule.startDate': 1, 'schedule.endDate': 1 });
eventSchema.index({ 'venue.location': '2dsphere' });
eventSchema.index({ 'attendees.user': 1 });
eventSchema.index({ tags: 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ slug: 1 }, { unique: true });
eventSchema.index({ 'staff.user': 1 });
eventSchema.index({ createdAt: -1 });

eventSchema.virtual('isOngoing').get(function () {
  const now = new Date();
  return now >= this.schedule.startDate && now <= this.schedule.endDate;
});

eventSchema.virtual('isUpcoming').get(function () {
  const now = new Date();
  return now < this.schedule.startDate;
});

eventSchema.virtual('isPast').get(function () {
  const now = new Date();
  return now > this.schedule.endDate;
});

eventSchema.virtual('duration').get(function () {
  return this.schedule.endDate - this.schedule.startDate;
});

eventSchema.virtual('durationInHours').get(function () {
  return this.duration / (1000 * 60 * 60);
});

eventSchema.virtual('attendanceRate').get(function () {
  if (this.venue.capacity === 0) return 0;
  return (this.statistics.checkedIn / this.venue.capacity) * 100;
});

eventSchema.virtual('occupancyRate').get(function () {
  if (this.venue.capacity === 0) return 0;
  return (this.statistics.totalAttendees / this.venue.capacity) * 100;
});

eventSchema.pre('save', async function (next) {
  if (this.name && !this.slug) {
    const slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    this.slug = `${slug}-${Date.now().toString(36)}`;
  }

  if (this.isModified('attendees')) {
    this.statistics.totalAttendees = this.attendees.length;
    this.statistics.checkedIn = this.attendees.filter((a) => a.status === 'checked-in').length;
    this.statistics.checkedOut = this.attendees.filter((a) => a.status === 'checked-out').length;

    if (this.statistics.checkedIn > this.statistics.peakAttendance) {
      this.statistics.peakAttendance = this.statistics.checkedIn;
      this.statistics.peakTime = new Date();
    }
  }

  if (this.isModified('schedule.startDate') || this.isModified('schedule.endDate')) {
    if (this.schedule.startDate >= this.schedule.endDate) {
      next(new Error('End date must be after start date'));
      return;
    }
  }

  next();
});

eventSchema.methods.addAttendee = function (userId, ticketId = null) {
  const existingAttendee = this.attendees.find((a) => a.user.toString() === userId.toString());
  if (existingAttendee) {
    throw new Error('User already registered for this event');
  }

  this.attendees.push({
    user: userId,
    ticketId: ticketId || `TICKET-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    status: 'registered',
  });

  this.statistics.totalAttendees = this.attendees.length;
};

eventSchema.methods.checkInAttendee = function (userId, location) {
  const attendee = this.attendees.find((a) => a.user.toString() === userId.toString());
  if (!attendee) {
    throw new Error('Attendee not found');
  }

  if (attendee.status === 'checked-in') {
    throw new Error('Attendee already checked in');
  }

  attendee.status = 'checked-in';
  attendee.checkInTime = new Date();
  if (location) {
    attendee.checkInLocation = location;
  }

  this.statistics.checkedIn = this.attendees.filter((a) => a.status === 'checked-in').length;

  if (this.statistics.checkedIn > this.statistics.peakAttendance) {
    this.statistics.peakAttendance = this.statistics.checkedIn;
    this.statistics.peakTime = new Date();
  }
};

eventSchema.methods.checkOutAttendee = function (userId) {
  const attendee = this.attendees.find((a) => a.user.toString() === userId.toString());
  if (!attendee) {
    throw new Error('Attendee not found');
  }

  if (attendee.status !== 'checked-in') {
    throw new Error('Attendee is not checked in');
  }

  attendee.status = 'checked-out';
  attendee.checkOutTime = new Date();

  this.statistics.checkedIn = this.attendees.filter((a) => a.status === 'checked-in').length;
  this.statistics.checkedOut = this.attendees.filter((a) => a.status === 'checked-out').length;
};

eventSchema.methods.addStaff = function (userId, role, permissions = [], assignedAreas = []) {
  const existingStaff = this.staff.find((s) => s.user.toString() === userId.toString());
  if (existingStaff) {
    throw new Error('User already assigned as staff');
  }

  this.staff.push({
    user: userId,
    role,
    permissions,
    assignedAreas,
    isActive: true,
    assignedAt: new Date(),
  });
};

eventSchema.methods.removeStaff = function (userId) {
  this.staff = this.staff.filter((s) => s.user.toString() !== userId.toString());
};

eventSchema.methods.updateStatistics = function () {
  this.statistics.totalAttendees = this.attendees.length;
  this.statistics.checkedIn = this.attendees.filter((a) => a.status === 'checked-in').length;
  this.statistics.checkedOut = this.attendees.filter((a) => a.status === 'checked-out').length;
};

module.exports = mongoose.model('Event', eventSchema);
