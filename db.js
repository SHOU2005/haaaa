// =====================================================================
// Switch Staff System — Database Setup (SQLite via better-sqlite3)
// =====================================================================
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'switch_staff.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── CREATE TABLES ───────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS staff (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    username    TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'staff',  -- 'admin' | 'staff'
    created_at  TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS candidates (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT NOT NULL,
    phone        TEXT UNIQUE NOT NULL,
    role         TEXT NOT NULL,                -- Cook | Helper | Cleaning | Driver
    location     TEXT NOT NULL,               -- Noida | Gurgaon | Delhi
    status       TEXT NOT NULL DEFAULT 'New', -- New|Called|Interested|Not Interested|Confirmed|Joined
    joining_date TEXT,
    followup_date TEXT,
    notes        TEXT,
    job_id       INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
    added_by     INTEGER NOT NULL REFERENCES staff(id),
    created_at   TEXT DEFAULT (datetime('now','localtime')),
    updated_at   TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT NOT NULL,
    role         TEXT NOT NULL,               -- Cook | Helper | Cleaning | Driver
    location     TEXT NOT NULL,               -- Noida | Gurgaon | Delhi | All
    employer     TEXT NOT NULL,
    openings     INTEGER NOT NULL DEFAULT 1,
    filled       INTEGER NOT NULL DEFAULT 0,
    salary_min   INTEGER,
    salary_max   INTEGER,
    description  TEXT,
    status       TEXT DEFAULT 'active',       -- active | filled | closed
    added_by     INTEGER REFERENCES staff(id),
    created_at   TEXT DEFAULT (datetime('now','localtime')),
    updated_at   TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS daily_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id   INTEGER NOT NULL REFERENCES staff(id),
    date       TEXT NOT NULL,
    calls      INTEGER DEFAULT 0,
    posts      INTEGER DEFAULT 0,
    leads      INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(staff_id, date)
  );
