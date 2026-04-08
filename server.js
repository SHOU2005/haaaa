// =====================================================================
// Switch Staff System — Express Server
// =====================================================================
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 5000;

// ─── MIDDLEWARE ───────────────────────────────────────────────────────
app.use(cors({ origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5500', 'http://127.0.0.1:5500', '*'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${req.method} ${req.path}`);
  next();
});

// ─── ROUTES ───────────────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/candidates', require('./routes/candidates'));
app.use('/api/jobs',       require('./routes/jobs'));
app.use('/api/staff',      require('./routes/staff'));
app.use('/api/logs',       require('./routes/logs'));

// ─── HEALTH CHECK ─────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), message: 'Switch Staff API running 🚀' });
});

// ─── 404 ──────────────────────────────────────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// ─── ERROR HANDLER ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── START ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n🚀 Switch Staff API Server');
  console.log(`   URL: http://localhost:${PORT}`);
  console.log(`   Env: ${process.env.NODE_ENV || 'development'}`);
  console.log('─'.repeat(40));
});

module.exports = app;
