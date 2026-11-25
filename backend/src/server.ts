import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';

import { connectDB } from './config/db';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import conversationRoutes from './routes/conversations';
import messageRoutes from './routes/messages';
import adminRoutes from './routes/admin';

import { socketAuthMiddleware } from './middleware/socketAuth';
import { errorHandler } from './middleware/errorHandler';
import { setupSocketServer } from './socket';

const app = express();
const server = http.createServer(app);

// Allow Cross-Origin Requests from Localhost & Production Vercel Deployment
const rawOrigins = process.env.FRONTEND_URL || 'http://localhost:3000';
const allowedOrigins = rawOrigins.includes(',')
  ? rawOrigins.split(',').map((o) => o.trim())
  : rawOrigins === '*'
  ? true
  : [rawOrigins, 'http://localhost:3000'];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  })
);

app.use(express.json());

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
setInterval(() => {
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
}, 1000).unref();

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

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Chat Backend running via Bun on http://localhost:${PORT}`);
});
