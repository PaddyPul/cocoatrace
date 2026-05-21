import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import * as provenanceController from '../controllers/provenanceController';

const router = Router();

router.get('/provenance/batches/:batchId', requireAuth, requirePermission('batch.read'), provenanceController.getProvenancePack);
router.get('/provenance/batches/:batchId/export', requireAuth, requirePermission('provenance.export'), provenanceController.exportProvenancePack);

export = router;
