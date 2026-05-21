import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import validate from '../middleware/validate';
import { createFarmSchema, createPlotSchema } from '../validation';
import * as farmController from '../controllers/farmController';

const router = Router();

router.get('/farms', requireAuth, requirePermission('farm.read'), farmController.listFarms);
router.get('/farms/:id', requireAuth, requirePermission('farm.read'), farmController.getFarm);
router.post('/farms', requireAuth, requirePermission('farm.create'), validate(createFarmSchema), farmController.createFarm);
router.post('/farms/:id/plots', requireAuth, requirePermission('farm.create'), validate(createPlotSchema), farmController.createPlot);

export = router;
