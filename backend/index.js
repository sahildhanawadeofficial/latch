require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRouter = require('./routes/auth');
const dashboardRouter = require('./routes/dashboard');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.ORIGIN || 'http://localhost:3000',
    credentials: true, // Required to allow cookies cross-origin
  })
);
app.use(express.json());
app.use(cookieParser()); // Parses cookies for challenge + refresh token

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/dashboard', dashboardRouter);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Database + Server Start ──────────────────────────────────────────────────
async function start() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/securebank');
    console.log('✅ MongoDB connected');

    app.listen(PORT, () => {
      console.log(`🚀 SecureBank backend running on http://localhost:${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   RP_ID: ${process.env.RP_ID || 'localhost'}`);
    });
  } catch (err) {
    console.error('❌ Failed to start backend:', err.message);
    process.exit(1);
  }
}

start();
