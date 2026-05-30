const express = require('express');
const router = express.Router();
const locationController = require('../controllers/location.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const { apiRateLimiter } = require('../middleware/rateLimit.middleware');

router.use(authMiddleware);

router.post('/update', apiRateLimiter, locationController.updateLocation);
router.get('/user/:userId', locationController.getUserLocations);
router.get('/event/:eventId', locationController.getEventLocations);
router.post('/nearby', locationController.getNearbyUsers);
router.get('/event/:eventId/heatmap', locationController.getHeatmapData);

module.exports = router;
