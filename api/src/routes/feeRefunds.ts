import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireAnyPermission, requirePermission } from '../middleware/auth';
import {
  readFeeRefund,
  requestFeeRefund,
  sendFeeRefund,
  confirmFeeRefund,
  rejectFeeRefund,
} from '../modules/feeRefunds/service';
const router = Router();
const id = z.string().uuid();
const reason = z.string().trim().min(10).max(2000);
const decision = z
  .object({ refundId: id, expectedRevision: z.number().int().nonnegative(), reason })
  .strict();
router.get(
  '/contracts/:id/fee/refund',
  requireAuth,
  requireAnyPermission('contract.read', 'finance.manage'),
  async (req, res, next) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json(await readFeeRefund(req.user!, id.parse(req.params.id)));
    } catch (error) {
      next(error);
    }
  },
);
router.post(
  '/contracts/:id/fee/refund/request',
  requireAuth,
  requirePermission('offer.respond'),
  async (req, res, next) => {
    try {
      res.json(
        await requestFeeRefund(
          req.user!,
          id.parse(req.params.id),
          z
            .object({
              reason,
              idempotencyKey: id,
              expectedFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
            })
            .strict()
            .parse(req.body),
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);
router.post(
  '/contracts/:id/fee/refund/send',
  requireAuth,
  requirePermission('finance.manage'),
  async (req, res, next) => {
    try {
      res.json(
        await sendFeeRefund(
          req.user!,
          id.parse(req.params.id),
          decision
            .extend({
              amount: z.string().regex(/^\d+(?:\.\d+)?$/),
              currency: z.string().regex(/^[A-Z]{3}$/),
              reference: z.string().trim().min(3).max(200),
            })
            .strict()
            .parse(req.body),
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);
router.post(
  '/contracts/:id/fee/refund/confirm',
  requireAuth,
  requirePermission('offer.respond'),
  async (req, res, next) => {
    try {
      res.json(
        await confirmFeeRefund(req.user!, id.parse(req.params.id), decision.parse(req.body)),
      );
    } catch (error) {
      next(error);
    }
  },
);
router.post(
  '/contracts/:id/fee/refund/reject',
  requireAuth,
  requirePermission('finance.manage'),
  async (req, res, next) => {
    try {
      res.json(await rejectFeeRefund(req.user!, id.parse(req.params.id), decision.parse(req.body)));
    } catch (error) {
      next(error);
    }
  },
);
export = router;
