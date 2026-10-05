import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission, requireAnyPermission } from '../middleware/auth';
import validate from '../middleware/validate';
import * as controller from '../controllers/feeController';
const router = Router();
const reason = z.string().trim().min(10).max(2000);
const reference = z.string().trim().min(3).max(200);
router.get(
  '/platform-fees',
  requireAuth,
  requireAnyPermission('payment.read', 'finance.manage'),
  controller.list,
);
router.get(
  '/platform-fees/reconciliation',
  requireAuth,
  requirePermission('finance.manage'),
  controller.reconcile,
);
router.get(
  '/contracts/:id/fee',
  requireAuth,
  requireAnyPermission('contract.read', 'finance.manage'),
  controller.get,
);
router.get(
  '/contracts/:id/fee/statement',
  requireAuth,
  requireAnyPermission('contract.read', 'finance.manage'),
  controller.download,
);
router.post(
  '/contracts/:id/fee/submit',
  requireAuth,
  requirePermission('contract.read'),
  requireAnyPermission('offer.create', 'offer.respond'),
  validate(z.object({ reference })),
  controller.submit,
);
router.post(
  '/contracts/:id/fee/submissions/:submissionId/review',
  requireAuth,
  requirePermission('finance.manage'),
  validate(
    z.discriminatedUnion('decision', [
      z.object({
        decision: z.literal('verify'),
        amount: z.string().regex(/^\d{1,12}(\.\d{1,2})?$/),
        currency: z.string().regex(/^[A-Z]{3}$/),
        receiptReference: reference,
      }),
      z.object({ decision: z.literal('reject'), reason }),
    ]),
  ),
  controller.review,
);
router.post(
  '/contracts/:id/fee/write-off',
  requireAuth,
  requirePermission('finance.manage'),
  validate(z.object({ reason })),
  controller.writeOff,
);
export = router;
