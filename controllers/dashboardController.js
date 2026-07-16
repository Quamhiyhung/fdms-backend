const pool = require('../config/db');

// Super Admin Dashboard
const getSuperAdminDashboard = async (req, res) => {
  try {
    const totalFunerals = await pool.query('SELECT COUNT(*) FROM funerals');
    const activeFunerals = await pool.query('SELECT COUNT(*) FROM funerals WHERE status = $1', ['Active']);
    const totalDonations = await pool.query('SELECT COUNT(*), SUM(amount) as total FROM donations WHERE is_deleted = FALSE');
    const totalTellers = await pool.query('SELECT COUNT(*) FROM users WHERE role_id = 3');
    const totalAdmins = await pool.query('SELECT COUNT(*) FROM users WHERE role_id = 2');
    const recentDonations = await pool.query(
      'SELECT d.*, f.deceased_name, u.full_name as teller_name FROM donations d LEFT JOIN funerals f ON d.funeral_id = f.id LEFT JOIN users u ON d.teller_id = u.id WHERE d.is_deleted = FALSE ORDER BY d.created_at DESC LIMIT 10'
    );

    res.json({
      total_funerals: totalFunerals.rows[0].count,
      active_funerals: activeFunerals.rows[0].count,
      total_donations: totalDonations.rows[0].count,
      total_amount: totalDonations.rows[0].total || 0,
      total_tellers: totalTellers.rows[0].count,
      total_admins: totalAdmins.rows[0].count,
      recent_donations: recentDonations.rows
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Funeral Admin Dashboard
const getFuneralAdminDashboard = async (req, res) => {
  const { funeral_id } = req.params;
  try {
    const totalRaised = await pool.query(
      'SELECT SUM(amount) as total, COUNT(*) as count FROM donations WHERE funeral_id = $1 AND is_deleted = FALSE',
      [funeral_id]
    );
    const byRecipient = await pool.query(
      'SELECT r.name, SUM(d.amount) as total, COUNT(*) as count FROM donations d LEFT JOIN recipients r ON d.recipient_id = r.id WHERE d.funeral_id = $1 AND d.is_deleted = FALSE GROUP BY r.name',
      [funeral_id]
    );
    const byTeller = await pool.query(
      'SELECT u.full_name, SUM(d.amount) as total, COUNT(*) as count FROM donations d LEFT JOIN users u ON d.teller_id = u.id WHERE d.funeral_id = $1 AND d.is_deleted = FALSE GROUP BY u.full_name',
      [funeral_id]
    );
    const dailyTotals = await pool.query(
      'SELECT DATE(created_at) as date, SUM(amount) as total, COUNT(*) as count FROM donations WHERE funeral_id = $1 AND is_deleted = FALSE GROUP BY DATE(created_at) ORDER BY date DESC',
      [funeral_id]
    );
    const recentDonations = await pool.query(
      'SELECT d.*, r.name as recipient_name, u.full_name as teller_name FROM donations d LEFT JOIN recipients r ON d.recipient_id = r.id LEFT JOIN users u ON d.teller_id = u.id WHERE d.funeral_id = $1 AND d.is_deleted = FALSE ORDER BY d.created_at DESC LIMIT 10',
      [funeral_id]
    );

    res.json({
      total_raised: totalRaised.rows[0].total || 0,
      total_donations: totalRaised.rows[0].count,
      by_recipient: byRecipient.rows,
      by_teller: byTeller.rows,
      daily_totals: dailyTotals.rows,
      recent_donations: recentDonations.rows
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Teller Dashboard
const getTellerDashboard = async (req, res) => {
  try {
    const userInfo = await pool.query('SELECT id, full_name, email, role_id, created_at FROM users WHERE id = $1', [req.user.id]);
    const myDonations = await pool.query(
      'SELECT COUNT(*), SUM(amount) as total FROM donations WHERE teller_id = $1 AND is_deleted = FALSE',
      [req.user.id]
    );
    const recentDonations = await pool.query(
      'SELECT d.*, r.name as recipient_name FROM donations d LEFT JOIN recipients r ON d.recipient_id = r.id WHERE d.teller_id = $1 AND d.is_deleted = FALSE ORDER BY d.created_at DESC LIMIT 10',
      [req.user.id]
    );
    const todayDonations = await pool.query(
      'SELECT COUNT(*), SUM(amount) as total FROM donations WHERE teller_id = $1 AND DATE(created_at) = CURRENT_DATE AND is_deleted = FALSE',
      [req.user.id]
    );
    const assignedFunerals = await pool.query(
      'SELECT f.* FROM funerals f INNER JOIN funeral_assignments fa ON f.id = fa.funeral_id WHERE fa.user_id = $1',
      [req.user.id]
    );

    res.json({
      user: userInfo.rows[0],
      assigned_funerals: assignedFunerals.rows,
      total_donations: myDonations.rows[0].count,
      total_amount: myDonations.rows[0].total || 0,
      today_donations: todayDonations.rows[0].count,
      today_amount: todayDonations.rows[0].total || 0,
      recent_donations: recentDonations.rows
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Generate Report
const generateReport = async (req, res) => {
  const { funeral_id, start_date, end_date, teller_id, recipient_id, payment_method } = req.query;
  try {
    let query = 'SELECT d.*, r.name as recipient_name, u.full_name as teller_name FROM donations d LEFT JOIN recipients r ON d.recipient_id = r.id LEFT JOIN users u ON d.teller_id = u.id WHERE d.is_deleted = FALSE';
    let params = [];
    let count = 1;

    if (funeral_id) { query += ` AND d.funeral_id = $${count++}`; params.push(funeral_id); }
    if (start_date) { query += ` AND d.created_at >= $${count++}`; params.push(start_date); }
    if (end_date) { query += ` AND d.created_at <= $${count++}`; params.push(end_date); }
    if (teller_id) { query += ` AND d.teller_id = $${count++}`; params.push(teller_id); }
    if (recipient_id) { query += ` AND d.recipient_id = $${count++}`; params.push(recipient_id); }
    if (payment_method) { query += ` AND d.payment_method = $${count++}`; params.push(payment_method); }

    query += ' ORDER BY d.created_at DESC';

    const donations = await pool.query(query, params);
    const summary = await pool.query(
      'SELECT COUNT(*) as total_count, SUM(amount) as total_amount FROM (' + query + ') as filtered',
      params
    );

    res.json({
      donations: donations.rows,
      summary: summary.rows[0]
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { getSuperAdminDashboard, getFuneralAdminDashboard, getTellerDashboard, generateReport };