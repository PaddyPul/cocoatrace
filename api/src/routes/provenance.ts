import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as provenanceController from '../controllers/provenanceController';

const router = Router();

router.get('/provenance/batches/:batchId', requireAuth, provenanceController.getProvenancePack);
router.get('/provenance/batches/:batchId/export', requireAuth, provenanceController.exportProvenancePack);

export = router;
