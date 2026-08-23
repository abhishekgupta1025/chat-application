import { describe, expect, it, afterAll } from 'bun:test';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import { io as ClientSocketIO, Socket as ClientSocket } from 'socket.io-client';

import authRoutes from '../routes/auth';
import userRoutes from '../routes/users';
import conversationRoutes from '../routes/conversations';
import messageRoutes from '../routes/messages';
import { socketAuthMiddleware } from '../middleware/socketAuth';
import { setupSocketServer } from '../socket';
import { errorHandler } from '../middleware/errorHandler';
import { db } from '../config/db';

const TEST_PORT = 5055;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Create Express + Socket Server for E2E Testing
const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.get('/health', (_req, res) => res.json({ status: 'healthy', database: 'PostgreSQL' }));
app.use(errorHandler);

const server = http.createServer(app);
const ioServer = new SocketIOServer(server, { cors: { origin: '*' } });
ioServer.use(socketAuthMiddleware);
setupSocketServer(ioServer);

let client1: ClientSocket | null = null;
let client2: ClientSocket | null = null;

describe('Full-Stack End-to-End Live Integration Suite', () => {
  const timestamp = Date.now();
  const user1Name = `tester1_${timestamp}`;
  const user2Name = `tester2_${timestamp}`;
  const password = 'TestPassword123!';

  let user1Token = '';
  let user1Id = '';
  let user2Token = '';
  let user2Id = '';
  let directConvId = '';
  let groupConvId = '';

  it('should start the test HTTP and Socket server', async () => {
    await new Promise<void>((resolve) => {
      server.listen(TEST_PORT, () => resolve());
    });
    expect(server.listening).toBe(true);
  });

  it('1. GET /health - should return healthy status and PostgreSQL info', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('healthy');
    expect(data.database).toBe('PostgreSQL');
  });

  it('2. POST /api/auth/register - should register user 1 and user 2 in PostgreSQL', async () => {
    const res1 = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user1Name, password })
    });
    expect(res1.status).toBe(201);

    const res2 = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user2Name, password })
    });
    expect(res2.status).toBe(201);
  });

  it('3. POST /api/auth/login - should authenticate and return JWT with user UUID', async () => {
    const res1 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user1Name, password })
    });
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.token).toBeDefined();
    expect(data1.user.username).toBe(user1Name);
    user1Token = data1.token;
    user1Id = data1.user.id;

    const res2 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user2Name, password })
    });
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    user2Token = data2.token;
    user2Id = data2.user.id;
  });

  it('4. GET /api/users - should list contacts with passwords stripped', async () => {
    const res = await fetch(`${BASE_URL}/api/users`, {
      headers: { Authorization: `Bearer ${user1Token}` }
    });
    expect(res.status).toBe(200);
    const users = await res.json();
    expect(Array.isArray(users)).toBe(true);
    expect(users.some((u: any) => u.username === user2Name)).toBe(true);
    expect(users.every((u: any) => u.password === undefined)).toBe(true);
  });

  it('5. POST /api/conversations - should create a 1-on-1 direct conversation', async () => {
    const res = await fetch(`${BASE_URL}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`
      },
      body: JSON.stringify({ recipientId: user2Id })
    });
    expect([200, 201]).toContain(res.status);
    const conv = await res.json();
    expect(conv.isGroup).toBe(false);
    expect(conv.participants.length).toBe(2);
    directConvId = conv._id || conv.id;
  });

  it('6. POST /api/conversations/group - should create a multi-user group channel', async () => {
    const res = await fetch(`${BASE_URL}/api/conversations/group`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`
      },
      body: JSON.stringify({
        name: 'E2E Testing Channel',
        participantIds: [user2Id]
      })
    });
    expect(res.status).toBe(201);
    const group = await res.json();
    expect(group.isGroup).toBe(true);
    expect(group.name).toBe('E2E Testing Channel');
    groupConvId = group._id || group.id;
  });

  it('7. WebSocket Handshake & Live Real-Time Messaging', async () => {
    // Connect User 1 via Socket.IO client
    client1 = ClientSocketIO(BASE_URL, {
      auth: { token: user1Token },
      transports: ['websocket']
    });

    // Connect User 2 via Socket.IO client
    client2 = ClientSocketIO(BASE_URL, {
      auth: { token: user2Token },
      transports: ['websocket']
    });

    // Wait for both clients to connect
    await Promise.all([
      new Promise<void>((resolve) => client1?.on('connect', () => resolve())),
      new Promise<void>((resolve) => client2?.on('connect', () => resolve()))
    ]);

    expect(client1?.connected).toBe(true);
    expect(client2?.connected).toBe(true);

    // Join direct conversation room
    client1?.emit('join_conversation', directConvId);
    client2?.emit('join_conversation', directConvId);

    // Send a message from User 1 and verify User 2 receives it
    const testMessageText = 'Hello from automated E2E live test!';
    const messagePromise = new Promise<{ message: any; tempId?: string }>((resolve) => {
      client2?.on('receive_message', (payload) => {
        resolve(payload);
      });
    });

    client1?.emit('send_message', {
      conversationId: directConvId,
      text: testMessageText,
      tempId: 'temp_e2e_123'
    });

    const received = await messagePromise;
    expect(received.message.text).toBe(testMessageText);
    expect(received.message.senderName).toBe(user1Name);
    expect(received.tempId).toBe('temp_e2e_123');
  });

  it('8. GET /api/messages/:id - should retrieve message history from PostgreSQL', async () => {
    const res = await fetch(`${BASE_URL}/api/messages/${directConvId}`, {
      headers: { Authorization: `Bearer ${user2Token}` }
    });
    expect(res.status).toBe(200);
    const history = await res.json();
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].text).toBe('Hello from automated E2E live test!');
  });

  afterAll(async () => {
    client1?.disconnect();
    client2?.disconnect();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
