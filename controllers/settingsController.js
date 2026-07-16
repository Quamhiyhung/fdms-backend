const pool = require('../config/db');
const { logAudit } = require('../middleware/auditLogger');

// Get All Settings
const getSettings = async (req, res) => {
  try {
    const settings = await pool.query('SELECT * FROM system_settings ORDER BY setting_key');
    res.json({ settings: settings.rows });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update a Setting
const updateSetting = async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  try {
    const updated = await pool.query(
      'UPDATE system_settings SET setting_value = $1, updated_by = $2, updated_at = NOW() WHERE setting_key = $3 RETURNING *',
      [value, req.user.id, key]
    );
    if (updated.rows.length === 0) {
      return res.status(404).json({ message: 'Setting not found' });
    }
    await logAudit(req.user.id, 'EDIT', 'setting', updated.rows[0].id, null, updated.rows[0]);
    res.json({ message: 'Setting updated successfully', setting: updated.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Generate Database Backup (JSON export of all key tables)
const generateBackup = async (req, res) => {
  try {
    const users = await pool.query('SELECT id, full_name, email, role_id, is_active, created_at FROM users');
    const funerals = await pool.query('SELECT * FROM funerals');
    const recipients = await pool.query('SELECT * FROM recipients');
    const donations = await pool.query('SELECT * FROM donations');
    const receipts = await pool.query('SELECT * FROM receipts');
    const assignments = await pool.query('SELECT * FROM funeral_assignments');

    const backup = {
      generated_at: new Date().toISOString(),
      generated_by: req.user.id,
      data: {
        users: users.rows,
        funerals: funerals.rows,
        recipients: recipients.rows,
        donations: donations.rows,
        receipts: receipts.rows,
        funeral_assignments: assignments.rows
      }
    };

    await logAudit(req.user.id, 'BACKUP', 'system', null, null, { generated_at: backup.generated_at });

    res.json(backup);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get a single public setting (any logged-in user)
const getPublicSetting = async (req, res) => {
  const { key } = req.params;
  try {
    const setting = await pool.query('SELECT setting_value FROM system_settings WHERE setting_key = $1', [key]);
    if (setting.rows.length === 0) {
      return res.status(404).json({ message: 'Setting not found' });
    }
    res.json({ value: setting.rows[0].setting_value });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { getSettings, updateSetting, generateBackup, getPublicSetting };