const express = require('express');
const router = express.Router();
const { createCampaign, sendCampaign, getCampaigns, getCampaignLogs } = require('../controllers/messagingController');
const { verifyToken, isSuperAdmin } = require('../middleware/authMiddleware');

router.post('/create', verifyToken, isSuperAdmin, createCampaign);
router.post('/send/:campaign_id', verifyToken, isSuperAdmin, sendCampaign);
router.get('/campaigns/:funeral_id', verifyToken, isSuperAdmin, getCampaigns);
router.get('/logs/:campaign_id', verifyToken, isSuperAdmin, getCampaignLogs);

module.exports = router;