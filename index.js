require('dotenv').config();
const dns = require('dns');
// Set robust fallback public DNS to prevent Windows querySrv ECONNREFUSED issues on MongoDB Atlas
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {
  console.warn('DNS server override warning:', e.message);
}

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*',
  credentials: true
}));

// Stripe webhook route needs raw body parser (mounted inside paymentRoutes or handled specifically)
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    platform: 'WedPlan Wedding Planning Platform API',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.send('WedPlan Wedding Planning Platform API Server is Running.');
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payment', paymentRoutes);

// 404 Route handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Server Unhandled Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'production' ? null : err.stack
  });
});

// Connect Database & Start Server
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://sadik1234:1jhKDWPpR2CUK3r2@cluster0.gdfbpex.mongodb.net/wedplan?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 15000
})
.then(() => {
  console.log('Connected to MongoDB database (wedplan)');
  if (process.env.NODE_ENV !== 'production' || process.env.START_SERVER) {
    app.listen(PORT, () => {
      console.log(`WedPlan Server is running on port ${PORT}`);
    });
  }
})
.catch((err) => {
  console.error('MongoDB connection failed:', err.message);
});

module.exports = app;
