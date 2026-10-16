import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { sensitiveActionLimit } from '../../middleware/security';
import { ValidationError } from '../../errors';
import { notificationFeed, setNoticeRead } from './repository';
const router = Router();
router.get('/notifications/page', requireAuth, async (req, res) => {
  res.json(await notificationFeed(req.user!, req.query));
});
router.get('/notifications/summary', requireAuth, async (req, res) => {
  res.json(await notificationFeed(req.user!));
});
router.post(
  '/notifications/:fingerprint/read',
  requireAuth,
  sensitiveActionLimit,
  async (req, res) => {
    if (
      !/^[a-f0-9]{64}$/.test(String(req.params.fingerprint)) ||
      !req.body ||
      typeof req.body.read !== 'boolean' ||
      Object.keys(req.body).some((key) => key !== 'read')
    )
      throw new ValidationError('Expected a notification fingerprint and read boolean');
    res.json(await setNoticeRead(req.user!, String(req.params.fingerprint), req.body.read));
  },
);
export default router;
