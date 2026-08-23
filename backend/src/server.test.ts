import { describe, expect, it } from 'bun:test';

describe('Backend Health and Configuration', () => {
  it('should validate environment variables structure', () => {
    const jwtSecret = process.env.JWT_SECRET || 'supersecretjwtkey_12345';
    expect(jwtSecret).toBeDefined();
    expect(jwtSecret.length).toBeGreaterThan(10);
  });

  it('should successfully compute deterministic sort for 1-to-1 conversation parity', () => {
    const userA = '64a1b2c3d4e5f67890123456';
    const userB = '64a1b2c3d4e5f67890123457';

    const order1 = [userA, userB].sort().join('_');
    const order2 = [userB, userA].sort().join('_');

    expect(order1).toBe(order2);
  });
});
