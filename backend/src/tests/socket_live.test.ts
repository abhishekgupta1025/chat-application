import { describe, expect, it } from 'bun:test';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_12345';

describe('Socket.IO Protocol & Token Verification Suite', () => {
  const mockUser1 = { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', username: 'alice' };
  const mockUser2 = { id: 'b1ffcd88-8b0a-3ef7-aa5c-5aa8ac270b22', username: 'bob' };

  it('should generate valid JWT authorization token for socket handshake', () => {
    const token = jwt.sign({ userId: mockUser1.id, username: mockUser1.username }, JWT_SECRET);
    expect(token).toBeDefined();

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
    expect(decoded.userId).toBe(mockUser1.id);
    expect(decoded.username).toBe(mockUser1.username);
  });

  it('should guarantee deterministic room sorting for 1-to-1 conversation parity', () => {
    const key1 = [mockUser1.id, mockUser2.id].sort().join('_');
    const key2 = [mockUser2.id, mockUser1.id].sort().join('_');
    expect(key1).toBe(key2);
  });
});
