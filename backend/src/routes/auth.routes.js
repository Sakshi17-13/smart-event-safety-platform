const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const {
  authMiddleware,
  requireSuperAdmin,
  requireEventOrganizer,
  verifyEmail,
} = require('../middleware/auth.middleware');
const { authRateLimiter, apiRateLimiter } = require('../middleware/rateLimit.middleware');
const {
  signupSchema,
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyEmailSchema,
} = require('../validators/auth.validator');
const { validateRequest } = require('../middleware/validation.middleware');

router.post('/signup', authRateLimiter, validateRequest(signupSchema), authController.signup);
router.post('/login', authRateLimiter, validateRequest(loginSchema), authController.login);
router.post('/refresh-token', authRateLimiter, validateRequest(refreshTokenSchema), authController.refreshToken);
router.post('/refresh', authRateLimiter, validateRequest(refreshTokenSchema), authController.refreshToken);
router.post('/logout', authMiddleware, apiRateLimiter, authController.logout);
router.post('/logout-all', authMiddleware, apiRateLimiter, authController.logoutAll);
router.post('/verify-email', validateRequest(verifyEmailSchema), authController.verifyEmail);
router.post('/forgot-password', authRateLimiter, validateRequest(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', authRateLimiter, validateRequest(resetPasswordSchema), authController.resetPassword);
router.get('/profile', authMiddleware, apiRateLimiter, authController.getProfile);
router.get('/verify', authMiddleware, apiRateLimiter, authController.getProfile);
router.put('/profile', authMiddleware, apiRateLimiter, validateRequest(updateProfileSchema), authController.updateProfile);
router.post('/change-password', authMiddleware, apiRateLimiter, validateRequest(changePasswordSchema), authController.changePassword);
router.put('/users/:userId/role', requireSuperAdmin, apiRateLimiter, authController.updateRole);

module.exports = router;
