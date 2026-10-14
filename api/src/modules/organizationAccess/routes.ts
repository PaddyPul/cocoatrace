import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth';
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
  router.post(
    '/auth/request-access',
    sensitiveActionLimit,
    validate(requestOrganizationAccessSchema),
    controller.requestAccess,
  );
  router.post(
    '/auth/request-access/verify',
    sensitiveActionLimit,
    validate(verifyOrganizationAccessSchema),
    controller.verifyEmail,
  );
  router.get('/access-applications/page', requireAuth, requirePermission('*'), controller.page);
  router.get(
    '/access-applications/summary',
    requireAuth,
    requirePermission('*'),
    controller.summary,
  );
  router.get('/access-applications', requireAuth, requirePermission('*'), controller.list);
  router.get(
    '/access-applications/:id',
    requireAuth,
    requirePermission('*'),
    validate(organizationAccessIdSchema, 'params'),
    controller.detail,
  );
  router.post(
    '/access-applications/:id/approve',
    requireAuth,
    requirePermission('*'),
    validate(organizationAccessIdSchema, 'params'),
    validate(reviewOrganizationAccessSchema),
    controller.approve,
  );
  router.post(
    '/access-applications/:id/reject',
    requireAuth,
    requirePermission('*'),
    validate(organizationAccessIdSchema, 'params'),
    validate(reviewOrganizationAccessSchema),
    controller.reject,
  );
  return router;
}
