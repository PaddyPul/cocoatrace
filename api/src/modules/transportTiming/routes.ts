import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { sensitiveActionLimit } from '../../middleware/security';
import validate from '../../middleware/validate';
import { timingBody } from './policy';
import { transportTiming } from './repository';
const router = Router();
const params = z.object({ id: z.string().uuid() }).strict();
router.get(
  '/shipments/:id/timing',
  requireAuth,
  requirePermission('shipment.read'),
  validate(params, 'params'),
  async (req, res) => {
    res.json(await transportTiming(req.user!, String(req.params.id)));
  },
);
router.post(
  '/shipments/:id/timing',
  requireAuth,
  requirePermission('shipment.update'),
  sensitiveActionLimit,
  validate(params, 'params'),
  validate(timingBody),
  async (req, res) => {
    res.json(await transportTiming(req.user!, String(req.params.id), timingBody.parse(req.body)));
  },
);
export default router;
