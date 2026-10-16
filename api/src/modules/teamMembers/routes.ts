import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { sensitiveActionLimit } from '../../middleware/security';
import validate from '../../middleware/validate';
import { pageSchema, targetSchema, decisionSchema, roleSchema } from './schemas';
import { listMembers, listRoles, changeMember } from './repository';
const router = Router();
router.use('/team', requireAuth, requirePermission('member.manage'), (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.get('/team/members/page', validate(pageSchema, 'query'), async (req, res) => {
  res.json(await listMembers(req.user!, pageSchema.parse(req.query)));
});
router.get('/team/roles', async (req, res) => {
  res.json(await listRoles(req.user!));
});
router.patch(
  '/team/members/:id/role',
  sensitiveActionLimit,
  validate(targetSchema, 'params'),
  validate(roleSchema),
  async (req, res) => {
    res.json(await changeMember(req.user!, req.params.id, roleSchema.parse(req.body)));
  },
);
router.post(
  '/team/members/:id/deactivate',
  sensitiveActionLimit,
  validate(targetSchema, 'params'),
  validate(decisionSchema),
  async (req, res) => {
    res.json(await changeMember(req.user!, req.params.id, decisionSchema.parse(req.body)));
  },
);
export default router;
