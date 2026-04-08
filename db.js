const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Connect to Supabase using the environment variable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const initDb = async () => {
  try {
    // ─── CREATE TABLES (Postgres Syntax) ────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS staff (
        id          SERIAL PRIMARY KEY,
        name        TEXT NOT NULL,
        username    TEXT UNIQUE NOT NULL,
        password    TEXT NOT NULL,
        role        TEXT NOT NULL DEFAULT 'staff',
        created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS jobs (
        id           SERIAL PRIMARY KEY,
        title        TEXT NOT NULL,
        role         TEXT NOT NULL,
        location     TEXT NOT NULL,
        employer     TEXT NOT NULL,
        openings     INTEGER NOT NULL DEFAULT 1,
        filled       INTEGER NOT NULL DEFAULT 0,
        salary_min   INTEGER,
        salary_max   INTEGER,
        description  TEXT,
        status       TEXT DEFAULT 'active',
        added_by     INTEGER REFERENCES staff(id),
        created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS candidates (
        id           SERIAL PRIMARY KEY,
        name         TEXT NOT NULL,
        phone        TEXT UNIQUE NOT NULL,
        role         TEXT NOT NULL,
        location     TEXT NOT NULL,
        status       TEXT NOT NULL DEFAULT 'New',
        joining_date TEXT,
        followup_date TEXT,
        notes        TEXT,
        job_id       INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
        added_by     INTEGER NOT NULL REFERENCES staff(id),
        created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS daily_logs (
        id         SERIAL PRIMARY KEY,
        staff_id   INTEGER NOT NULL REFERENCES staff(id),
        date       TEXT NOT NULL,
        calls      INTEGER DEFAULT 0,
        posts      INTEGER DEFAULT 0,
        leads      INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(staff_id, date)
      );
    `);

    // ─── SEED DATA ──────────────────────────────────────────────────────
    const res = await pool.query('SELECT COUNT(*) FROM staff');
    if (parseInt(res.rows[0].count) === 0) {
      console.log('🌱 Seeding Supabase database...');
      
      const adminHash = await bcrypt.hash('admin123', 10);
      const staffHash = await bcrypt.hash('pass123', 10);

      await pool.query(
        'INSERT INTO staff (name, username, password, role) VALUES ($1, $2, $3, $4)',
        ['Admin User', 'admin', adminHash, 'admin']
      );
      await pool.query(
        'INSERT INTO staff (name, username, password, role) VALUES ($1, $2, $3, $4)',
        ['Ravi Sharma', 'staff', staffHash, 'staff']
      );

      console.log('✅ Seeding complete!');
    }
  } catch (err) {
    console.error('❌ Database Init Error:', err);
  }
};

initDb();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
