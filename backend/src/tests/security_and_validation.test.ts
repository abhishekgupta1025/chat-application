import { describe, expect, it } from 'bun:test';
import express from 'express';
import adminRouter from '../routes/admin';
import { authenticateToken } from '../middleware/auth';
import { errorHandler } from '../middleware/errorHandler';
import { MessageService } from '../services/messageService';
import { ConversationService } from '../services/conversationService';
import { BadRequestError, ForbiddenError } from '../errors/AppError';
import { isValidUuid } from '../config/env';

describe('Security, Authorization & Validation Regression Suite', () => {
  it('isValidUuid should accept valid UUIDs and reject malformed inputs', () => {
    expect(isValidUuid('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')).toBe(true);
    expect(isValidUuid('not-a-uuid')).toBe(false);
    expect(isValidUuid('')).toBe(false);
  });

  it('POST /api/admin/cleanup should return 403 when ADMIN_SECRET is unset or wrong', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);

    const server = app.listen(0);
    const addr = server.address() as { port: number };
    try {
      const res = await fetch(`http://127.0.0.1:${addr.port}/api/admin/cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': 'supersecretjwtkey_12345' },
        body: JSON.stringify({ all: true })
      });
      expect(res.status).toBe(403);
    } finally {
      server.close();
    }
  });

  it('MessageService should enforce 4000-char limit, valid UUIDs, and valid before timestamp', async () => {
    const msgSvc = new MessageService(
      { create: async () => ({} as any), findByConversation: async () => [] } as any,
      { isParticipant: async () => true, updateLastMessage: async () => {} } as any
    );

    const validConvId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const validUserId = 'b1ffcd88-8b0a-3ef7-aa5c-5aa8ac270b22';

    await expect(
      msgSvc.sendMessage(validConvId, validUserId, 'alice', 'x'.repeat(4001))
    ).rejects.toBeInstanceOf(BadRequestError);

    await expect(
      msgSvc.sendMessage('bad-uuid', validUserId, 'alice', 'hello')
    ).rejects.toBeInstanceOf(BadRequestError);

    await expect(
      msgSvc.getConversationMessages(validConvId, validUserId, 'not-a-date')
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('ConversationService should throw ForbiddenError (403) instead of ReferenceError for non-members', async () => {
    const convSvc = new ConversationService(
      { isParticipant: async () => false } as any,
      {} as any
    );
    const validConvId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const validUserId = 'b1ffcd88-8b0a-3ef7-aa5c-5aa8ac270b22';

    await expect(
      convSvc.clearConversationMessages(validConvId, validUserId)
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      convSvc.deleteConversation(validConvId, validUserId)
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('errorHandler should map Postgres 22P02 invalid input syntax to HTTP 400', () => {
    let statusCode = 0;
    let body: any = null;
    const mockRes = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: any) {
        body = payload;
        return this;
      }
    } as any;

    const pgErr = Object.assign(new Error('invalid input syntax for type uuid'), { code: '22P02' });
    errorHandler(pgErr, {} as any, mockRes, () => {});
    expect(statusCode).toBe(400);
    expect(body?.success).toBe(false);
  });

  it('authenticateToken should return 401 (not 403) for invalid or expired JWTs', () => {
    let statusCode = 0;
    let body: any = null;
    const mockReq = { headers: { authorization: 'Bearer invalid.jwt.token' } } as any;
    const mockRes = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: any) {
        body = payload;
        return this;
      }
    } as any;

    authenticateToken(mockReq, mockRes, () => {});
    expect(statusCode).toBe(401);
    expect(body?.error).toContain('Invalid or expired');
  });

  it('MessageService.deleteMessage should return updated lastMessage for sidebar sync', async () => {
    const validConvId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const validUserId = 'b1ffcd88-8b0a-3ef7-aa5c-5aa8ac270b22';
    const validMsgId = 'c2ffcd88-8b0a-3ef7-aa5c-5aa8ac270b33';
    const prevMsg = {
      id: 'd3ffcd88-8b0a-3ef7-aa5c-5aa8ac270b44',
      conversationId: validConvId,
      senderId: validUserId,
      senderName: 'alice',
      text: 'earlier message',
      status: 'read',
      createdAt: new Date()
    };

    const msgSvc = new MessageService(
      {
        findById: async () => ({ id: validMsgId, conversationId: validConvId, senderId: validUserId }),
        deleteById: async () => ({}),
        findByConversation: async () => [prevMsg]
      } as any,
      { updateLastMessage: async () => {} } as any
    );

    const res = await msgSvc.deleteMessage(validMsgId, validUserId);
    expect(res.success).toBe(true);
    expect(res.lastMessage?.id).toBe(prevMsg.id);
    expect(res.lastMessage?.text).toBe('earlier message');
  });

  it('ConversationService.getUserConversations should attach unreadCount per conversation', async () => {
    const convId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const userId = 'b1ffcd88-8b0a-3ef7-aa5c-5aa8ac270b22';
    const convSvc = new ConversationService(
      {
        findUserConversations: async () => [
          { id: convId, isGroup: false, name: null, adminId: null, updatedAt: new Date(), createdAt: new Date(), participants: [], lastMessage: null }
        ],
        countUnreadByConversation: async () => new Map([[convId, 4]])
      } as any,
      {} as any
    );

    const list = await convSvc.getUserConversations(userId);
    expect(list[0].unreadCount).toBe(4);
  });
});
