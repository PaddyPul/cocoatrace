import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import validate from '../middleware/validate';
import { createOrganizationSchema } from '../validation';
import * as orgController from '../controllers/organizationController';

const router = Router();

router.get('/organizations', requireAuth, requirePermission('organization.admin'), orgController.listOrganizations);
router.post('/organizations', requireAuth, requirePermission('organization.admin'), validate(createOrganizationSchema), orgController.createOrganization);
router.get('/organizations/:id/members', requireAuth, requirePermission('organization.admin'), orgController.listOrganizationMembers);

export = router;
