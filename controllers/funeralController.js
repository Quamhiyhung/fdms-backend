const pool = require('../config/db');
const { logAudit } = require('../middleware/auditLogger');

// Create Funeral
const createFuneral = async (req, res) => {
  const { funeral_id, deceased_name, funeral_date, venue } = req.body;
  const photo = req.file ? `http://localhost:5000/uploads/${req.file.filename}` : null;
  try {
    const newFuneral = await pool.query(
      'INSERT INTO funerals (funeral_id, deceased_name, photo, funeral_date, venue, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [funeral_id, deceased_name, photo, funeral_date, venue, req.user.id]
    );
    res.status(201).json({ message: 'Funeral created successfully', funeral: newFuneral.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get All Funerals (restricted by assignment, real-time status)
const getAllFunerals = async (req, res) => {
  try {
    let funerals;
    if (req.user.role_id === 1) {
      funerals = await pool.query('SELECT * FROM funerals ORDER BY created_at DESC');
    } else {
      funerals = await pool.query(
        'SELECT f.* FROM funerals f INNER JOIN funeral_assignments fa ON f.id = fa.funeral_id WHERE fa.user_id = $1 ORDER BY f.created_at DESC',
        [req.user.id]
      );
    }

    const today = new Date().toISOString().split('T')[0];
    const updatedFunerals = funerals.rows.map(f => {
      if (f.status === 'Closed' || f.status === 'Archived') return f;
      const funeralDate = new Date(f.funeral_date).toISOString().split('T')[0];
      const computedStatus = funeralDate <= today ? 'Active' : 'Upcoming';
      return { ...f, status: computedStatus };
    });

    res.json({ funerals: updatedFunerals });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get Single Funeral
const getFuneral = async (req, res) => {
  const { id } = req.params;
  try {
    const funeral = await pool.query('SELECT * FROM funerals WHERE id = $1', [id]);
    if (funeral.rows.length === 0) {
      return res.status(404).json({ message: 'Funeral not found' });
    }
    res.json({ funeral: funeral.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update Funeral Status
const updateFuneralStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const updated = await pool.query(
      'UPDATE funerals SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );
    res.json({ message: 'Funeral status updated', funeral: updated.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Assign User to Funeral
const assignUserToFuneral = async (req, res) => {
  const { funeral_id, user_id, assigned_role } = req.body;
  try {
    const existing = await pool.query(
      'SELECT * FROM funeral_assignments WHERE funeral_id = $1 AND user_id = $2',
      [funeral_id, user_id]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'User already assigned to this funeral' });
    }
    const assignment = await pool.query(
      'INSERT INTO funeral_assignments (funeral_id, user_id, assigned_role) VALUES ($1, $2, $3) RETURNING *',
      [funeral_id, user_id, assigned_role]
    );
    res.status(201).json({ message: 'User assigned successfully', assignment: assignment.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get Users by Role
const getUsersByRole = async (req, res) => {
  const { role_id } = req.params;
  try {
    const users = await pool.query('SELECT id, full_name, email FROM users WHERE role_id = $1 AND is_active = TRUE', [role_id]);
    res.json({ users: users.rows });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get Assignments for a Funeral
const getFuneralAssignments = async (req, res) => {
  const { funeral_id } = req.params;
  try {
    const assignments = await pool.query(
      'SELECT fa.*, u.full_name, u.email FROM funeral_assignments fa LEFT JOIN users u ON fa.user_id = u.id WHERE fa.funeral_id = $1',
      [funeral_id]
    );
    res.json({ assignments: assignments.rows });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get Funerals Assigned to Current User
const getMyAssignedFunerals = async (req, res) => {
  try {
    const funerals = await pool.query(
      'SELECT f.* FROM funerals f INNER JOIN funeral_assignments fa ON f.id = fa.funeral_id WHERE fa.user_id = $1',
      [req.user.id]
    );
    res.json({ funerals: funerals.rows });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Remove Assignment
const removeAssignment = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM funeral_assignments WHERE id = $1', [id]);
    res.json({ message: 'Assignment removed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Edit Funeral (Super Admin only)
const editFuneral = async (req, res) => {
  const { id } = req.params;
  const { deceased_name, funeral_date, venue, existing_photo } = req.body;
  const photo = req.file ? `http://localhost:5000/uploads/${req.file.filename}` : existing_photo;
  try {
    const updated = await pool.query(
      'UPDATE funerals SET deceased_name = $1, funeral_date = $2, venue = $3, photo = $4, updated_at = NOW() WHERE id = $5 RETURNING *',
      [deceased_name, funeral_date, venue, photo, id]
    );
    if (updated.rows.length === 0) {
      return res.status(404).json({ message: 'Funeral not found' });
    }

    await logAudit(req.user.id, 'EDIT', 'funeral', id, null, updated.rows[0]);

    res.json({ message: 'Funeral updated successfully', funeral: updated.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete Funeral (Super Admin only)
const deleteFuneral = async (req, res) => {
  const { id } = req.params;
  try {
    const funeral = await pool.query('SELECT * FROM funerals WHERE id = $1', [id]);
    if (funeral.rows.length === 0) {
      return res.status(404).json({ message: 'Funeral not found' });
    }
    await pool.query('DELETE FROM funerals WHERE id = $1', [id]);

    await logAudit(req.user.id, 'DELETE', 'funeral', id, funeral.rows[0], null);

    res.json({ message: 'Funeral deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Archive Funeral (Super Admin only)
const archiveFuneral = async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await pool.query(
      "UPDATE funerals SET status = 'Archived', updated_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );

    await logAudit(req.user.id, 'ARCHIVE', 'funeral', id, null, updated.rows[0]);

    res.json({ message: 'Funeral archived successfully', funeral: updated.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Close Funeral Donations (Super Admin OR assigned Funeral Admin)
const closeFuneral = async (req, res) => {
  const { id } = req.params;
  try {
    if (req.user.role_id === 2) {
      const assigned = await pool.query(
        'SELECT * FROM funeral_assignments WHERE funeral_id = $1 AND user_id = $2',
        [id, req.user.id]
      );
      if (assigned.rows.length === 0) {
        return res.status(403).json({ message: 'You are not assigned to this funeral' });
      }
    }
    const updated = await pool.query(
      "UPDATE funerals SET status = 'Closed', updated_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );

    await logAudit(req.user.id, 'CLOSE', 'funeral', id, null, updated.rows[0]);

    res.json({ message: 'Funeral closed successfully', funeral: updated.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Unarchive Funeral (Super Admin only)
const unarchiveFuneral = async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await pool.query(
      "UPDATE funerals SET status = 'Upcoming', updated_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );
    await logAudit(req.user.id, 'UNARCHIVE', 'funeral', id, null, updated.rows[0]);
    res.json({ message: 'Funeral unarchived successfully', funeral: updated.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Reopen Funeral (Super Admin only)
const reopenFuneral = async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await pool.query(
      "UPDATE funerals SET status = 'Active', updated_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );
    await logAudit(req.user.id, 'REOPEN', 'funeral', id, null, updated.rows[0]);
    res.json({ message: 'Funeral reopened successfully', funeral: updated.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  createFuneral, getAllFunerals, getFuneral, updateFuneralStatus, assignUserToFuneral,
  getUsersByRole, getFuneralAssignments, getMyAssignedFunerals, removeAssignment,
  editFuneral, deleteFuneral, archiveFuneral, closeFuneral, unarchiveFuneral, reopenFuneral
};