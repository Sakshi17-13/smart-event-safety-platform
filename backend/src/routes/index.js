const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const eventRoutes = require('./event.routes');
const userRoutes = require('./user.routes');
const locationRoutes = require('./location.routes');
const alertRoutes = require('./alert.routes');
const familyRoutes = require('./family.routes');

router.use('/auth', authRoutes);
router.use('/events', eventRoutes);
router.use('/users', userRoutes);
router.use('/locations', locationRoutes);
router.use('/alerts', alertRoutes);
router.use('/family', familyRoutes);

router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is healthy',
    data: {
      database: {
        available: req.app.locals.dbAvailable,
        status: req.app.locals.dbStatus,
        error: req.app.locals.dbError,
      },
    },
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
