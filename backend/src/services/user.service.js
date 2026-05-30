const { User } = require('../models');
const { AppError } = require('../utils/errors');

class UserService {
  sanitize(user) {
    if (!user) return user;
    const obj = user.toObject ? user.toObject() : { ...user };
    delete obj.password;
    delete obj.refreshToken;
    delete obj.verificationToken;
    delete obj.resetPasswordToken;
    delete obj.__v;
    return obj;
  }

  async getUsers(filters = {}) {
    const query = {};
    if (filters.role) query.role = filters.role;
    if (filters.isActive !== undefined) query.isActive = filters.isActive === 'true' || filters.isActive === true;
    if (filters.search) {
      query.$or = [
        { firstName: new RegExp(filters.search, 'i') },
        { lastName: new RegExp(filters.search, 'i') },
        { email: new RegExp(filters.search, 'i') },
      ];
    }

    const users = await User.find(query).sort({ createdAt: -1 }).limit(200);
    return users.map((user) => this.sanitize(user));
  }

  async getUserById(userId) {
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);
    return this.sanitize(user);
  }

  async updateUser(userId, updates) {
    const blocked = ['password', 'refreshToken', 'verificationToken', 'resetPasswordToken'];
    const safeUpdates = { ...updates };
    blocked.forEach((key) => delete safeUpdates[key]);

    const user = await User.findByIdAndUpdate(userId, safeUpdates, {
      new: true,
      runValidators: true,
    });
    if (!user) throw new AppError('User not found', 404);
    return this.sanitize(user);
  }

  async deleteUser(userId) {
    const user = await User.findByIdAndDelete(userId);
    if (!user) throw new AppError('User not found', 404);
  }

  async updateUserRole(userId, role) {
    const validRoles = ['SUPER_ADMIN', 'EVENT_ORGANIZER', 'FAMILY'];
    if (!validRoles.includes(role)) throw new AppError('Invalid role', 400);
    return this.updateUser(userId, { role });
  }

  async deactivateUser(userId) {
    return this.updateUser(userId, { isActive: false });
  }

  async activateUser(userId) {
    return this.updateUser(userId, { isActive: true });
  }
}

module.exports = new UserService();
