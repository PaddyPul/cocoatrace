import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import validate from '../middleware/validate';
import { createBatchSchema, attestBatchSchema } from '../validation';
import * as batchController from '../controllers/batchController';

const router = Router();

router.get('/batches', requireAuth, batchController.listBatches);
router.get('/batches/:id', requireAuth, batchController.getBatch);
router.post('/batches', requireAuth, validate(createBatchSchema), batchController.createBatch);
router.post('/batches/:id/attest', requireAuth, requirePermission('batch.attest'), validate(attestBatchSchema), batchController.attestBatch);

export = router;
