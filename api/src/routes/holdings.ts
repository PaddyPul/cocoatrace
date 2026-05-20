import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import validate from '../middleware/validate';
import { createHoldingSchema, transferHoldingSchema, splitHoldingSchema } from '../validation';
import * as holdingController from '../controllers/holdingController';

const router = Router();

router.get('/holdings', requireAuth, holdingController.listHoldings);
router.post('/holdings', requireAuth, requirePermission('holding.create'), validate(createHoldingSchema), holdingController.createHolding);
router.post('/holdings/:id/transfer', requireAuth, validate(transferHoldingSchema), holdingController.transferHolding);
router.post('/transfers/:id/accept', requireAuth, holdingController.acceptTransfer);
router.post('/holdings/:id/split', requireAuth, validate(splitHoldingSchema), holdingController.splitHolding);

export = router;
