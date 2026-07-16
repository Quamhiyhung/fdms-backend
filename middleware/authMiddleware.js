const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) {
    return res.status(403).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

const isSuperAdmin = (req, res, next) => {
  if (req.user.role_id !== 1) {
    return res.status(403).json({ message: 'Access denied. Super Admin only.' });
  }
  next();
};

const isFuneralAdmin = (req, res, next) => {
  if (req.user.role_id !== 2 && req.user.role_id !== 1) {
    return res.status(403).json({ message: 'Access denied. Funeral Admin only.' });
  }
  next();
};

module.exports = { verifyToken, isSuperAdmin, isFuneralAdmin };