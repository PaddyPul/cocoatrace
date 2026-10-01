import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { sensitiveActionLimit } from '../../middleware/security';
import validate from '../../middleware/validate';
import { OrganizationAccessController } from './controller';
import {
  organizationAccessIdSchema,
  requestOrganizationAccessSchema,
  reviewOrganizationAccessSchema,
  verifyOrganizationAccessSchema,
} from './schemas';

export function organizationAccessRoutes(controller: OrganizationAccessController): Router {
  const router = Router();
  router.post('/auth/request-access', sensitiveActionLimit, validate(requestOrganizationAccessSchema), controller.requestAccess);
  router.post('/auth/request-access/verify', sensitiveActionLimit, validate(verifyOrganizationAccessSchema), controller.verifyEmail);
  router.get('/access-applications', requireAuth, controller.list);
  router.get('/access-applications/:id', requireAuth, validate(organizationAccessIdSchema, 'params'), controller.detail);
  router.post('/access-applications/:id/approve', requireAuth, validate(organizationAccessIdSchema, 'params'), validate(reviewOrganizationAccessSchema), controller.approve);
  router.post('/access-applications/:id/reject', requireAuth, validate(organizationAccessIdSchema, 'params'), validate(reviewOrganizationAccessSchema), controller.reject);
  return router;
}
