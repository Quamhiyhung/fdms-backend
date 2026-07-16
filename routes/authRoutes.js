const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getAllUsers, editUser, deleteUser, toggleUserActive, changeOwnPassword, changeUserPassword, getAuditLogs, restoreFromLog } = require('../controllers/authController');
const { verifyToken, isSuperAdmin } = require('../middleware/authMiddleware');


router.post('/register', verifyToken, isSuperAdmin, registerUser);
router.post('/login', loginUser);
router.get('/users', verifyToken, isSuperAdmin, getAllUsers);
router.put('/users/:id/edit', verifyToken, isSuperAdmin, editUser);
router.delete('/users/:id/delete', verifyToken, isSuperAdmin, deleteUser);
router.put('/users/:id/toggle-active', verifyToken, isSuperAdmin, toggleUserActive);
router.put('/change-password', verifyToken, changeOwnPassword);
router.put('/users/:id/change-password', verifyToken, isSuperAdmin, changeUserPassword);
router.get('/audit-logs', verifyToken, isSuperAdmin, getAuditLogs);
router.put('/audit-logs/:log_id/restore', verifyToken, isSuperAdmin, restoreFromLog);

module.exports = router;