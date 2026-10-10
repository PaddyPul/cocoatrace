import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import validate from '../middleware/validate';
import { createSourcingRequestSchema } from '../validation';
import * as controller from '../controllers/sourcingController';
import { structureSourcingBriefSchema } from '../validation';

const router = Router();
router.get('/sourcing-requests/page', requireAuth, requirePermission('listing.read'), controller.listRequestPage);
router.get('/sourcing-requests/summary', requireAuth, requirePermission('listing.read'), controller.summarizeRequests);
router.get('/sourcing-requests', requireAuth, requirePermission('listing.read'), controller.listRequests);
router.post('/sourcing-requests/structure', requireAuth, requirePermission('offer.create'), validate(structureSourcingBriefSchema), controller.structureRequest);
router.post('/sourcing-requests', requireAuth, requirePermission('offer.create'), validate(createSourcingRequestSchema), controller.createRequest);
router.patch('/sourcing-requests/:id', requireAuth, requirePermission('offer.create'), controller.updateRequest);

export = router;
