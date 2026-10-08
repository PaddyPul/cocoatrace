import { publicActionLimiter } from '../middleware/publicRateLimit';
import { Router } from 'express';
import express from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import validate from '../middleware/validate';
import { createEvidenceUploadIntentSchema, evidenceListQuerySchema } from '../validation';
import * as evidenceController from '../controllers/evidenceController';
import { config } from '../config/env';

import { listEvidenceOptions } from '../modules/catalog/evidenceOptions';
import { listEvidencePage,summarizeEvidence } from '../modules/catalog/evidenceRecords';

const router = Router();

router.get('/evidence/record-options', requireAuth, requirePermission('evidence.upload'), listEvidenceOptions);

router.get('/evidence/summary',requireAuth,requirePermission('evidence.read'),summarizeEvidence);
router.get('/evidence/page', requireAuth, requirePermission('evidence.read'), listEvidencePage);

router.get('/evidence', requireAuth, requirePermission('evidence.read'), validate(evidenceListQuerySchema, 'query'), evidenceController.listEvidence);
router.get('/evidence/:id/download', requireAuth, requirePermission('evidence.read'), evidenceController.downloadEvidence);
router.post('/evidence/upload-intents', requireAuth, requirePermission('evidence.upload'), publicActionLimiter('uploadIntent'), validate(createEvidenceUploadIntentSchema), evidenceController.createEvidenceUploadIntent);
router.put('/evidence/upload-intents/:id/content', publicActionLimiter('uploadContent'), express.raw({ type: '*/*', limit: config.evidenceMaxFileBytes }), evidenceController.uploadEvidenceContent);

export = router;
