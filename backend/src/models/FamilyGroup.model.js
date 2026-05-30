const mongoose = require('mongoose');

const familyGroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Group name is required'],
      trim: true,
      minlength: [2, 'Group name must be at least 2 characters'],
      maxlength: [100, 'Group name cannot exceed 100 characters'],
    },
    code: {
      type: String,
      unique: true,
      required: [true, 'Group code is required'],
      uppercase: true,
      trim: true,
      match: [/^[A-Z0-9]{6,10}$/, 'Group code must be 6-10 alphanumeric characters'],
      index: true,
    },
    leader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Group leader is required'],
      index: true,
    },
    members: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        role: {
          type: String,
          enum: ['leader', 'adult', 'child', 'elderly'],
          default: 'adult',
        },
        relationship: {
          type: String,
          trim: true,
          enum: ['spouse', 'parent', 'child', 'sibling', 'grandparent', 'friend', 'other'],
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
        emergencyContact: {
          type: Boolean,
          default: false,
        },
        locationSharing: {
          type: Boolean,
          default: true,
        },
      },
    ],
    guardians: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        name: {
          type: String,
          trim: true,
          required: true,
        },
        relationship: {
          type: String,
          trim: true,
          default: 'guardian',
        },
        phone: {
          type: String,
          trim: true,
        },
        role: {
          type: String,
          enum: ['leader', 'guardian'],
          default: 'guardian',
        },
        emergencyContact: {
          type: Boolean,
          default: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    childMembers: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        age: {
          type: Number,
          min: 0,
          max: 18,
        },
        relationship: {
          type: String,
          trim: true,
          default: 'child',
        },
        deviceLabel: {
          type: String,
          trim: true,
        },
        wearableDeviceId: {
          type: String,
          trim: true,
          index: true,
        },
        deviceStatus: {
          type: String,
          enum: ['unpaired', 'pending', 'paired', 'offline'],
          default: 'unpaired',
        },
        paired: {
          type: Boolean,
          default: false,
        },
        connected: {
          type: Boolean,
          default: false,
        },
        pairingCode: {
          type: String,
          trim: true,
        },
        pairingCodeExpiresAt: Date,
        lastLocation: {
          type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
          },
          coordinates: {
            type: [Number],
            default: [0, 0],
          },
        },
        lastSeenAt: Date,
        batteryLevel: {
          type: Number,
          min: 0,
          max: 100,
        },
        geofenceStatus: {
          type: String,
          enum: ['inside', 'outside', 'unknown'],
          default: 'unknown',
        },
        sosActive: {
          type: Boolean,
          default: false,
        },
      },
    ],
    devicePairings: [
      {
        childMemberId: mongoose.Schema.Types.ObjectId,
        code: {
          type: String,
          required: true,
          trim: true,
        },
        deviceId: {
          type: String,
          trim: true,
        },
        status: {
          type: String,
          enum: ['pending', 'confirmed', 'expired'],
          default: 'pending',
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        confirmedAt: Date,
        expiresAt: Date,
      },
    ],
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      index: true,
    },
    geofenceSettings: {
      guardianLocation: {
        latitude: Number,
        longitude: Number,
        accuracy: Number,
        updatedAt: Date,
      },
      warningRadiusMeters: {
        type: Number,
        default: 130,
      },
      safeRadiusMeters: {
        type: Number,
        default: 170,
      },
    },
    settings: {
      locationSharing: {
        type: Boolean,
        default: true,
      },
      emergencyAlerts: {
        type: Boolean,
        default: true,
      },
      autoCheckIn: {
        type: Boolean,
        default: false,
      },
      proximityAlerts: {
        type: Boolean,
        default: true,
      },
      proximityThreshold: {
        type: Number,
        default: 50,
        min: 10,
        max: 500,
      },
      maxMembers: {
        type: Number,
        default: 10,
        min: 2,
        max: 50,
      },
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'disbanded'],
      default: 'active',
      index: true,
    },
    emergencyPlan: {
      meetingPoint: {
        type: {
          type: String,
          enum: ['Point'],
        },
        coordinates: [Number],
      },
      meetingPointName: String,
      emergencyContacts: [
        {
          name: String,
          phone: String,
          relationship: String,
        },
      ],
      medicalInfo: [
        {
          userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
          },
          conditions: [String],
          allergies: [String],
          medications: [String],
          bloodType: String,
        },
      ],
    },
    statistics: {
      totalMembers: {
        type: Number,
        default: 0,
      },
      activeMembers: {
        type: Number,
        default: 0,
      },
      alertsTriggered: {
        type: Number,
        default: 0,
      },
      checkIns: {
        type: Number,
        default: 0,
      },
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

familyGroupSchema.index({ code: 1 }, { unique: true });
familyGroupSchema.index({ leader: 1, status: 1 });
familyGroupSchema.index({ event: 1, status: 1 });
familyGroupSchema.index({ 'members.user': 1 });
familyGroupSchema.index({ 'childMembers.wearableDeviceId': 1 });
familyGroupSchema.index({ 'devicePairings.code': 1 });
familyGroupSchema.index({ createdAt: -1 });
familyGroupSchema.index({ lastActivity: -1 });

familyGroupSchema.virtual('memberCount').get(function () {
  return this.members.length;
});

familyGroupSchema.virtual('isActive').get(function () {
  return this.status === 'active';
});

familyGroupSchema.virtual('isFull').get(function () {
  return this.members.length >= this.settings.maxMembers;
});

familyGroupSchema.pre('validate', function (next) {
  if (this.isNew && !this.code) {
    this.code = this.generateGroupCode();
  }

  next();
});

familyGroupSchema.pre('save', function (next) {
  if (this.isModified('members')) {
    this.statistics.totalMembers = this.members.length;
    this.statistics.activeMembers = this.members.filter((m) => m.locationSharing).length;
    this.lastActivity = new Date();
  }

  next();
});

familyGroupSchema.methods.generateGroupCode = function () {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

familyGroupSchema.methods.addMember = function (userId, role = 'adult', relationship = 'other') {
  if (this.members.length >= this.settings.maxMembers) {
    throw new Error('Group has reached maximum capacity');
  }

  const existingMember = this.members.find((m) => m.user.toString() === userId.toString());
  if (existingMember) {
    throw new Error('User is already a member of this group');
  }

  this.members.push({
    user: userId,
    role,
    relationship,
    joinedAt: new Date(),
    locationSharing: this.settings.locationSharing,
  });

  this.statistics.totalMembers = this.members.length;
  this.lastActivity = new Date();
};

familyGroupSchema.methods.removeMember = function (userId) {
  const memberIndex = this.members.findIndex((m) => m.user.toString() === userId.toString());
  if (memberIndex === -1) {
    throw new Error('User is not a member of this group');
  }

  if (this.members[memberIndex].user.toString() === this.leader.toString()) {
    throw new Error('Cannot remove group leader');
  }

  this.members.splice(memberIndex, 1);
  this.statistics.totalMembers = this.members.length;
  this.lastActivity = new Date();
};

familyGroupSchema.methods.updateMemberRole = function (userId, role) {
  const member = this.members.find((m) => m.user.toString() === userId.toString());
  if (!member) {
    throw new Error('User is not a member of this group');
  }

  member.role = role;
  this.lastActivity = new Date();
};

familyGroupSchema.methods.setEmergencyContact = function (userId, isEmergency = true) {
  const member = this.members.find((m) => m.user.toString() === userId.toString());
  if (!member) {
    throw new Error('User is not a member of this group');
  }

  member.emergencyContact = isEmergency;
  this.lastActivity = new Date();
};

familyGroupSchema.methods.addMedicalInfo = function (userId, medicalData) {
  const existingInfo = this.emergencyPlan.medicalInfo.find((m) => m.userId.toString() === userId.toString());
  if (existingInfo) {
    Object.assign(existingInfo, medicalData);
  } else {
    this.emergencyPlan.medicalInfo.push({
      userId,
      ...medicalData,
    });
  }
  this.lastActivity = new Date();
};

familyGroupSchema.methods.transferLeadership = function (newLeaderId) {
  const newLeader = this.members.find((m) => m.user.toString() === newLeaderId.toString());
  if (!newLeader) {
    throw new Error('User is not a member of this group');
  }

  const currentLeader = this.members.find((m) => m.user.toString() === this.leader.toString());
  if (currentLeader) {
    currentLeader.role = 'adult';
  }

  newLeader.role = 'leader';
  this.leader = newLeaderId;
  this.lastActivity = new Date();
};

familyGroupSchema.methods.disband = function () {
  this.status = 'disbanded';
  this.lastActivity = new Date();
};

module.exports = mongoose.model('FamilyGroup', familyGroupSchema);
