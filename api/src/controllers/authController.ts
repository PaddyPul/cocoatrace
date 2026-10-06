import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db';
import { config } from '../config/env';
import { authenticateSession, createSession, revokeSession } from '../services/authSessionService';
import { changePassword, requestPasswordReset, resetPassword } from '../services/passwordLifecycleService';
import { recordSecurityEvent, securityIdentifierHash } from '../services/securityEventService';
import { sendPasswordResetEmail } from '../services/emailSender';
import logger from '../logger';

const dummyHash = bcrypt.hash('CocoaTrace-Dummy-Password-2026!', 12);

function setSessionCookie(res: Response, token: string): void {
  res.cookie('ct_session', token, { httpOnly: true, secure: config.cookieSecure, sameSite: 'lax', path: '/', maxAge: 24 * 60 * 60 * 1000 });
}

function clearSessionCookie(res: Response): void {
  res.clearCookie('ct_session', { httpOnly: true, secure: config.cookieSecure, sameSite: 'lax', path: '/' });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;
  const { rows } = await query(
    `SELECT u.id,u.email,u.name,u.organization_id,u.password_hash,u.active,u.access_suspended_at,o.access_suspended_at AS org_suspended,o.verification_status
       FROM users u JOIN organizations o ON o.id=u.organization_id WHERE u.email=$1`,
    [email],
  );
  const user = rows[0];
  const valid = await bcrypt.compare(password, user?.password_hash || await dummyHash);
  if (!user || !valid || !user.active || user.access_suspended_at) {
    await recordSecurityEvent({
      eventType: 'login.failed', success: false,
      actorUserId: user?.id, actorOrganizationId: user?.organization_id,
      reason: !user ? 'unknown_account' : !user.active ? 'inactive_account' : user.access_suspended_at ? 'account_suspended' : 'invalid_password',
      metadata: { emailHash: securityIdentifierHash(email) },
    });
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  if (user.verification_status !== 'verified' || user.org_suspended) {
    await recordSecurityEvent({ eventType: 'login.failed', success: false, actorUserId: user.id, actorOrganizationId: user.organization_id, reason: 'organization_not_active' });
    res.status(403).json({ error: 'This organization is not approved for access', code: 'ORGANIZATION_NOT_ACTIVE' });
    return;
  }

  const { token } = await createSession(user.id, user.password_hash);
  const actor = await authenticateSession(token);
  if(!actor){res.status(401).json({error:'Account changed; sign in again'});return;}
  await recordSecurityEvent({ eventType: 'login.succeeded', success: true, actorUserId: actor.id, actorOrganizationId: actor.organizationId, sessionId: actor.sessionId });
  setSessionCookie(res, token);
  res.json({
    accessToken: token,
    user: { id: actor.id, email: actor.email, name: actor.name, organizationId: actor.organizationId,
      orgName: actor.orgName, orgType: actor.orgType, roles: actor.roles, permissions: actor.permissions, mfa: actor.mfa },
  });
}

export async function logout(req: Request, res: Response): Promise<void> {
  await revokeSession(req.user!.sessionId, 'logout');
  await recordSecurityEvent({ eventType: 'session.revoked', success: true, actorUserId: req.user!.id,
    actorOrganizationId: req.user!.organizationId, sessionId: req.user!.sessionId, reason: 'logout' });
  clearSessionCookie(res);
  res.status(204).send();
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const delivery = await requestPasswordReset(req.body.email);
  if (delivery) {
    try {
      const result = await sendPasswordResetEmail({
        to: delivery.email,
        recipientName: delivery.name,
        resetUrl: `${config.publicWebUrl}/reset-password/${encodeURIComponent(delivery.token)}`,
      });
      await recordSecurityEvent({
        eventType: `password.reset.delivery_${result.status}`, success: result.status === 'sent',
        actorUserId: delivery.userId, actorOrganizationId: delivery.organizationId,
      });
    } catch {
      logger.error({ userId: delivery.userId }, 'Password reset email delivery failed');
      await recordSecurityEvent({
        eventType: 'password.reset.delivery_failed', success: false,
        actorUserId: delivery.userId, actorOrganizationId: delivery.organizationId,
        reason: 'email_delivery_failed',
      });
    }
  }
  res.status(202).json({ message: 'If an active account exists and email submission succeeds, you will receive password reset instructions.' });
}

export async function completePasswordReset(req: Request, res: Response): Promise<void> {
  await resetPassword(req.body.token, req.body.password);
  res.status(204).send();
}

export async function updatePassword(req: Request, res: Response): Promise<void> {
  await changePassword(req.user!.id, req.user!.organizationId, req.user!.sessionId, req.body.currentPassword, req.body.newPassword);
  res.status(204).send();
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  res.json({ id: user.id, email: user.email, name: user.name, organization_id: user.organizationId,
    mfa: user.mfa, mfa_enabled: user.mfa?.enrolled || false, org_name: user.orgName, org_type: user.orgType, roles: user.roles, permissions: user.permissions });
}
