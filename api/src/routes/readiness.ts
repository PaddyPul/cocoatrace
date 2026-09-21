import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getReadiness } from '../controllers/readinessController';

const router = Router();
router.get('/readiness', requireAuth, getReadiness);
export = router;
