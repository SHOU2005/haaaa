const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'switch_secret';

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' });

  const user = db.prepare('SELECT * FROM staff WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ error: 'Invalid username or password' });

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({
    token,
    user: { id: user.id, name: user.name, username: user.username, role: user.role, phone: user.phone }
  });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

module.exports = router;
