const pool = require('../config/db');

const logAudit = async (user_id, action, entity_type, entity_id, old_values = null, new_values = null) => {
  try {
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values) VALUES ($1, $2, $3, $4, $5, $6)',
      [user_id, action, entity_type, entity_id, old_values ? JSON.stringify(old_values) : null, new_values ? JSON.stringify(new_values) : null]
    );
  } catch (error) {
    console.error('Audit log error:', error.message);
  }
};

module.exports = { logAudit };