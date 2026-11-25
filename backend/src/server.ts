import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';

import { connectDB, pgClient } from './config/db';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import conversationRoutes from './routes/conversations';
import messageRoutes from './routes/messages';
import adminRoutes from './routes/admin';

import { socketAuthMiddleware } from './middleware/socketAuth';
import { errorHandler } from './middleware/errorHandler';
import { setupSocketServer } from './socket';

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

// Allow Cross-Origin Requests from Localhost & Production Vercel Deployment
const rawOrigins = env.frontendUrl;
const allowedOrigins = rawOrigins.includes(',')
  ? rawOrigins.split(',').map((o) => o.trim())
  : rawOrigins === '*'
  ? true
  : [rawOrigins, 'http://localhost:3000'];

app.use(helmet());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  })
);

app.use(express.json({ limit: '100kb' }));

// Setup API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);

// Lightweight event-loop lag monitor (1s timer drift check)
let eventLoopLagMs = 0;
let maxEventLoopLagMs = 0;
let lastTick = performance.now();
const lagInterval = setInterval(() => {
  const now = performance.now();
  const lag = Math.max(0, now - lastTick - 1000);
  lastTick = now;
  eventLoopLagMs = Number(lag.toFixed(1));
  if (eventLoopLagMs > maxEventLoopLagMs) {
    maxEventLoopLagMs = eventLoopLagMs;
  }
  if (lag > 100) {
    console.warn(`⚠️ Event-loop lag spike: ${eventLoopLagMs}ms`);
  }
}, 1000);
lagInterval.unref();

// Health check endpoint (Used by Render / Railway / Uptime Robot to keep server alive)
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    runtime: 'Bun',
    version: '3.0.0',
    database: 'PostgreSQL (Supabase)',
    eventLoopLagMs,
    maxEventLoopLagMs,
    timestamp: new Date()
  });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

// Configure Socket.IO Server with Production CORS
const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Socket Authentication Middleware: Verifies JWT token on WebSocket handshake
io.use(socketAuthMiddleware);

// Initialize Socket event listeners & presence
setupSocketServer(io);

// Connect to PostgreSQL Database
connectDB();

const PORT = env.port;
server.listen(PORT, () => {
  console.log(`🚀 Chat Backend running via Bun on http://localhost:${PORT}`);
});

let isShuttingDown = false;
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`🛑 Received ${signal}, closing HTTP/Socket servers and database pool...`);
  clearInterval(lagInterval);

  const forceTimer = setTimeout(() => {
    console.error('⏱️ Graceful shutdown timed out, forcing exit.');
    process.exit(1);
  }, 8000);
  forceTimer.unref();

  try {
    await new Promise<void>((resolve) => io.close(() => resolve()));
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pgClient.end({ timeout: 5 });
    console.log('✅ Graceful shutdown complete.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during graceful shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
