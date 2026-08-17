import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.js';
import { testDbConnection } from './db/pool.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json());
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

const server = app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
