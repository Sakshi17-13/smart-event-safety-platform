const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    accuracy: {
      type: Number,
      default: null,
    },
    altitude: {
      type: Number,
      default: null,
    },
    speed: {
      type: Number,
      default: null,
    },
    heading: {
      type: Number,
      default: null,
    },
    metadata: {
      deviceInfo: {
        type: Object,
        default: {},
      },
      batteryLevel: Number,
      isCharging: Boolean,
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
        },
      ],
    },
  },
  {
    timestamps: true,
  }
);

locationSchema.index({ user: 1, timestamp: -1 });
locationSchema.index({ event: 1, timestamp: -1 });
locationSchema.index({ coordinates: '2dsphere' });
locationSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

locationSchema.virtual('latitude').get(function () {
  return this.coordinates.coordinates[1];
});

locationSchema.virtual('longitude').get(function () {
  return this.coordinates.coordinates[0];
});

locationSchema.set('toJSON', { virtuals: true });
locationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Location', locationSchema);
