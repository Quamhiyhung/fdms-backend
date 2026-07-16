const express = require('express');
const router = express.Router();
const {
  createFuneral, getAllFunerals, getFuneral, updateFuneralStatus, assignUserToFuneral,
  getUsersByRole, getFuneralAssignments, getMyAssignedFunerals, removeAssignment,
  editFuneral, deleteFuneral, archiveFuneral, closeFuneral, unarchiveFuneral, reopenFuneral
} = require('../controllers/funeralController');
const { verifyToken, isSuperAdmin, isFuneralAdmin } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

router.post('/create', verifyToken, isSuperAdmin, upload.single('photo'), createFuneral);
router.get('/all', verifyToken, getAllFunerals);
router.get('/my-assigned', verifyToken, getMyAssignedFunerals);
router.get('/users/:role_id', verifyToken, isSuperAdmin, getUsersByRole);
router.get('/:id', verifyToken, getFuneral);
router.put('/:id/status', verifyToken, isSuperAdmin, updateFuneralStatus);
router.put('/:id/edit', verifyToken, isSuperAdmin, upload.single('photo'), editFuneral);
router.delete('/:id/delete', verifyToken, isSuperAdmin, deleteFuneral);
router.put('/:id/archive', verifyToken, isSuperAdmin, archiveFuneral);
router.put('/:id/unarchive', verifyToken, isSuperAdmin, unarchiveFuneral);
router.put('/:id/close', verifyToken, isFuneralAdmin, closeFuneral);
router.put('/:id/reopen', verifyToken, isSuperAdmin, reopenFuneral);
router.post('/assign', verifyToken, isSuperAdmin, assignUserToFuneral);
router.get('/:funeral_id/assignments', verifyToken, isSuperAdmin, getFuneralAssignments);
router.delete('/assignments/:id', verifyToken, isSuperAdmin, removeAssignment);

module.exports = router;