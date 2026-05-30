const mongoose = require('mongoose');

const deviceTrackingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
      index: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event is required'],
      index: true,
    },
    deviceInfo: {
      deviceId: {
        type: String,
        required: [true, 'Device ID is required'],
        index: true,
      },
      deviceType: {
        type: String,
        enum: ['ios', 'android', 'web', 'other'],
        required: true,
      },
      deviceModel: String,
      osVersion: String,
      appVersion: String,
      browser: String,
      browserVersion: String,
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
      accuracy: {
        type: Number,
        min: 0,
        max: 1000,
      },
      altitude: Number,
      altitudeAccuracy: Number,
      heading: {
        type: Number,
        min: 0,
        max: 360,
      },
      speed: {
        type: Number,
        min: 0,
      },
    },
    battery: {
      level: {
        type: Number,
        min: 0,
        max: 100,
      },
      isCharging: Boolean,
    },
    network: {
      type: {
        type: String,
        enum: ['wifi', 'cellular', 'bluetooth', 'none', 'unknown'],
      },
      signalStrength: {
        type: Number,
        min: 0,
        max: 100,
      },
      connectionType: String,
    },
    activity: {
      type: {
        type: String,
        enum: ['still', 'walking', 'running', 'in_vehicle', 'on_bicycle', 'unknown'],
      },
      confidence: {
        type: Number,
        min: 0,
        max: 100,
      },
    },
    sessionInfo: {
      sessionId: {
        type: String,
        index: true,
      },
      sessionStart: Date,
      sessionEnd: Date,
      duration: Number,
    },
    geofenceStatus: {
      inside: {
        type: Boolean,
        default: true,
      },
      triggeredGeofences: [
        {
          geofenceId: mongoose.Schema.Types.ObjectId,
          name: String,
          type: String,
          triggeredAt: Date,
          action: String,
        },
      ],
    },
    metadata: {
      source: {
        type: String,
        enum: ['gps', 'network', 'passive', 'manual'],
        default: 'gps',
      },
      isBackground: {
        type: Boolean,
        default: false,
      },
      isSimulated: {
        type: Boolean,
        default: false,
      },
      rawData: mongoose.Schema.Types.Mixed,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'lost', 'offline'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

deviceTrackingSchema.index({ user: 1, event: 1, timestamp: -1 });
deviceTrackingSchema.index({ event: 1, timestamp: -1 });
deviceTrackingSchema.index({ location: '2dsphere' });
deviceTrackingSchema.index({ 'deviceInfo.deviceId': 1 });
deviceTrackingSchema.index({ 'sessionInfo.sessionId': 1 });
deviceTrackingSchema.index({ status: 1, timestamp: -1 });
deviceTrackingSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

deviceTrackingSchema.virtual('latitude').get(function () {
  return this.location.coordinates[1];
});

deviceTrackingSchema.virtual('longitude').get(function () {
  return this.location.coordinates[0];
});

deviceTrackingSchema.virtual('isMoving').get(function () {
  return this.activity && this.activity.type !== 'still' && this.speed > 0;
});

deviceTrackingSchema.virtual('batteryLow').get(function () {
  return this.battery && this.battery.level < 20;
});

deviceTrackingSchema.pre('save', function (next) {
  if (this.isNew && !this.sessionInfo.sessionId) {
    this.sessionInfo.sessionId = this.generateSessionId();
    this.sessionInfo.sessionStart = new Date();
  }

  if (this.isModified('status') && this.status === 'inactive') {
    this.sessionInfo.sessionEnd = new Date();
    if (this.sessionInfo.sessionStart) {
      this.sessionInfo.duration = this.sessionInfo.sessionEnd - this.sessionInfo.sessionStart;
    }
  }

  next();
});

deviceTrackingSchema.methods.generateSessionId = function () {
  return `SESSION-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
};

deviceTrackingSchema.methods.updateLocation = function (coordinates, accuracy, altitude, heading, speed) {
  this.location.coordinates = coordinates;
  this.location.accuracy = accuracy;
  this.location.altitude = altitude;
  this.location.heading = heading;
  this.location.speed = speed;
  this.timestamp = new Date();
};

deviceTrackingSchema.methods.updateBattery = function (level, isCharging) {
  this.battery.level = level;
  this.battery.isCharging = isCharging;
  this.timestamp = new Date();
};

deviceTrackingSchema.methods.updateActivity = function (type, confidence) {
  this.activity.type = type;
  this.activity.confidence = confidence;
  this.timestamp = new Date();
};

deviceTrackingSchema.methods.triggerGeofence = function (geofenceId, name, type, action) {
  const existingTrigger = this.geofenceStatus.triggeredGeofences.find(
    (g) => g.geofenceId.toString() === geofenceId.toString()
  );

  if (!existingTrigger) {
    this.geofenceStatus.triggeredGeofences.push({
      geofenceId,
      name,
      type,
      action,
      triggeredAt: new Date(),
    });
  }
};

deviceTrackingSchema.methods.clearGeofenceTriggers = function () {
  this.geofenceStatus.triggeredGeofences = [];
};

deviceTrackingSchema.methods.endSession = function () {
  this.status = 'inactive';
  this.sessionInfo.sessionEnd = new Date();
  if (this.sessionInfo.sessionStart) {
    this.sessionInfo.duration = this.sessionInfo.sessionEnd - this.sessionInfo.sessionStart;
  }
};

deviceTrackingSchema.statics.getUserActiveSession = function (userId, eventId) {
  return this.findOne({
    user: userId,
    event: eventId,
    status: 'active',
  }).sort({ timestamp: -1 });
};

deviceTrackingSchema.statics.getNearbyDevices = function (eventId, coordinates, radius = 100) {
  return this.find({
    event: eventId,
    status: 'active',
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: coordinates,
        },
        $maxDistance: radius,
      },
    },
  }).populate('user', 'firstName lastName email');
};

module.exports = mongoose.model('DeviceTracking', deviceTrackingSchema);
