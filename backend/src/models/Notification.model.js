const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient is required'],
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      index: true,
    },
    alert: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Alert',
    },
    type: {
      type: String,
      enum: {
        values: [
          'alert',
          'emergency',
          'geofence',
          'check_in',
          'check_out',
          'message',
          'system',
          'invitation',
          'reminder',
          'update',
          'incident',
        ],
        message: '{VALUE} is not a valid notification type',
      },
      required: [true, 'Notification type is required'],
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent', 'critical'],
      default: 'normal',
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [2, 'Title must be at least 2 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    channels: {
      push: {
        type: Boolean,
        default: true,
      },
      email: {
        type: Boolean,
        default: false,
      },
      sms: {
        type: Boolean,
        default: false,
      },
      inApp: {
        type: Boolean,
        default: true,
      },
    },
    deliveryStatus: {
      push: {
        sent: {
          type: Boolean,
          default: false,
        },
        delivered: {
          type: Boolean,
          default: false,
        },
        failed: {
          type: Boolean,
          default: false,
        },
        error: String,
        sentAt: Date,
        deliveredAt: Date,
      },
      email: {
        sent: {
          type: Boolean,
          default: false,
        },
        delivered: {
          type: Boolean,
          default: false,
        },
        failed: {
          type: Boolean,
          default: false,
        },
        error: String,
        sentAt: Date,
        deliveredAt: Date,
      },
      sms: {
        sent: {
          type: Boolean,
          default: false,
        },
        delivered: {
          type: Boolean,
          default: false,
        },
        failed: {
          type: Boolean,
          default: false,
        },
        error: String,
        sentAt: Date,
        deliveredAt: Date,
      },
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'failed', 'read'],
      default: 'pending',
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    actionRequired: {
      type: Boolean,
      default: false,
    },
    actionType: {
      type: String,
      enum: ['confirm', 'dismiss', 'respond', 'navigate', 'check_in', 'emergency'],
    },
    actionUrl: String,
    actionData: mongoose.Schema.Types.Mixed,
    retryCount: {
      type: Number,
      default: 0,
    },
    maxRetries: {
      type: Number,
      default: 3,
    },
    metadata: {
      category: String,
      source: String,
      campaign: String,
      tags: [String],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

notificationSchema.index({ recipient: 1, status: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, readAt: 1 });
notificationSchema.index({ event: 1, type: 1 });
notificationSchema.index({ alert: 1 });
notificationSchema.index({ status: 1, priority: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
notificationSchema.index({ createdAt: -1 });

notificationSchema.virtual('isRead').get(function () {
  return !!this.readAt;
});

notificationSchema.virtual('isExpired').get(function () {
  return this.expiresAt && new Date() > this.expiresAt;
});

notificationSchema.virtual('deliverySuccessful').get(function () {
  return this.status === 'delivered' || this.status === 'read';
});

notificationSchema.virtual('canRetry').get(function () {
  return this.status === 'failed' && this.retryCount < this.maxRetries;
});

notificationSchema.pre('save', function (next) {
  if (this.isModified('readAt') && this.readAt && !this.isRead) {
    this.status = 'read';
  }

  if (this.isModified('deliveryStatus')) {
    const allChannels = ['push', 'email', 'sms'];
    let allSent = true;
    let anyDelivered = false;

    for (const channel of allChannels) {
      if (this.channels[channel]) {
        if (!this.deliveryStatus[channel].sent) {
          allSent = false;
        }
        if (this.deliveryStatus[channel].delivered) {
          anyDelivered = true;
        }
      }
    }

    if (allSent && this.status === 'pending') {
      this.status = 'sent';
    }

    if (anyDelivered && this.status !== 'read') {
      this.status = 'delivered';
    }
  }

  next();
});

notificationSchema.methods.markAsRead = function () {
  this.readAt = new Date();
  this.status = 'read';
};

notificationSchema.methods.markAsSent = function (channel) {
  if (this.channels[channel]) {
    this.deliveryStatus[channel].sent = true;
    this.deliveryStatus[channel].sentAt = new Date();
  }
};

notificationSchema.methods.markAsDelivered = function (channel) {
  if (this.channels[channel]) {
    this.deliveryStatus[channel].delivered = true;
    this.deliveryStatus[channel].deliveredAt = new Date();
  }
};

notificationSchema.methods.markAsFailed = function (channel, error) {
  if (this.channels[channel]) {
    this.deliveryStatus[channel].failed = true;
    this.deliveryStatus[channel].error = error;
    this.retryCount += 1;
  }
};

notificationSchema.methods.setExpiration = function (hours = 24) {
  this.expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
};

notificationSchema.methods.addAction = function (type, url, data = null) {
  this.actionRequired = true;
  this.actionType = type;
  this.actionUrl = url;
  if (data) {
    this.actionData = data;
  }
};

notificationSchema.methods.enableChannel = function (channel) {
  if (['push', 'email', 'sms', 'inApp'].includes(channel)) {
    this.channels[channel] = true;
  }
};

notificationSchema.methods.disableChannel = function (channel) {
  if (['push', 'email', 'sms', 'inApp'].includes(channel)) {
    this.channels[channel] = false;
  }
};

notificationSchema.statics.getUnreadNotifications = function (userId) {
  return this.find({
    recipient: userId,
    readAt: null,
    status: { $ne: 'failed' },
  }).sort({ priority: -1, createdAt: -1 });
};

notificationSchema.statics.getUrgentNotifications = function (userId) {
  return this.find({
    recipient: userId,
    priority: { $in: ['urgent', 'critical'] },
    readAt: null,
    status: { $ne: 'failed' },
  }).sort({ priority: -1, createdAt: -1 });
};

notificationSchema.statics.getNotificationsByEvent = function (eventId, userId = null) {
  const query = { event: eventId };
  if (userId) {
    query.recipient = userId;
  }
  return this.find(query).sort({ createdAt: -1 });
};

notificationSchema.statics.markAllAsRead = function (userId) {
  return this.updateMany(
    {
      recipient: userId,
      readAt: null,
    },
    {
      readAt: new Date(),
      status: 'read',
    }
  );
};

notificationSchema.statics.cleanupExpired = function () {
  return this.deleteMany({
    expiresAt: { $lt: new Date() },
    status: { $in: ['pending', 'sent'] },
  });
};

module.exports = mongoose.model('Notification', notificationSchema);
