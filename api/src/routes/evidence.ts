import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { requireAuth, requirePermission } from '../middleware/auth';
import validate from '../middleware/validate';
import { evidenceListQuerySchema, uploadEvidenceSchema } from '../validation';
import * as evidenceController from '../controllers/evidenceController';

const uploadsDir = path.join(__dirname, '../../uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
const upload = multer({ dest: uploadsDir });

const router = Router();

router.get('/evidence', requireAuth, requirePermission('evidence.read'), validate(evidenceListQuerySchema, 'query'), evidenceController.listEvidence);
router.get('/evidence/:id/download', requireAuth, requirePermission('evidence.read'), evidenceController.downloadEvidence);
router.post('/evidence', requireAuth, requirePermission('evidence.upload'), upload.single('file'), validate(uploadEvidenceSchema), evidenceController.uploadEvidence);

export = router;
