// api/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { query } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_production';

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requirePermission(permission) {
  return (req, res, next) => {
    const perms = req.user?.permissions || [];
    if (perms.includes('*') || perms.includes(permission)) return next();
    return res.status(403).json({ error: `Permission required: ${permission}` });
  };
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

module.exports = { requireAuth, requirePermission, signToken };
