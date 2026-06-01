import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import validate from '../middleware/validate';
import { createCertificateSchema, certificateActionSchema } from '../validation';
import * as certController from '../controllers/certificateController';

const router = Router();

router.get('/certificates', requireAuth, requirePermission('certificate.read'), certController.listCertificates);
router.get('/certificates/:id', requireAuth, requirePermission('certificate.read'), certController.getCertificate);
router.post('/certificates', requireAuth, requirePermission('certificate.issue'), validate(createCertificateSchema), certController.issueCertificate);
router.post('/certificates/:id/:action', requireAuth, requirePermission('certificate.issue'), validate(certificateActionSchema), certController.updateCertificateStatus);

export = router;
