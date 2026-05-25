require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const biometricRoutes = require('./routes/biometricRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const generalRoutes = require('./routes/generalRoutes');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow static file serving
}));

// CORS - parse multiple origins from .env (comma-separated) and allow same hostnames on any dev port
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(url => url.trim())
  .filter(Boolean);

const allowedHostnames = allowedOrigins.map(origin => {
  try {
    return new URL(origin).hostname;
  } catch {
    return origin;
  }
});

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    try {
      const parsed = new URL(origin);
      if (allowedHostnames.includes(parsed.hostname)) {
        callback(null, true);
        return;
      }
    } catch {
      // falling through to rejection
    }

    callback(new Error('CORS not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('[:date[iso]] :method :url :status :response-time ms'));
}

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 10000 : (parseInt(process.env.RATE_LIMIT_MAX) || 100),
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
});

app.use('/api', limiter);
app.use('/api/auth/login', authLimiter);

// Static file serving (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    service: 'Smart Face Biometric Attendance System API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/biometric', biometricRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api', generalRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}` });
});

// Global error handler
app.use(errorHandler);

module.exports = app;
