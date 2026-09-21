import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import validate from '../middleware/validate';
import { onboardingSchema, pilotFeedbackSchema } from '../validation';
import * as controller from '../controllers/workspaceController';

const router = Router();

router.get('/onboarding', requireAuth, controller.getOnboarding);
router.put('/onboarding', requireAuth, validate(onboardingSchema), controller.updateOnboarding);
router.post('/pilot-feedback', requireAuth, validate(pilotFeedbackSchema), controller.createFeedback);
router.get('/pilot-feedback', requireAuth, requirePermission('organization.admin'), controller.listFeedback);

export = router;
