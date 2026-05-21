import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import validate from '../middleware/validate';
import { createShipmentSchema, createMilestoneSchema } from '../validation';
import * as shipmentController from '../controllers/shipmentController';

const router = Router();

router.get('/shipments', requireAuth, requirePermission('shipment.read'), shipmentController.listShipments);
router.get('/shipments/:id', requireAuth, requirePermission('shipment.read'), shipmentController.getShipment);
router.post('/contracts/:id/shipments', requireAuth, requirePermission('shipment.request'), validate(createShipmentSchema), shipmentController.requestShipment);
router.post('/shipments/:id/milestones', requireAuth, requirePermission('shipment.update'), validate(createMilestoneSchema), shipmentController.recordMilestone);

export = router;
