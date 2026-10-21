import bcrypt from 'bcryptjs';
import { findLoginAccount } from './loginRepository';
import {
  authenticateSession,
  createSession,
  type AuthenticatedActor,
} from '../../services/authSessionService';
import { recordSecurityEvent, securityIdentifierHash } from '../../services/securityEventService';
const dummyHash = bcrypt.hash('CocoaTrace-Dummy-Password-2026!', 12);
type LoginResult =
  | { kind: 'denied'; status: 401 | 403; error: string; code?: string }
  | { kind: 'authenticated'; token: string; actor: AuthenticatedActor };
export async function issuePasswordSession(email: string, password: string): Promise<LoginResult> {
  const user = await findLoginAccount(email);
  const valid = await bcrypt.compare(password, user?.password_hash || (await dummyHash));
  if (!user || !valid || !user.active || user.access_suspended_at) {
    await recordSecurityEvent({
      eventType: 'login.failed',
      success: false,
      actorUserId: user?.id,
      actorOrganizationId: user?.organization_id,
      reason: !user
        ? 'unknown_account'
        : !user.active
          ? 'inactive_account'
          : user.access_suspended_at
            ? 'account_suspended'
            : 'invalid_password',
      metadata: { emailHash: securityIdentifierHash(email) },
    });
    return { kind: 'denied', status: 401, error: 'Invalid credentials' };
  }
  if (user.verification_status !== 'verified' || user.org_suspended) {
    await recordSecurityEvent({
      eventType: 'login.failed',
      success: false,
      actorUserId: user.id,
      actorOrganizationId: user.organization_id,
      reason: 'organization_not_active',
    });
    return {
      kind: 'denied',
      status: 403,
      error: 'This organization is not approved for access',
      code: 'ORGANIZATION_NOT_ACTIVE',
    };
  }

  const { token } = await createSession(user.id, user.password_hash);
  const actor = await authenticateSession(token);
  if (!actor) return { kind: 'denied', status: 401, error: 'Account changed; sign in again' };
  await recordSecurityEvent({
    eventType: 'login.succeeded',
    success: true,
    actorUserId: actor.id,
    actorOrganizationId: actor.organizationId,
    sessionId: actor.sessionId,
  });
  return { kind: 'authenticated', token, actor };
}
