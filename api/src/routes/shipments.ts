import {listShipmentPage,summarizeShipments} from '../modules/catalog/shipments';
import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import validate from '../middleware/validate';
import { createMilestoneSchema, updateShipmentDetailsSchema } from '../validation';
import * as shipmentController from '../controllers/shipmentController';

const router = Router();

router.get('/shipments', requireAuth, requirePermission('shipment.read'), shipmentController.listShipments);
router.get('/shipments/page',requireAuth,requirePermission('shipment.read'),listShipmentPage);
router.get('/shipments/summary',requireAuth,requirePermission('shipment.read'),summarizeShipments);
router.get('/shipments/:id', requireAuth, requirePermission('shipment.read'), shipmentController.getShipment);
router.patch('/shipments/:id/details', requireAuth, requirePermission('shipment.update'), validate(updateShipmentDetailsSchema), shipmentController.updateShipmentDetails);
router.post('/shipments/:id/milestones', requireAuth, requirePermission('shipment.update'), validate(createMilestoneSchema), shipmentController.recordMilestone);

export = router;
