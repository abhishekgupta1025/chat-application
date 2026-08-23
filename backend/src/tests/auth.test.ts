import { describe, expect, it } from 'bun:test';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_12345';

describe('PostgreSQL Authentication & Security Test Suite', () => {
  const testPassword = 'Password123!';

  it('should securely hash password with bcrypt salt', async () => {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(testPassword, salt);

    expect(hash).not.toBe(testPassword);
    expect(hash.startsWith('$2')).toBe(true);

    const isMatch = await bcrypt.compare(testPassword, hash);
    expect(isMatch).toBe(true);

    const wrongMatch = await bcrypt.compare('WrongPassword!', hash);
    expect(wrongMatch).toBe(false);
  });

  it('should generate a cryptographically valid JWT with expected payload', () => {
    const mockId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const payload = { userId: mockId, username: 'testuser' };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
    expect(decoded.userId).toBe(mockId);
    expect(decoded.username).toBe('testuser');
  });

  it('should throw error when verifying JWT with incorrect secret', () => {
    const payload = { userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', username: 'alice' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

    expect(() => {
      jwt.verify(token, 'wrong_secret_key');
    }).toThrow();
  });
});
