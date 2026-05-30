const express = require('express');
const router = express.Router();
const eventController = require('../controllers/event.controller');
const { authMiddleware, roleMiddleware } = require('../middleware/auth.middleware');
const { apiRateLimiter } = require('../middleware/rateLimit.middleware');

router.use(authMiddleware);

router.post('/', apiRateLimiter, roleMiddleware('SUPER_ADMIN', 'EVENT_ORGANIZER'), eventController.createEvent);
router.get('/', apiRateLimiter, eventController.getEvents);
router.get('/stats', apiRateLimiter, eventController.getEventStatistics);
router.get('/:eventId', eventController.getEventById);
router.put('/:eventId', roleMiddleware('SUPER_ADMIN', 'EVENT_ORGANIZER'), eventController.updateEvent);
router.delete('/:eventId', roleMiddleware('SUPER_ADMIN', 'EVENT_ORGANIZER'), eventController.deleteEvent);
router.post('/:eventId/staff', roleMiddleware('SUPER_ADMIN', 'EVENT_ORGANIZER'), eventController.addStaff);
router.delete('/:eventId/staff/:staffId', roleMiddleware('SUPER_ADMIN', 'EVENT_ORGANIZER'), eventController.removeStaff);
router.post('/:eventId/register', eventController.registerAttendee);
router.post('/:eventId/check-in/:attendeeId', roleMiddleware('SUPER_ADMIN', 'EVENT_ORGANIZER'), eventController.checkInAttendee);
router.post('/:eventId/check-out/:attendeeId', roleMiddleware('SUPER_ADMIN', 'EVENT_ORGANIZER'), eventController.checkOutAttendee);
router.get('/:eventId/statistics', eventController.getEventStatistics);

module.exports = router;
