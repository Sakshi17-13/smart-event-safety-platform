const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const authController = require('../controllers/auth.controller');
const { authMiddleware, roleMiddleware } = require('../middleware/auth.middleware');
const { apiRateLimiter } = require('../middleware/rateLimit.middleware');

router.use(authMiddleware);

router.get('/profile', apiRateLimiter, authController.getProfile);
router.put('/profile', apiRateLimiter, authController.updateProfile);
router.get('/', roleMiddleware('SUPER_ADMIN'), apiRateLimiter, userController.getUsers);
router.get('/:userId', userController.getUserById);
router.put('/:userId', roleMiddleware('SUPER_ADMIN'), userController.updateUser);
router.delete('/:userId', roleMiddleware('SUPER_ADMIN'), userController.deleteUser);
router.patch('/:userId/role', roleMiddleware('SUPER_ADMIN'), userController.updateUserRole);
router.patch('/:userId/deactivate', roleMiddleware('SUPER_ADMIN'), userController.deactivateUser);
router.patch('/:userId/activate', roleMiddleware('SUPER_ADMIN'), userController.activateUser);

module.exports = router;
