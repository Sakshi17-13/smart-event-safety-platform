const express = require('express');
const router = express.Router();
const familyController = require('../controllers/family.controller');
const { authMiddleware, roleMiddleware } = require('../middleware/auth.middleware');

router.get('/events/nearby', authMiddleware, familyController.browseNearbyEvents);
router.post('/events/:eventId/register', authMiddleware, roleMiddleware('FAMILY'), familyController.registerEvent);
router.post('/groups', authMiddleware, roleMiddleware('FAMILY'), familyController.createFamilyGroup);
router.get('/groups/mine', authMiddleware, familyController.getMyFamilyGroups);
router.patch('/groups/:groupId', authMiddleware, roleMiddleware('FAMILY'), familyController.updateFamilyGroup);
router.delete('/groups/:groupId', authMiddleware, roleMiddleware('FAMILY'), familyController.deleteFamilyGroup);
router.post('/groups/:groupId/children', authMiddleware, roleMiddleware('FAMILY'), familyController.addChildMember);
router.patch('/groups/:groupId/children/:childMemberId', authMiddleware, roleMiddleware('FAMILY'), familyController.updateChildMember);
router.delete('/groups/:groupId/children/:childMemberId', authMiddleware, roleMiddleware('FAMILY'), familyController.removeChildMember);
router.post('/groups/:groupId/children/:childMemberId/pairing-code', authMiddleware, roleMiddleware('FAMILY'), familyController.generatePairingCode);
router.post('/groups/:groupId/guardians', authMiddleware, roleMiddleware('FAMILY'), familyController.addGuardian);
router.patch('/groups/:groupId/guardians/:guardianId', authMiddleware, roleMiddleware('FAMILY'), familyController.updateGuardian);
router.delete('/groups/:groupId/guardians/:guardianId', authMiddleware, roleMiddleware('FAMILY'), familyController.removeGuardian);
router.post('/devices/confirm-pairing', familyController.confirmPairing);
router.post('/devices/:deviceId/location', familyController.updateDeviceLocation);
router.get('/organizer/events/:eventId/family-summary', authMiddleware, roleMiddleware('SUPER_ADMIN', 'EVENT_ORGANIZER'), familyController.getOrganizerFamilySummary);

module.exports = router;
