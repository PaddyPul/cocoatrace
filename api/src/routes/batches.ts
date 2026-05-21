import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import validate from '../middleware/validate';
import { createBatchSchema, attestBatchSchema, pushToMarketplaceSchema } from '../validation';
import * as batchController from '../controllers/batchController';

const router = Router();

router.get('/batches', requireAuth, requirePermission('batch.read'), batchController.listBatches);
router.get('/batches/:id', requireAuth, requirePermission('batch.read'), batchController.getBatch);
router.post('/batches', requireAuth, requirePermission('batch.create'), validate(createBatchSchema), batchController.createBatch);
router.post('/batches/:id/attest', requireAuth, requirePermission('batch.attest'), validate(attestBatchSchema), batchController.attestBatch);
router.post('/batches/:id/push-to-marketplace', requireAuth, requirePermission('batch.create'), validate(pushToMarketplaceSchema), batchController.pushToMarketplace);

export = router;
