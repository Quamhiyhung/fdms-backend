const pool = require('../config/db');
const { logAudit } = require('../middleware/auditLogger');

// Generate Receipt Number
const generateReceiptNumber = () => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `RCP-${timestamp}-${random}`;
};

// Add Recipient
const addRecipient = async (req, res) => {
  const { funeral_id, name } = req.body;
  try {
    const recipient = await pool.query(
      'INSERT INTO recipients (funeral_id, name) VALUES ($1, $2) RETURNING *',
      [funeral_id, name]
    );
    res.status(201).json({ message: 'Recipient added successfully', recipient: recipient.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get Recipients by Funeral
const getRecipients = async (req, res) => {
  const { funeral_id } = req.params;
  try {
    const recipients = await pool.query(
      'SELECT * FROM recipients WHERE funeral_id = $1',
      [funeral_id]
    );
    res.json({ recipients: recipients.rows });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Record Donation
const recordDonation = async (req, res) => {
  const { funeral_id, donor_name, phone_number, amount, recipient_ids, payment_method, notes } = req.body;
  try {
    if (!recipient_ids || recipient_ids.length === 0) {
      return res.status(400).json({ message: 'Please select at least one recipient' });
    }
    const funeral = await pool.query('SELECT status FROM funerals WHERE id = $1', [funeral_id]);
if (funeral.rows.length > 0 && ['Closed', 'Archived'].includes(funeral.rows[0].status)) {
  if (req.user.role_id !== 1) {
    return res.status(403).json({ message: 'Donations are closed for this funeral.' });
  }
}
    const duplicate = await pool.query(
      'SELECT * FROM donations WHERE phone_number = $1 AND amount = $2 AND funeral_id = $3 AND created_at > NOW() - INTERVAL \'5 minutes\'',
      [phone_number, amount, funeral_id]
    );
    if (duplicate.rows.length > 0) {
      return res.status(400).json({ message: 'Possible duplicate donation detected. Please verify.' });
    }

    if (amount <= 0) {
      return res.status(400).json({ message: 'Donation amount must be greater than zero' });
    }

    const receipt_number = generateReceiptNumber();

    const donation = await pool.query(
      'INSERT INTO donations (receipt_number, funeral_id, donor_name, phone_number, amount, recipient_id, payment_method, notes, teller_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [receipt_number, funeral_id, donor_name, phone_number, amount, recipient_ids[0], payment_method, notes, req.user.id]
    );

    for (const rId of recipient_ids) {
      await pool.query(
        'INSERT INTO donation_recipients (donation_id, recipient_id) VALUES ($1, $2)',
        [donation.rows[0].id, rId]
      );
    }

    await pool.query(
      'INSERT INTO receipts (receipt_number, donation_id, printed_by) VALUES ($1, $2, $3)',
      [receipt_number, donation.rows[0].id, req.user.id]
    );

    const recipientNames = await pool.query(
      'SELECT name FROM recipients WHERE id = ANY($1)',
      [recipient_ids]
    );

    res.status(201).json({
      message: 'Donation recorded successfully',
      donation: { ...donation.rows[0], recipient_names: recipientNames.rows.map(r => r.name) }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get All Donations for a Funeral
const getFuneralDonations = async (req, res) => {
  const { funeral_id } = req.params;
  try {
    const donations = await pool.query(
      `SELECT d.*, u.full_name as teller_name,
        (SELECT STRING_AGG(r.name, ', ') FROM donation_recipients dr LEFT JOIN recipients r ON dr.recipient_id = r.id WHERE dr.donation_id = d.id) as recipient_name
       FROM donations d
       LEFT JOIN users u ON d.teller_id = u.id
       WHERE d.funeral_id = $1 AND d.is_deleted = FALSE ORDER BY d.created_at DESC`,
      [funeral_id]
    );
    res.json({ donations: donations.rows });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get Teller's Own Donations
const getTellerDonations = async (req, res) => {
  try {
    const donations = await pool.query(
      'SELECT d.*, r.name as recipient_name FROM donations d LEFT JOIN recipients r ON d.recipient_id = r.id WHERE d.teller_id = $1 AND d.is_deleted = FALSE ORDER BY d.created_at DESC',
      [req.user.id]
    );
    res.json({ donations: donations.rows });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get Funeral Totals
const getFuneralTotals = async (req, res) => {
  const { funeral_id } = req.params;
  try {
    const totals = await pool.query(
      'SELECT SUM(amount) as grand_total, COUNT(*) as total_donations, AVG(amount) as average_donation FROM donations WHERE funeral_id = $1 AND is_deleted = FALSE',
      [funeral_id]
    );
    const byRecipient = await pool.query(
      'SELECT r.name, SUM(d.amount) as total FROM donations d LEFT JOIN recipients r ON d.recipient_id = r.id WHERE d.funeral_id = $1 AND d.is_deleted = FALSE GROUP BY r.name',
      [funeral_id]
    );
    res.json({ totals: totals.rows[0], by_recipient: byRecipient.rows });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Edit Donation (Funeral Admin & Super Admin only)
const editDonation = async (req, res) => {
  const { id } = req.params;
  const { donor_name, phone_number, amount, recipient_id, payment_method, notes } = req.body;
  try {
    const original = await pool.query('SELECT * FROM donations WHERE id = $1', [id]);
    const funeralCheck = await pool.query('SELECT status FROM funerals WHERE id = $1', [original.rows[0].funeral_id]);
if (funeralCheck.rows.length > 0 && ['Closed', 'Archived'].includes(funeralCheck.rows[0].status)) {
  if (req.user.role_id !== 1) {
    return res.status(403).json({ message: 'This funeral is closed. Edits are not allowed.' });
  }
}
    if (original.rows.length === 0) {
      return res.status(404).json({ message: 'Donation not found' });
    }

    if (amount <= 0) {
      return res.status(400).json({ message: 'Donation amount must be greater than zero' });
    }

    const updated = await pool.query(
      'UPDATE donations SET donor_name = $1, phone_number = $2, amount = $3, recipient_id = $4, payment_method = $5, notes = $6 WHERE id = $7 RETURNING *',
      [donor_name, phone_number, amount, recipient_id, payment_method, notes, id]
    );

    await logAudit(req.user.id, 'EDIT', 'donation', id, original.rows[0], updated.rows[0]);

    res.json({ message: 'Donation updated successfully', donation: updated.rows[0], original: original.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete Donation (Soft Delete - Funeral Admin & Super Admin only)
const deleteDonation = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    const original = await pool.query('SELECT * FROM donations WHERE id = $1', [id]);
    const funeralCheck = await pool.query('SELECT status FROM funerals WHERE id = $1', [original.rows[0].funeral_id]);
  if (funeralCheck.rows.length > 0 && ['Closed', 'Archived'].includes(funeralCheck.rows[0].status)) {
  if (req.user.role_id !== 1) {
    return res.status(403).json({ message: 'This funeral is closed. Deletions are not allowed.' });
  }
}
    if (original.rows.length === 0) {
      return res.status(404).json({ message: 'Donation not found' });
    }

    await pool.query('UPDATE donations SET is_deleted = TRUE WHERE id = $1', [id]);

    await logAudit(req.user.id, 'DELETE', 'donation', id, original.rows[0], null);

    res.json({ message: 'Donation deleted successfully', deleted_donation: original.rows[0], reason });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Search Donations (restricted by funeral access)
const searchDonations = async (req, res) => {
  const { funeral_id, donor_name, phone_number, amount, recipient_id, start_date, end_date } = req.query;
  try {
    let query = `SELECT d.*, r.name as recipient_name, u.full_name as teller_name 
                  FROM donations d 
                  LEFT JOIN recipients r ON d.recipient_id = r.id 
                  LEFT JOIN users u ON d.teller_id = u.id 
                  WHERE d.is_deleted = FALSE`;
    let params = [];
    let count = 1;

    if (req.user.role_id !== 1) {
      query += ` AND d.funeral_id IN (SELECT funeral_id FROM funeral_assignments WHERE user_id = $${count++})`;
      params.push(req.user.id);
    }
    if (funeral_id) { query += ` AND d.funeral_id = $${count++}`; params.push(funeral_id); }
    if (donor_name) { query += ` AND d.donor_name ILIKE $${count++}`; params.push(`%${donor_name}%`); }
    if (phone_number) { query += ` AND d.phone_number ILIKE $${count++}`; params.push(`%${phone_number}%`); }
    if (amount) { query += ` AND d.amount = $${count++}`; params.push(amount); }
    if (recipient_id) { query += ` AND d.recipient_id = $${count++}`; params.push(recipient_id); }
    if (start_date) { query += ` AND d.created_at >= $${count++}`; params.push(start_date); }
    if (end_date) { query += ` AND d.created_at <= $${count++}`; params.push(end_date); }

    query += ' ORDER BY d.created_at DESC';

    const donations = await pool.query(query, params);
    res.json({ donations: donations.rows });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Teller: Request an Edit (needs approval)
const requestDonationEdit = async (req, res) => {
  const { id } = req.params;
  const { donor_name, phone_number, amount, recipient_id, payment_method, notes } = req.body;
  try {
    const donation = await pool.query('SELECT * FROM donations WHERE id = $1', [id]);
    const funeralCheck = await pool.query('SELECT status FROM funerals WHERE id = $1', [donation.rows[0].funeral_id]);
if (funeralCheck.rows.length > 0 && ['Closed', 'Archived'].includes(funeralCheck.rows[0].status)) {
  return res.status(403).json({ message: 'This funeral is closed. Edit requests are not allowed.' });
}
    if (donation.rows.length === 0) {
      return res.status(404).json({ message: 'Donation not found' });
    }
    if (donation.rows[0].teller_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only request edits to your own donations' });
    }
    const request = await pool.query(
      `INSERT INTO donation_edit_requests 
       (donation_id, requested_by, proposed_donor_name, proposed_phone_number, proposed_amount, proposed_recipient_id, proposed_payment_method, proposed_notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id, req.user.id, donor_name, phone_number, amount, recipient_id, payment_method, notes]
    );
    res.status(201).json({ message: 'Edit request submitted for approval', request: request.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Funeral Admin / Super Admin: View Pending Edit Requests
const getPendingEditRequests = async (req, res) => {
  try {
    const requests = await pool.query(
      `SELECT er.*, d.donor_name as original_donor_name, d.amount as original_amount, d.receipt_number, u.full_name as requested_by_name
       FROM donation_edit_requests er
       LEFT JOIN donations d ON er.donation_id = d.id
       LEFT JOIN users u ON er.requested_by = u.id
       WHERE er.status = 'Pending'
       ORDER BY er.created_at DESC`
    );
    res.json({ requests: requests.rows });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Funeral Admin / Super Admin: Approve Edit Request
const approveEditRequest = async (req, res) => {
  const { id } = req.params;
  try {
    const request = await pool.query('SELECT * FROM donation_edit_requests WHERE id = $1', [id]);
    if (request.rows.length === 0) return res.status(404).json({ message: 'Request not found' });
    const r = request.rows[0];

    const original = await pool.query('SELECT * FROM donations WHERE id = $1', [r.donation_id]);

    const updated = await pool.query(
      'UPDATE donations SET donor_name = $1, phone_number = $2, amount = $3, recipient_id = $4, payment_method = $5, notes = $6 WHERE id = $7 RETURNING *',
      [r.proposed_donor_name, r.proposed_phone_number, r.proposed_amount, r.proposed_recipient_id, r.proposed_payment_method, r.proposed_notes, r.donation_id]
    );
    await pool.query(
      "UPDATE donation_edit_requests SET status = 'Approved', reviewed_by = $1, reviewed_at = NOW() WHERE id = $2",
      [req.user.id, id]
    );

    await logAudit(req.user.id, 'EDIT', 'donation', r.donation_id, original.rows[0], updated.rows[0]);

    res.json({ message: 'Edit request approved and applied' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Funeral Admin / Super Admin: Reject Edit Request
const rejectEditRequest = async (req, res) => {
  const { id } = req.params;
  const { review_note } = req.body;
  try {
    await pool.query(
      "UPDATE donation_edit_requests SET status = 'Rejected', reviewed_by = $1, review_note = $2, reviewed_at = NOW() WHERE id = $3",
      [req.user.id, review_note, id]
    );
    res.json({ message: 'Edit request rejected' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Get Single Donation (for reprint)
const getDonationById = async (req, res) => {
  const { id } = req.params;
  try {
    const donation = await pool.query(
      `SELECT d.*, 
        (SELECT STRING_AGG(r.name, ', ') FROM donation_recipients dr LEFT JOIN recipients r ON dr.recipient_id = r.id WHERE dr.donation_id = d.id) as recipient_names_str
       FROM donations d WHERE d.id = $1`,
      [id]
    );
    if (donation.rows.length === 0) {
      return res.status(404).json({ message: 'Donation not found' });
    }
    const row = donation.rows[0];
    row.recipient_names = row.recipient_names_str ? row.recipient_names_str.split(', ') : [];


    res.json({ donation: row });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
module.exports = { addRecipient, getRecipients, recordDonation, getFuneralDonations, getTellerDonations, getFuneralTotals, editDonation, deleteDonation, searchDonations, requestDonationEdit, getPendingEditRequests, approveEditRequest, rejectEditRequest, getDonationById };module.exports = { addRecipient, getRecipients, recordDonation, getFuneralDonations, getTellerDonations, getFuneralTotals, editDonation, deleteDonation, searchDonations, requestDonationEdit, getPendingEditRequests, approveEditRequest, rejectEditRequest, getDonationById };