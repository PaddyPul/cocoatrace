import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import validate from '../middleware/validate';
import { acceptInvitationSchema, createInvitationSchema } from '../validation';
import * as controller from '../controllers/invitationController';
import { sensitiveActionLimit } from '../middleware/security';

const router = Router();
router.get('/auth/invitations/:token', controller.invitationDetails);
router.post('/auth/invitations/:token/accept', sensitiveActionLimit, validate(acceptInvitationSchema), controller.acceptInvitation);
router.get('/invitations', requireAuth, requirePermission('member.invite'), controller.listInvitations);
router.post('/invitations', requireAuth, requirePermission('member.invite'), validate(createInvitationSchema), controller.createInvitation);
export = router;
