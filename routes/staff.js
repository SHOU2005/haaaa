const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/staff  — admin sees all, staff sees self
router.get('/', (req, res) => {
  if (req.user.role === 'admin') {
    const rows = db.prepare('SELECT id, name, username, role, created_at FROM staff ORDER BY role, name').all();
    res.json(rows);
  } else {
    const me = db.prepare('SELECT id, name, username, role, created_at FROM staff WHERE id = ?').get(req.user.id);
    res.json([me]);
  }
});

// GET /api/staff/performance  — team performance (admin) or self (staff)
router.get('/performance', (req, res) => {
  const staffList = req.user.role === 'admin'
    ? db.prepare('SELECT id, name, username, role FROM staff WHERE role = "staff"').all()
    : [req.user];

  const result = staffList.map(s => {
    const logs = db.prepare('SELECT * FROM daily_logs WHERE staff_id = ?').all(s.id);
    const cands = db.prepare('SELECT * FROM candidates WHERE added_by = ?').all(s.id);

    const totalCalls = logs.reduce((a, l) => a + l.calls, 0);
    const totalPosts = logs.reduce((a, l) => a + l.posts, 0);
    const joined = cands.filter(c => c.status === 'Joined').length;
    const conversion = cands.length > 0 ? Math.round((joined / cands.length) * 100) : 0;

    const statusBreakdown = {};
    ['New','Called','Interested','Not Interested','Confirmed','Joined'].forEach(st => {
      statusBreakdown[st] = cands.filter(c => c.status === st).length;
    });

    return {
      staff: s,
      totalCalls, totalPosts,
      totalCandidates: cands.length,
      totalJoins: joined,
      conversionRate: conversion,
      statusBreakdown
    };
  });

  res.json(result);
});

// POST /api/staff  — admin only: add new staff
router.post('/', adminOnly, (req, res) => {
  const { name, username, password, role } = req.body;
  if (!name || !username || !password)
    return res.status(400).json({ error: 'name, username, password required' });

  const dup = db.prepare('SELECT id FROM staff WHERE username = ?').get(username);
  if (dup) return res.status(409).json({ error: 'Username already registered' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO staff (name, username, password, role) VALUES (?, ?, ?, ?)'
  ).run(name, username, hash, role || 'staff');

  res.status(201).json({ id: result.lastInsertRowid, name, username, role: role || 'staff' });
});

// PUT /api/staff/:id  — admin can update any; staff can update own name/password
router.put('/:id', (req, res) => {
  const target = parseInt(req.params.id);
  if (req.user.role !== 'admin' && req.user.id !== target)
    return res.status(403).json({ error: 'Not authorized' });

  const existing = db.prepare('SELECT * FROM staff WHERE id = ?').get(target);
  if (!existing) return res.status(404).json({ error: 'Staff not found' });

  const { name, password, role } = req.body;
  const newName = name || existing.name;
  const newRole = (req.user.role === 'admin' && role) ? role : existing.role;
  const newPwd  = password ? bcrypt.hashSync(password, 10) : existing.password;

  db.prepare('UPDATE staff SET name = ?, password = ?, role = ? WHERE id = ?')
    .run(newName, newPwd, newRole, target);

  res.json({ id: target, name: newName, role: newRole });
});

// DELETE /api/staff/:id  — admin only
router.delete('/:id', adminOnly, (req, res) => {
  if (parseInt(req.params.id) === req.user.id)
    return res.status(400).json({ error: 'Cannot delete yourself' });
  db.prepare('DELETE FROM staff WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
