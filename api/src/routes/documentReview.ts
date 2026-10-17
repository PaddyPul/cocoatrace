import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../middleware/auth';
import { decide, replace, reviewDetail, reviewPage } from '../modules/documentReview/service';
const router = Router();
const id = z.string().uuid();
const decision = z
  .object({
    decision: z.enum(['approved', 'rejected']),
    reason: z.string().trim().min(10).max(2000),
    expectedFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
const replacement = z
  .object({ replacementEvidenceId: id, expectedFingerprint: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
router.get('/evidence/review/page', requireAuth, requirePermission('*'), async (req, res, next) => {
  try {
    const input = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).default(25),
        cursor: id.optional(),
        id: id.optional(),
        status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
      })
      .strict()
      .parse(req.query);
    res.json(await reviewPage(req.user!, input));
  } catch (error) {
    next(error);
  }
});
router.get(
  '/evidence/:id/review',
  requireAuth,
  requirePermission('evidence.read'),
  async (req, res, next) => {
    try {
      res.json(await reviewDetail(req.user!, id.parse(req.params.id)));
    } catch (error) {
      next(error);
    }
  },
);
router.post('/evidence/:id/review', requireAuth, requirePermission('*'), async (req, res, next) => {
  try {
    res.json(await decide(req.user!, id.parse(req.params.id), decision.parse(req.body)));
  } catch (error) {
    next(error);
  }
});
router.post(
  '/evidence/:id/replacement',
  requireAuth,
  requirePermission('evidence.upload'),
  async (req, res, next) => {
    try {
      res.json(await replace(req.user!, id.parse(req.params.id), replacement.parse(req.body)));
    } catch (error) {
      next(error);
    }
  },
);
export = router;
