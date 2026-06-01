import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import validate from '../middleware/validate';
import { createHoldingSchema, transferHoldingSchema, splitHoldingSchema } from '../validation';
import * as holdingController from '../controllers/holdingController';

const router = Router();

router.get('/transfers', requireAuth, requirePermission('custody.transfer.request'), holdingController.listTransfers);
router.get('/holdings', requireAuth, requirePermission('holding.read'), holdingController.listHoldings);
router.get('/holdings/:id', requireAuth, requirePermission('holding.read'), holdingController.getHolding);
router.post('/holdings', requireAuth, requirePermission('holding.create'), validate(createHoldingSchema), holdingController.createHolding);
router.post('/holdings/:id/transfer', requireAuth, requirePermission('custody.transfer.request'), validate(transferHoldingSchema), holdingController.transferHolding);
router.post('/transfers/:id/accept', requireAuth, requirePermission('custody.transfer.accept'), holdingController.acceptTransfer);
router.post('/holdings/:id/split', requireAuth, requirePermission('holding.create'), validate(splitHoldingSchema), holdingController.splitHolding);

export = router;
