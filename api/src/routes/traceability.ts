import { Router } from 'express';
import * as controller from '../controllers/traceabilityController';
import { requireAuth, requirePermission } from '../middleware/auth';
import validate from '../middleware/validate';
import { recallImpactSchema, traceQuantityQuerySchema } from '../validation';

const router = Router();

router.get('/traceability/lots', requireAuth, requirePermission('batch.read'), controller.listLots);
router.get('/traceability/lots/:id/trace-back', requireAuth, requirePermission('batch.read'), validate(traceQuantityQuerySchema, 'query'), controller.traceBack);
router.get('/traceability/lots/:id/trace-forward', requireAuth, requirePermission('batch.read'), validate(traceQuantityQuerySchema, 'query'), controller.traceForward);
router.post('/traceability/recall-impact', requireAuth, requirePermission('recall.manage'), validate(recallImpactSchema), controller.calculateRecallImpact);

export = router;
