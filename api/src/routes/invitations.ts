import { publicActionLimiter } from '../middleware/publicRateLimit';
import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import validate from '../middleware/validate';
import { acceptInvitationSchema, createInvitationSchema } from '../validation';
import * as controller from '../controllers/invitationController';
import { sensitiveActionLimit } from '../middleware/security';

const router = Router();
router.get('/auth/invitations/:token', publicActionLimiter('invitationPreview'), controller.invitationDetails);
router.post('/auth/invitations/:token/accept', sensitiveActionLimit, validate(acceptInvitationSchema), controller.acceptInvitation);
router.get('/invitations', requireAuth, requirePermission('member.invite'), controller.listInvitations);
router.post('/invitations', requireAuth, requirePermission('member.invite'), publicActionLimiter('invitationCreate'), validate(createInvitationSchema), controller.createInvitation);
router.post('/invitations/:id/resend', requireAuth, requirePermission('member.invite'), sensitiveActionLimit, controller.resendInvitation);
router.post('/invitations/:id/revoke', requireAuth, requirePermission('member.invite'), sensitiveActionLimit, controller.revokeInvitation);
export = router;
