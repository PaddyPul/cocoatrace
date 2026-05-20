import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import validate from '../middleware/validate';
import { loginSchema } from '../validation';
import * as authController from '../controllers/authController';

const router = Router();

router.post('/auth/login', validate(loginSchema), authController.login);
router.get('/me', requireAuth, authController.me);

export = router;
