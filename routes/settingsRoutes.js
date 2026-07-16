const express = require('express');
const router = express.Router();
const { getSettings, updateSetting, generateBackup, getPublicSetting } = require('../controllers/settingsController');
const { verifyToken, isSuperAdmin } = require('../middleware/authMiddleware');

router.get('/', verifyToken, isSuperAdmin, getSettings);
router.get('/public/:key', verifyToken, getPublicSetting);
router.put('/:key', verifyToken, isSuperAdmin, updateSetting);
router.get('/backup/generate', verifyToken, isSuperAdmin, generateBackup);

module.exports = router;