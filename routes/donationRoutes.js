const express = require('express');
const router = express.Router();
const { addRecipient, getRecipients, recordDonation, getFuneralDonations, getTellerDonations, getFuneralTotals, editDonation, deleteDonation, searchDonations, requestDonationEdit, getPendingEditRequests, approveEditRequest, rejectEditRequest, getDonationById } = require('../controllers/donationController');
const { verifyToken, isFuneralAdmin } = require('../middleware/authMiddleware');

router.post('/recipients/add', verifyToken, isFuneralAdmin, addRecipient);
router.get('/recipients/:funeral_id', verifyToken, getRecipients);
router.post('/record', verifyToken, recordDonation);
router.get('/search', verifyToken, searchDonations);
router.get('/funeral/:funeral_id', verifyToken, isFuneralAdmin, getFuneralDonations);
router.get('/my-donations', verifyToken, getTellerDonations);
router.get('/totals/:funeral_id', verifyToken, getFuneralTotals);
router.get('/:id', verifyToken, getDonationById);
router.put('/:id/edit', verifyToken, isFuneralAdmin, editDonation);
router.delete('/:id/delete', verifyToken, isFuneralAdmin, deleteDonation);
router.post('/:id/request-edit', verifyToken, requestDonationEdit);
router.get('/edit-requests/pending', verifyToken, isFuneralAdmin, getPendingEditRequests);
router.put('/edit-requests/:id/approve', verifyToken, isFuneralAdmin, approveEditRequest);
router.put('/edit-requests/:id/reject', verifyToken, isFuneralAdmin, rejectEditRequest);

module.exports = router;