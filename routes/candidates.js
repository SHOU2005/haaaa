const router = require('express').Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// All routes require auth
router.use(authMiddleware);

// GET /api/candidates  — own candidates (admin sees all)
router.get('/', (req, res) => {
  const { role, location, status, search } = req.query;
  let query = `
    SELECT c.*, s.name as added_by_name, j.title as job_title, j.employer as job_employer
    FROM candidates c
    LEFT JOIN staff s ON c.added_by = s.id
    LEFT JOIN jobs j ON c.job_id = j.id
    WHERE 1=1
  `;
  const params = [];

  if (req.user.role !== 'admin') {
    query += ' AND c.added_by = ?';
    params.push(req.user.id);
  }
  if (role)     { query += ' AND c.role = ?';     params.push(role); }
  if (location) { query += ' AND c.location = ?'; params.push(location); }
  if (status)   { query += ' AND c.status = ?';   params.push(status); }
  if (search)   {
    query += ' AND (c.name LIKE ? OR c.phone LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  query += ' ORDER BY c.created_at DESC';

  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

// GET /api/candidates/stats
router.get('/stats', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const isAdmin = req.user.role === 'admin';
  const staffFilter = isAdmin ? '' : 'AND added_by = ' + req.user.id;

  const todayAdded = db.prepare(
    `SELECT COUNT(*) as c FROM candidates WHERE date(created_at) = ? ${staffFilter}`
  ).get(today).c;

  const tomorrowJoining = db.prepare(
    `SELECT COUNT(*) as c FROM candidates WHERE joining_date = ?`
  ).get(tomorrow).c;

  const followupsToday = db.prepare(
    `SELECT COUNT(*) as c FROM candidates WHERE followup_date = ? AND status != 'Joined' ${staffFilter}`
  ).get(today).c;

  // Today's log
  const log = db.prepare(
    'SELECT * FROM daily_logs WHERE staff_id = ? AND date = ?'
  ).get(req.user.id, today);

  res.json({
    calls: log?.calls || 0,
    posts: log?.posts || 0,
    leads: log?.leads || 0,
    todayAdded,
    tomorrowJoining,
    followupsToday
  });
});

// GET /api/candidates/tomorrow
router.get('/tomorrow', (req, res) => {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT c.*, s.name as added_by_name, j.title as job_title, j.employer as job_employer
    FROM candidates c
    LEFT JOIN staff s ON c.added_by = s.id
    LEFT JOIN jobs j ON c.job_id = j.id
    WHERE c.joining_date = ?
    ORDER BY c.role, c.location
  `).all(tomorrow);
  res.json(rows);
});

// GET /api/candidates/followups  — followups due today
router.get('/followups', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  let query = `
    SELECT c.*, s.name as added_by_name
    FROM candidates c
    LEFT JOIN staff s ON c.added_by = s.id
    WHERE c.followup_date = ? AND c.status != 'Joined'
  `;
  const params = [today];
  if (req.user.role !== 'admin') {
    query += ' AND c.added_by = ?';
    params.push(req.user.id);
  }
  res.json(db.prepare(query).all(...params));
});

// GET /api/candidates/:id
router.get('/:id', (req, res) => {
  const row = db.prepare(`
    SELECT c.*, s.name as added_by_name, j.title as job_title, j.employer as job_employer, j.location as job_location
    FROM candidates c
    LEFT JOIN staff s ON c.added_by = s.id
    LEFT JOIN jobs j ON c.job_id = j.id
    WHERE c.id = ?
  `).get(req.params.id);

  if (!row) return res.status(404).json({ error: 'Candidate not found' });
  if (req.user.role !== 'admin' && row.added_by !== req.user.id)
    return res.status(403).json({ error: 'Not authorized' });

  res.json(row);
});

// POST /api/candidates
router.post('/', (req, res) => {
  const { name, phone, role, location, status, joining_date, followup_date, notes, job_id } = req.body;

  if (!name || !phone || !role || !location)
    return res.status(400).json({ error: 'Name, phone, role, location are required' });

  // Duplicate phone check
  const dup = db.prepare('SELECT id FROM candidates WHERE phone = ?').get(phone);
  if (dup) return res.status(409).json({ error: 'Phone number already exists' });

  const result = db.prepare(`
    INSERT INTO candidates (name, phone, role, location, status, joining_date, followup_date, notes, job_id, added_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name, phone, role, location,
    status || 'New',
    joining_date || null,
    followup_date || null,
    notes || null,
    job_id || null,
    req.user.id
  );

  // If job selected and candidate joined, update job filled count
  if (job_id && status === 'Joined') {
    db.prepare('UPDATE jobs SET filled = filled + 1 WHERE id = ?').run(job_id);
  }

  const newCand = db.prepare(`
    SELECT c.*, s.name as added_by_name, j.title as job_title
    FROM candidates c
    LEFT JOIN staff s ON c.added_by = s.id
    LEFT JOIN jobs j ON c.job_id = j.id
    WHERE c.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(newCand);
});

// PUT /api/candidates/:id
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM candidates WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Candidate not found' });
  if (req.user.role !== 'admin' && existing.added_by !== req.user.id)
    return res.status(403).json({ error: 'Not authorized' });

  const { name, phone, role, location, status, joining_date, followup_date, notes, job_id } = req.body;

  // Check phone dup (excluding self)
  if (phone && phone !== existing.phone) {
    const dup = db.prepare('SELECT id FROM candidates WHERE phone = ? AND id != ?').get(phone, req.params.id);
    if (dup) return res.status(409).json({ error: 'Phone number already exists' });
  }

  // If status changed to Joined and job is linked, update counts
  if (status === 'Joined' && existing.status !== 'Joined' && (job_id || existing.job_id)) {
    const jId = job_id || existing.job_id;
    db.prepare('UPDATE jobs SET filled = filled + 1 WHERE id = ?').run(jId);
  }
  // If status changed FROM Joined, decrement
  if (existing.status === 'Joined' && status && status !== 'Joined' && existing.job_id) {
    db.prepare('UPDATE jobs SET filled = MAX(0, filled - 1) WHERE id = ?').run(existing.job_id);
  }

  db.prepare(`
    UPDATE candidates SET
      name = ?, phone = ?, role = ?, location = ?, status = ?,
      joining_date = ?, followup_date = ?, notes = ?, job_id = ?,
      updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(
    name || existing.name,
    phone || existing.phone,
    role || existing.role,
    location || existing.location,
    status || existing.status,
    joining_date !== undefined ? joining_date : existing.joining_date,
    followup_date !== undefined ? followup_date : existing.followup_date,
    notes !== undefined ? notes : existing.notes,
    job_id !== undefined ? job_id : existing.job_id,
    req.params.id
  );

  const updated = db.prepare(`
    SELECT c.*, s.name as added_by_name, j.title as job_title, j.employer as job_employer
    FROM candidates c
    LEFT JOIN staff s ON c.added_by = s.id
    LEFT JOIN jobs j ON c.job_id = j.id
    WHERE c.id = ?
  `).get(req.params.id);

  res.json(updated);
});

// DELETE /api/candidates/:id
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM candidates WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Candidate not found' });
  if (req.user.role !== 'admin' && existing.added_by !== req.user.id)
    return res.status(403).json({ error: 'Not authorized' });

  db.prepare('DELETE FROM candidates WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
