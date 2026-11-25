import { describe, expect, it } from 'bun:test';
import express from 'express';
import adminRouter from '../routes/admin';
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
});
