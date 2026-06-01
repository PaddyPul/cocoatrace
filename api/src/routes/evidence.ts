import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { requireAuth, requirePermission } from '../middleware/auth';
import validate from '../middleware/validate';
import { uploadEvidenceSchema } from '../validation';
import * as evidenceController from '../controllers/evidenceController';

const uploadsDir = path.join(__dirname, '../../uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
const upload = multer({ dest: uploadsDir });

const router = Router();

router.get('/evidence', requireAuth, requirePermission('evidence.read'), evidenceController.listEvidence);
router.post('/evidence', requireAuth, requirePermission('evidence.upload'), upload.single('file'), validate(uploadEvidenceSchema), evidenceController.uploadEvidence);

export = router;
