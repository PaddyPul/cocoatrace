import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { sensitiveActionLimit } from '../../middleware/security';
import validate from '../../middleware/validate';
import { targetSchema, decisionSchema, listSchema } from './schemas';
import { listAccess } from './repository';
import { decideAccess } from './service';
const router = Router();
router.use('/admin/access-controls', requireAuth, requirePermission('*'));
router.get(
  '/admin/access-controls/:kind',
  validate(z.object({ kind: z.enum(['organizations', 'users']) }), 'params'),
  validate(listSchema, 'query'),
  async (req, res) => {
    const params = listSchema.parse(req.query);
    res.json(
      await listAccess(
        req.user!,
        req.params.kind as 'organizations' | 'users',
        params.after,
        params.organizationId,
      ),
    );
  },
);
router.post(
  '/admin/access-controls/:kind/:id',
  validate(targetSchema, 'params'),
  sensitiveActionLimit,
  validate(decisionSchema),
  async (req, res) => {
    res.json(
      await decideAccess(
        req.user!,
        req.params.kind as 'organizations' | 'users',
        req.params.id,
        decisionSchema.parse(req.body),
      ),
    );
  },
);
export default router;
