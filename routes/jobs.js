const router = require('express').Router();
const db = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/jobs  — list jobs, filterable by role/location/status
router.get('/', (req, res) => {
  const { role, location, status } = req.query;
  let query = 'SELECT j.*, s.name as added_by_name FROM jobs j LEFT JOIN staff s ON j.added_by = s.id WHERE 1=1';
  const params = [];

  if (role)     { query += ' AND j.role = ?';     params.push(role); }
  if (location && location !== 'All') { query += ' AND (j.location = ? OR j.location = "All")'; params.push(location); }
  if (status)   { query += ' AND j.status = ?';   params.push(status); }
  else          { query += ' AND j.status = "active"'; }

  query += ' ORDER BY j.created_at DESC';
  res.json(db.prepare(query).all(...params));
});

// GET /api/jobs/match  — jobs matching a role (for candidate form)
router.get('/match', (req, res) => {
  const { role, location } = req.query;
  if (!role) return res.status(400).json({ error: 'role is required' });

  let query = `
    SELECT *, (openings - filled) as available_slots
    FROM jobs
    WHERE status = 'active' AND role = ?
  `;
  const params = [role];

  if (location) {
    query += ' AND (location = ? OR location = "All")';
    params.push(location);
  }
  query += ' ORDER BY (openings - filled) DESC, created_at DESC';
  res.json(db.prepare(query).all(...params));
});

// GET /api/jobs/:id
router.get('/:id', (req, res) => {
  const job = db.prepare(`
    SELECT j.*, s.name as added_by_name,
      (SELECT COUNT(*) FROM candidates c WHERE c.job_id = j.id) as candidates_linked,
      (SELECT COUNT(*) FROM candidates c WHERE c.job_id = j.id AND c.status = 'Joined') as joined_count
    FROM jobs j
    LEFT JOIN staff s ON j.added_by = s.id
    WHERE j.id = ?
  `).get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

// POST /api/jobs  — admin only
router.post('/', adminOnly, (req, res) => {
  const { title, role, location, employer, openings, salary_min, salary_max, description } = req.body;
  if (!title || !role || !location || !employer)
    return res.status(400).json({ error: 'title, role, location, employer are required' });

  const result = db.prepare(`
    INSERT INTO jobs (title, role, location, employer, openings, salary_min, salary_max, description, added_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, role, location, employer, openings || 1, salary_min || null, salary_max || null, description || null, req.user.id);

  res.status(201).json(db.prepare('SELECT * FROM jobs WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /api/jobs/:id  — admin only
router.put('/:id', adminOnly, (req, res) => {
  const existing = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Job not found' });

  const { title, role, location, employer, openings, filled, salary_min, salary_max, description, status } = req.body;

  db.prepare(`
    UPDATE jobs SET
      title = ?, role = ?, location = ?, employer = ?,
      openings = ?, filled = ?, salary_min = ?, salary_max = ?,
      description = ?, status = ?,
      updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(
    title || existing.title, role || existing.role, location || existing.location,
    employer || existing.employer, openings ?? existing.openings, filled ?? existing.filled,
    salary_min ?? existing.salary_min, salary_max ?? existing.salary_max,
    description ?? existing.description, status || existing.status,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id));
});

// DELETE /api/jobs/:id  — admin only
router.delete('/:id', adminOnly, (req, res) => {
  const existing = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Job not found' });
  db.prepare('UPDATE candidates SET job_id = NULL WHERE job_id = ?').run(req.params.id);
  db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
