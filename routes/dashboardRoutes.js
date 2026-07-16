const express = require('express');
const router = express.Router();
const { getSuperAdminDashboard, getFuneralAdminDashboard, getTellerDashboard, generateReport } = require('../controllers/dashboardController');
const { verifyToken, isSuperAdmin, isFuneralAdmin } = require('../middleware/authMiddleware');

router.get('/super-admin', verifyToken, isSuperAdmin, getSuperAdminDashboard);
router.get('/funeral-admin/:funeral_id', verifyToken, isFuneralAdmin, getFuneralAdminDashboard);
router.get('/teller', verifyToken, getTellerDashboard);
router.get('/report', verifyToken, isFuneralAdmin, generateReport);

module.exports = router;