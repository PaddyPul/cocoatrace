import {getWorkspaceTotals} from '../modules/catalog/workspace';
import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import validate from '../middleware/validate';
import { onboardingSchema, pilotFeedbackSchema } from '../validation';
import * as controller from '../controllers/workspaceController';

const router = Router();

router.get('/workspace/overview', requireAuth, getWorkspaceTotals);
router.get('/onboarding', requireAuth, controller.getOnboarding);
router.get('/trade-actions', requireAuth, controller.getTradeActions);
router.put('/onboarding', requireAuth, validate(onboardingSchema), controller.updateOnboarding);
router.post('/pilot-feedback', requireAuth, validate(pilotFeedbackSchema), controller.createFeedback);
router.get('/pilot-feedback', requireAuth, requirePermission('organization.admin'), controller.listFeedback);

export = router;
