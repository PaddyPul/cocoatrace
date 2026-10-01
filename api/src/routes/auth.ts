import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import validate from '../middleware/validate';
import { changePasswordSchema, forgotPasswordSchema, loginSchema, resetPasswordSchema } from '../validation';
import * as authController from '../controllers/authController';
import { sensitiveActionLimit } from '../middleware/security';

const router = Router();

router.post('/auth/login', sensitiveActionLimit, validate(loginSchema), authController.login);
router.post('/auth/logout', requireAuth, authController.logout);
router.post('/auth/password/forgot', sensitiveActionLimit, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/auth/password/reset', sensitiveActionLimit, validate(resetPasswordSchema), authController.completePasswordReset);
router.post('/auth/password/change', requireAuth, sensitiveActionLimit, validate(changePasswordSchema), authController.updatePassword);
router.get('/me', requireAuth, authController.me);

export = router;
