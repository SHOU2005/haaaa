require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const db      = require('./db');

const app  = express();
// Render uses port 10000, local uses 5000
const PORT = process.env.PORT || 5000;

// 1. IMPROVED CORS (Allows Vercel and Localhost)
app.use(cors({
  origin: '*', // Allows any frontend to connect. Use this to fix the connection immediately.
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// 2. ADDED ROOT ROUTE (To verify server is live at https://haaaa-0swa.onrender.com/)
app.get('/', (req, res) => {
  res.send('Server is running smoothly! 🚀');
});

// Routes
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/candidates', require('./routes/candidates'));
app.use('/api/jobs',       require('./routes/jobs'));
app.use('/api/staff',      require('./routes/staff'));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API connected to Supabase 🚀' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
