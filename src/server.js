import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.js';
import { testDbConnection, initializeDatabase } from './db/pool.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 5),
  message: 'Too many login attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // max 100 requests per minute
  message: 'Too many requests. Please try again later.',
  standardHeaders: false,
  legacyHeaders: false,
});

app.use(express.json({ limit: '10kb' })); // Limit payload size
app.use('/auth', authLimiter);
app.use('/api', apiLimiter);

app.use('/', apiRoutes);
app.use('/api', apiRoutes);

app.get('/health', async (_req, res) => {
  try {
    const ok = await testDbConnection();
    res.json({ ok, service: 'leoni-in-backend', db: ok ? 'connected' : 'unavailable' });
  } catch (error) {
    console.warn('Health check DB connection failed:', error.message);
    res.json({ ok: false, service: 'leoni-in-backend', db: 'unavailable' });
  }
});

app.get('/', (_req, res) => {
  res.json({ message: 'Leoni-in API is running.' });
});

// Error handling middleware
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});

const server = app.listen(port, async () => {
  console.log(`Backend running on http://localhost:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  if (process.env.DB_AUTO_INIT === 'true' || process.env.NODE_ENV !== 'production') {
    try {
      console.log('Initializing database...');
      await initializeDatabase();
      console.log('✅ Database initialized');
    } catch (error) {
      console.error('❌ Database initialization failed:', error.message);
      // Continue running so an externally managed schema can still be used.
    }
  } else {
    console.log('Database auto-initialization disabled; using the existing schema.');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
