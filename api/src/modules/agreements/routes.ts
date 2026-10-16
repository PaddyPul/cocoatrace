import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { sensitiveActionLimit } from '../../middleware/security';
import validate from '../../middleware/validate';
import { acceptanceBody } from './policy';
import { agreementAcceptance } from './repository';
const router = Router();
const params = z.object({ id: z.string().uuid() }).strict();
router.get(
  '/contracts/:id/acceptance',
  requireAuth,
  requirePermission('contract.read'),
  validate(params, 'params'),
  async (req, res) => {
    res.json(await agreementAcceptance(req.user!, String(req.params.id)));
  },
);
router.post(
  '/contracts/:id/acceptance',
  requireAuth,
  requirePermission('contract.read'),
  sensitiveActionLimit,
  validate(params, 'params'),
  validate(acceptanceBody),
  async (req, res) => {
    res.json(
      await agreementAcceptance(req.user!, String(req.params.id), acceptanceBody.parse(req.body)),
    );
  },
);
export default router;
