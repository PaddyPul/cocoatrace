import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import * as auditController from '../controllers/auditController';

const router = Router();

router.get('/audit/events', requireAuth, requirePermission('audit.read'), auditController.listAuditEvents);
router.get('/audit/export', requireAuth, requirePermission('audit.export'), auditController.exportAuditLog);

export = router;
