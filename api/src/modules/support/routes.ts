import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { sensitiveActionLimit } from '../../middleware/security';
import validate from '../../middleware/validate';
import { requestBody, reviewBody } from './policy';
import { createSupport, supportPage, supportDetail, reviewSupport } from './repository';
const router = Router();
const idParams = z.object({ id: z.string().uuid() }).strict();
router.use('/support/requests', requireAuth);
router.get('/support/requests/page', async (req, res) =>
  res.json(await supportPage(req.user!, req.query)),
);
router.get('/support/requests', async (req, res) =>
  res.json(await supportPage(req.user!, req.query)),
);
router.get('/support/requests/:id', validate(idParams, 'params'), async (req, res) =>
  res.json(await supportDetail(req.user!, z.string().uuid().parse(req.params.id))),
);
router.post('/support/requests', sensitiveActionLimit, validate(requestBody), async (req, res) => {
  const result = await createSupport(req.user!, requestBody.parse(req.body));
  res.status(result.replayed ? 200 : 201).json(result.record);
});
router.use('/admin/support/requests', requireAuth, requirePermission('*'));
router.get('/admin/support/requests/page', async (req, res) =>
  res.json(await supportPage(req.user!, req.query, true)),
);
router.patch(
  '/admin/support/requests/:id',
  sensitiveActionLimit,
  validate(idParams, 'params'),
  validate(reviewBody),
  async (req, res) => {
    const input = reviewBody.parse(req.body);
    res.json(
      await reviewSupport(
        req.user!,
        z.string().uuid().parse(req.params.id),
        input.status,
        input.expectedStatus,
        input.reason,
      ),
    );
  },
);
export default router;
