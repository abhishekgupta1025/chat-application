import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { runDatabaseCleanup } from '../scripts/cleanup';
import { env } from '../config/env';

const router = Router();

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * POST /api/admin/cleanup
 * Allows administrators or scheduled cron jobs to optimize PostgreSQL database storage
 */
router.post('/cleanup', async (req: Request, res: Response) => {
  try {
    const expectedKey = env.adminSecret;
    const adminKey = req.headers['x-admin-key'];

    if (!expectedKey || typeof adminKey !== 'string' || !safeCompare(adminKey, expectedKey)) {
      return res.status(403).json({ error: 'Unauthorized: Invalid admin key' });
    }

    const { days, all } = req.body || {};
    const result = await runDatabaseCleanup({
      days: days ? parseInt(days, 10) : undefined,
      resetAll: !!all
    });

    res.json({ message: 'Database cleanup completed successfully!', ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Cleanup failed' });
  }
});

export default router;
