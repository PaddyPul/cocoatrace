import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../middleware/auth';
import { query } from '../db';
import { inDatabaseTransaction } from '../services/databaseTransaction';
import { statusHealthy } from '../modules/operations/jobs';
import { retryCleanup } from '../modules/operations/recovery';
import { ValidationError } from '../errors';

const router = Router();
router.use('/operations', requireAuth, requirePermission('*'));
router.get('/operations/status', async (_req, res, next) => {
  try {
    const jobs = await query(
      'SELECT job_name,status,started_at,finished_at,last_success_at,error_code,consecutive_failures,runs FROM operations_job_status ORDER BY job_name',
    );
    res.setHeader('Cache-Control', 'no-store');
    res.json({ healthy: statusHealthy(jobs.rows), jobs: jobs.rows });
  } catch (error) {
    next(error);
  }
});
router.get('/operations/cleanup/dead', async (_req, res, next) => {
  try {
    const rows =
      await query(`SELECT id,state,last_error_code,attempts,created_at,updated_at FROM evidence_object_cleanup
      WHERE state='dead' ORDER BY updated_at,id LIMIT 51`);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ items: rows.rows.slice(0, 50), more: rows.rows.length > 50 });
  } catch (error) {
    next(error);
  }
});
router.post('/operations/cleanup/:id/retry', async (req, res, next) => {
  try {
    const id = z.string().uuid().safeParse(req.params.id);
    const body = z
      .object({ reason: z.string().trim().min(10).max(500) })
      .strict()
      .safeParse(req.body);
    if (!id.success || !body.success)
      throw new ValidationError('A cleanup ID and explanation of 10–500 characters are required');
    const actor = req.user!;
    await inDatabaseTransaction((client) => retryCleanup(client, actor, id.data, body.data.reason));
    res.json({ queued: true });
  } catch (error) {
    next(error);
  }
});
export = router;
