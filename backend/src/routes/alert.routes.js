const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alert.controller');
const { authMiddleware, roleMiddleware } = require('../middleware/auth.middleware');
const { apiRateLimiter } = require('../middleware/rateLimit.middleware');

router.use(authMiddleware);

router.post('/', apiRateLimiter, alertController.createAlert);
router.get('/', apiRateLimiter, alertController.getAlerts);
router.post('/emergency', alertController.triggerEmergency);
router.get('/event/:eventId', alertController.getAlerts);
router.get('/:alertId', alertController.getAlertById);
router.post('/:alertId/acknowledge', alertController.acknowledgeAlert);
router.post('/:alertId/resolve', roleMiddleware('SUPER_ADMIN', 'EVENT_ORGANIZER'), alertController.resolveAlert);
router.patch('/:alertId/resolve', roleMiddleware('SUPER_ADMIN', 'EVENT_ORGANIZER'), alertController.resolveAlert);
router.post('/:alertId/dismiss', roleMiddleware('SUPER_ADMIN', 'EVENT_ORGANIZER'), alertController.dismissAlert);

module.exports = router;
