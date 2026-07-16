const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { logAudit } = require('../middleware/auditLogger');

// Register User
const registerUser = async (req, res) => {
  const { full_name, email, password, role_id } = req.body;
  try {
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await pool.query(
      'INSERT INTO users (full_name, email, password, role_id) VALUES ($1, $2, $3, $4) RETURNING id, full_name, email, role_id',
      [full_name, email, hashedPassword, role_id]
    );
    res.status(201).json({ message: 'User registered successfully', user: newUser.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Login User
const loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (user.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    if (!user.rows[0].is_active) {
      return res.status(403).json({ message: 'Your account has been deactivated. Contact the Super Admin.' });
    }
    const isMatch = await bcrypt.compare(password, user.rows[0].password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { id: user.rows[0].id, role_id: user.rows[0].role_id },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    await logAudit(user.rows[0].id, 'LOGIN', 'user', user.rows[0].id);
    res.json({ message: 'Login successful', token, user: { id: user.rows[0].id, full_name: user.rows[0].full_name, email: user.rows[0].email, role_id: user.rows[0].role_id } });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get All Users (Super Admin only)
const getAllUsers = async (req, res) => {
  try {
    const users = await pool.query('SELECT u.id, u.full_name, u.email, u.role_id, u.is_active, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id ORDER BY u.created_at DESC');
    res.json({ users: users.rows });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Edit User (Super Admin only)
const editUser = async (req, res) => {
  const { id } = req.params;
  const { full_name, email, role_id } = req.body;
  try {
    const updated = await pool.query(
      'UPDATE users SET full_name = $1, email = $2, role_id = $3, updated_at = NOW() WHERE id = $4 RETURNING id, full_name, email, role_id',
      [full_name, email, role_id, id]
    );
    res.json({ message: 'User updated successfully', user: updated.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete User (Super Admin only)
const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    const original = await pool.query('SELECT id, full_name, email, role_id FROM users WHERE id = $1', [id]);
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    await logAudit(req.user.id, 'DELETE', 'user', id, original.rows[0], null);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Toggle User Active Status (Super Admin only)
const toggleUserActive = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await pool.query('SELECT is_active FROM users WHERE id = $1', [id]);
    if (user.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    const newStatus = !user.rows[0].is_active;
    await pool.query('UPDATE users SET is_active = $1 WHERE id = $2', [newStatus, id]);
    await logAudit(req.user.id, newStatus ? 'ACTIVATE' : 'DEACTIVATE', 'user', id, null, { is_active: newStatus });
    res.json({ message: `User ${newStatus ? 'activated' : 'deactivated'} successfully`, is_active: newStatus });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Change Own Password (any logged-in user)
const changeOwnPassword = async (req, res) => {
  const { current_password, new_password } = req.body;
  try {
    const user = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const isMatch = await bcrypt.compare(current_password, user.rows[0].password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    const hashedPassword = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [hashedPassword, req.user.id]);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Change Any User's Password (Super Admin only)
const changeUserPassword = async (req, res) => {
  const { id } = req.params;
  const { new_password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [hashedPassword, id]);
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get Audit Logs (Super Admin only)
const getAuditLogs = async (req, res) => {
  try {
    const logs = await pool.query(
      `SELECT al.*, u.full_name as user_name 
       FROM audit_logs al 
       LEFT JOIN users u ON al.user_id = u.id 
       ORDER BY al.created_at DESC LIMIT 200`
    );
    res.json({ logs: logs.rows });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Restore Donation/Funeral from Audit Log (Super Admin only)
const restoreFromLog = async (req, res) => {
  const { log_id } = req.params;
  try {
    const log = await pool.query('SELECT * FROM audit_logs WHERE id = $1', [log_id]);
    if (log.rows.length === 0) {
      return res.status(404).json({ message: 'Log entry not found' });
    }
    const entry = log.rows[0];

    if (!entry.old_values) {
      return res.status(400).json({ message: 'No previous data available to restore' });
    }

    if (entry.entity_type === 'donation') {
      if (entry.action === 'DELETE') {
        await pool.query('UPDATE donations SET is_deleted = FALSE WHERE id = $1', [entry.entity_id]);
      } else if (entry.action === 'EDIT') {
        const old = entry.old_values;
        await pool.query(
          'UPDATE donations SET donor_name = $1, phone_number = $2, amount = $3, recipient_id = $4, payment_method = $5, notes = $6 WHERE id = $7',
          [old.donor_name, old.phone_number, old.amount, old.recipient_id, old.payment_method, old.notes, entry.entity_id]
        );
      }
    } else if (entry.entity_type === 'funeral') {
      if (entry.action === 'DELETE') {
        const old = entry.old_values;
        await pool.query(
          'INSERT INTO funerals (id, funeral_id, deceased_name, photo, funeral_date, venue, status, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING',
          [old.id, old.funeral_id, old.deceased_name, old.photo, old.funeral_date, old.venue, old.status, old.created_by]
        );
      } else if (entry.action === 'EDIT' || entry.action === 'ARCHIVE' || entry.action === 'CLOSE') {
        const old = entry.old_values;
        if (old) {
          await pool.query(
            'UPDATE funerals SET deceased_name = $1, funeral_date = $2, venue = $3, status = $4 WHERE id = $5',
            [old.deceased_name, old.funeral_date, old.venue, old.status, entry.entity_id]
          );
        }
      }
    } else if (entry.entity_type === 'user') {
      if (entry.action === 'DELETE') {
        return res.status(400).json({ message: 'Deleted users cannot be restored automatically — please recreate the account.' });
      } else if (entry.action === 'DEACTIVATE') {
        await pool.query('UPDATE users SET is_active = TRUE WHERE id = $1', [entry.entity_id]);
      }
    }

    await logAudit(req.user.id, 'RESTORE', entry.entity_type, entry.entity_id, null, { restored_from_log: log_id });

    res.json({ message: 'Record restored successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



module.exports = { registerUser, loginUser, getAllUsers, editUser, deleteUser, toggleUserActive, changeOwnPassword, changeUserPassword, getAuditLogs, restoreFromLog };