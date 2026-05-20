import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import validate from '../middleware/validate';
import { createFarmSchema, createPlotSchema } from '../validation';
import * as farmController from '../controllers/farmController';

const router = Router();

router.get('/farms', requireAuth, farmController.listFarms);
router.get('/farms/:id', requireAuth, farmController.getFarm);
router.post('/farms', requireAuth, validate(createFarmSchema), farmController.createFarm);
router.post('/farms/:id/plots', requireAuth, validate(createPlotSchema), farmController.createPlot);

export = router;
