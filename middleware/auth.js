const jwt = require('jsonwebtoken');
const db = require('../db');
const JWT_SECRET = process.env.JWT_SECRET || 'switch_secret';

function authMiddleware(req, res, next) {
  try {
    const user = db.prepare("SELECT id, name, username, role FROM staff WHERE role = 'admin' LIMIT 1").get();
    if (!user) return res.status(401).json({ error: 'No admin found in db' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Database error' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { authMiddleware, adminOnly };
