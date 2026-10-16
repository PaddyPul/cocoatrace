import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { sensitiveActionLimit } from '../../middleware/security';
import validate from '../../middleware/validate';
import { acknowledgementBody } from './policy';
import { dispatchAcknowledgement } from './repository';
const router = Router();
const params = z.object({ id: z.string().uuid() }).strict();
router.get(
  '/shipments/:id/dispatch-acknowledgement',
  requireAuth,
  requirePermission('shipment.read'),
  validate(params, 'params'),
  async (req, res) => {
    res.json(await dispatchAcknowledgement(req.user!, String(req.params.id)));
  },
);
router.post(
  '/shipments/:id/dispatch-acknowledgement',
  requireAuth,
  requirePermission('shipment.read'),
  sensitiveActionLimit,
  validate(params, 'params'),
  validate(acknowledgementBody),
  async (req, res) => {
    res.json(
      await dispatchAcknowledgement(
        req.user!,
        String(req.params.id),
        acknowledgementBody.parse(req.body),
      ),
    );
  },
);
export default router;
