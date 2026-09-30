import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import * as provenanceController from '../controllers/provenanceController';
import validate from '../middleware/validate';
import { provenanceExportQuerySchema, provenanceViewQuerySchema } from '../validation';

const router = Router();

router.get('/provenance/batches/:batchId', requireAuth, requirePermission('batch.read'), validate(provenanceViewQuerySchema, 'query'), provenanceController.getProvenancePack);
router.get('/provenance/batches/:batchId/export', requireAuth, requirePermission('provenance.export'), validate(provenanceExportQuerySchema, 'query'), provenanceController.exportProvenancePack);

export = router;
