import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireAnyPermission, requirePermission } from '../middleware/auth';
import { consentFeeTerms, readEnforcement, setFeeCredit } from '../modules/feeEnforcement/service';
const router = Router();
const id = z.string().uuid();
router.get(
  '/contracts/:id/fee/enforcement',
  requireAuth,
  requireAnyPermission('contract.read', 'finance.manage'),
  async (req, res, next) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json(await readEnforcement(req.user!, id.parse(req.params.id)));
    } catch (error) {
      next(error);
    }
  },
);
router.post(
  '/contracts/:id/fee/terms',
  requireAuth,
  requirePermission('offer.respond'),
  async (req, res, next) => {
    try {
      const body = z
        .object({
          policyVersion: z.literal('seller-predispatch-v3'),
          accepted: z.literal(true),
          expectedFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
        })
        .strict()
        .parse(req.body);
      res.json(
        await consentFeeTerms(
          req.user!,
          id.parse(req.params.id),
          body.policyVersion,
          body.expectedFingerprint,
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);
router.post(
  '/contracts/:id/fee/credit',
  requireAuth,
  requirePermission('finance.manage'),
  async (req, res, next) => {
    try {
      const body = z
        .object({
          reason: z.string().trim().min(10).max(2000),
          expectedRevision: z.number().int().nonnegative(),
          creditUntil: z.string().datetime().nullable(),
        })
        .strict()
        .parse(req.body);
      res.json(await setFeeCredit(req.user!, id.parse(req.params.id), body));
    } catch (error) {
      next(error);
    }
  },
);
export = router;
