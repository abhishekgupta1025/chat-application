import { Router, Request, Response } from 'express';
import { runDatabaseCleanup } from '../scripts/cleanup';

const router = Router();

/**
 * POST /api/admin/cleanup
 * Allows administrators or scheduled cron jobs to optimize PostgreSQL database storage
 */
router.post('/cleanup', async (req: Request, res: Response) => {
  try {
    const adminKey = req.headers['x-admin-key'] || req.query.key;
    const expectedKey = process.env.ADMIN_SECRET || 'supersecretjwtkey_12345';

    if (process.env.ADMIN_SECRET && adminKey !== expectedKey) {
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
