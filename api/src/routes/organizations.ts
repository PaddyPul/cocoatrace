import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import validate from '../middleware/validate';
import { createOrganizationSchema } from '../validation';
import * as orgController from '../controllers/organizationController';

const router = Router();

router.get('/organizations', requireAuth, orgController.listOrganizations);
router.post('/organizations', requireAuth, validate(createOrganizationSchema), orgController.createOrganization);
router.get('/organizations/:id/members', requireAuth, orgController.listOrganizationMembers);

export = router;
