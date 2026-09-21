import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import validate from '../middleware/validate';
import { loginSchema } from '../validation';
import * as authController from '../controllers/authController';
import { sensitiveActionLimit } from '../middleware/security';

const router = Router();

router.post('/auth/login', sensitiveActionLimit, validate(loginSchema), authController.login);
router.post('/auth/logout', authController.logout);
router.get('/me', requireAuth, authController.me);

export = router;