`);

// ─── SEED DATA ────────────────────────────────────────────────────────
const staffCount = db.prepare('SELECT COUNT(*) as c FROM staff').get().c;

if (staffCount === 0) {
  console.log('🌱 Seeding database...');

  const insertStaff = db.prepare(
    'INSERT INTO staff (name, username, password, role) VALUES (?, ?, ?, ?)'
  );

  const adminHash  = bcrypt.hashSync('admin123', 10);
  const staffHash  = bcrypt.hashSync('pass123', 10);
  const staff2Hash = bcrypt.hashSync('pass123', 10);

  const admin  = insertStaff.run('Admin User',  'admin', adminHash,  'admin');
  const ravi   = insertStaff.run('Ravi Sharma', 'staff', staffHash,  'staff');
  const priya  = insertStaff.run('Priya Singh', 'staff2', staff2Hash, 'staff');

  // Seed Jobs
  const insertJob = db.prepare(`
    INSERT INTO jobs (title, role, location, employer, openings, filled, salary_min, salary_max, description, status, added_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertJob.run('Head Cook - 5 Star Hotel', 'Cook', 'Noida', 'Radisson Blu Noida', 3, 0, 18000, 25000, 'Need experienced cook for continental and Indian cuisine. 8-hour shift, food+transport provided.', 'active', admin.lastInsertRowid);
  insertJob.run('Kitchen Helper', 'Helper', 'Noida', 'McDonald\'s Sector 18', 5, 2, 12000, 15000, 'Part-time kitchen helpers needed. Morning and evening shifts available.', 'active', admin.lastInsertRowid);
  insertJob.run('Cleaning Staff', 'Cleaning', 'Gurgaon', 'DLF Cyber Hub', 8, 1, 10000, 13000, 'Full-time cleaning staff for mall premises. Uniform and ID card provided.', 'active', admin.lastInsertRowid);
  insertJob.run('Personal Driver', 'Driver', 'Delhi', 'Corporate House Delhi', 2, 0, 20000, 28000, 'Personal driver needed for corporate executive. Must have 5+ years experience, valid license.', 'active', admin.lastInsertRowid);
  insertJob.run('Cook - Cloud Kitchen', 'Cook', 'Delhi', 'Rebel Foods Delhi', 4, 1, 15000, 20000, 'Zomato cloud kitchen cooks needed. Must know multiple cuisines. Fixed salary + performance bonus.', 'active', admin.lastInsertRowid);
  insertJob.run('Hospital Helper', 'Helper', 'Gurgaon', 'Fortis Hospital Gurgaon', 6, 0, 13000, 16000, 'Ward helpers and patient attendants needed for hospital. Night shift allowance extra.', 'active', admin.lastInsertRowid);
  insertJob.run('Office Cleaning', 'Cleaning', 'Noida', 'TCS Noida SEZ', 10, 3, 11000, 14000, 'Office cleaning in IT park. Day shift 6am-2pm. PF+ESI benefits.', 'active', admin.lastInsertRowid);
  insertJob.run('Cab Driver - OLA', 'Driver', 'Gurgaon', 'OLA Fleet Partner', 15, 5, 22000, 30000, 'OLA cab driver partnership. Your own vehicle or company vehicle option. Weekly payouts.', 'active', admin.lastInsertRowid);
  insertJob.run('Hotel Cook', 'Cook', 'Gurgaon', 'Lemon Tree Hotel Gurgaon', 2, 0, 20000, 30000, 'All-rounder cook for hotel kitchen. Continental, South Indian, Chinese specializations preferred.', 'active', admin.lastInsertRowid);
  insertJob.run('Delivery Helper', 'Helper', 'Delhi', 'Amazon Warehouse Delhi', 20, 8, 14000, 18000, 'Warehouse helpers for Amazon fulfilment center. Fixed shift, Rs 500 joining bonus.', 'active', admin.lastInsertRowid);

  // Seed Candidates
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const tomorrow  = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const insertCand = db.prepare(`
    INSERT INTO candidates (name, phone, role, location, status, joining_date, followup_date, notes, added_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertCand.run('Rahul Gupta',   '8800112233', 'Cook',    'Noida',   'Joined',        yesterday, null,    'Very experienced, 5 years in hotel kitchen.', ravi.lastInsertRowid, yesterday);
  insertCand.run('Sunita Devi',   '7700998877', 'Cleaning','Delhi',   'Interested',    today,     today,   'Called twice, very interested. Needs transport.', ravi.lastInsertRowid, today);
  insertCand.run('Mohan Lal',     '9988776655', 'Helper',  'Gurgaon', 'Confirmed',     tomorrow,  null,    'Documents verified. Ready to join.', ravi.lastInsertRowid, today);
  insertCand.run('Kavita Kumari', '8877665544', 'Driver',  'Noida',   'Not Interested',null,      null,    'Currently employed elsewhere. Revisit in 2 months.', priya.lastInsertRowid, yesterday);
  insertCand.run('Deepak Yadav',  '7766554433', 'Cook',    'Delhi',   'New',           tomorrow,  null,    'Freshly referred. Call not attempted yet.', priya.lastInsertRowid, today);
  insertCand.run('Anita Sharma',  '6655443322', 'Cleaning','Gurgaon', 'Called',        null,      today,   'Will call back tomorrow morning.', ravi.lastInsertRowid, today);
  insertCand.run('Rajesh Kumar',  '5544332211', 'Helper',  'Noida',   'Confirmed',     tomorrow,  null,    'All documents submitted. Joining confirmed.', priya.lastInsertRowid, today);
  insertCand.run('Geeta Patel',   '9911223344', 'Cook',    'Delhi',   'Joined',        yesterday, null,    'Excellent feedback from employer.', priya.lastInsertRowid, yesterday);
  insertCand.run('Suresh Pandey', '9822334455', 'Driver',  'Gurgaon', 'Interested',    null,      tomorrow,'Has license. Wants to drive cab.', ravi.lastInsertRowid, today);
  insertCand.run('Meena Kumari',  '9733445566', 'Helper',  'Delhi',   'Called',        null,      today,   'Looking for morning shift only.', priya.lastInsertRowid, today);

  // Seed Daily Logs
  const insertLog = db.prepare(`
    INSERT OR IGNORE INTO daily_logs (staff_id, date, calls, posts, leads) VALUES (?, ?, ?, ?, ?)
  `);
  insertLog.run(ravi.lastInsertRowid, today,     15, 5, 3);
  insertLog.run(ravi.lastInsertRowid, yesterday, 12, 4, 2);
  insertLog.run(priya.lastInsertRowid, today,    10, 3, 4);
  insertLog.run(priya.lastInsertRowid, yesterday, 8, 6, 1);

  console.log('✅ Database seeded successfully!');
}

module.exports = db;
