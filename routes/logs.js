const router = require('express').Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/logs  — user's own logs
router.get('/', (req, res) => {
  const limit = parseInt(req.query.limit) || 30;
  const rows = db.prepare(
    'SELECT * FROM daily_logs WHERE staff_id = ? ORDER BY date DESC LIMIT ?'
  ).all(req.user.id, limit);
  res.json(rows);
});

// GET /api/logs/today
router.get('/today', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const row = db.prepare(
    'SELECT * FROM daily_logs WHERE staff_id = ? AND date = ?'
  ).get(req.user.id, today);
  res.json(row || { staff_id: req.user.id, date: today, calls: 0, posts: 0, leads: 0 });
});

// POST /api/logs  — upsert today's log
router.post('/', (req, res) => {
  const { date, calls, posts, leads } = req.body;
  const logDate = date || new Date().toISOString().slice(0, 10);

  db.prepare(`
    INSERT INTO daily_logs (staff_id, date, calls, posts, leads)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(staff_id, date) DO UPDATE SET
      calls = excluded.calls,
      posts = excluded.posts,
      leads = excluded.leads
  `).run(req.user.id, logDate, calls || 0, posts || 0, leads || 0);

  const updated = db.prepare(
    'SELECT * FROM daily_logs WHERE staff_id = ? AND date = ?'
  ).get(req.user.id, logDate);

  res.json(updated);
});

module.exports = router;
