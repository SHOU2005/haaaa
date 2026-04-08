require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const db      = require('./db');

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/candidates', require('./routes/candidates'));
app.use('/api/jobs',       require('./routes/jobs'));
app.use('/api/staff',      require('./routes/staff'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API connected to Supabase 🚀' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
