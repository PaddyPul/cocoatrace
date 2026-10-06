import bcrypt from 'bcryptjs';
import type { AuthenticatedActor } from '../../services/authSessionService';
import { query } from '../../db';
import { recordSecurityEvent } from '../../services/securityEventService';
import { AppError } from '../../errors';
import { requirePlatformAdministrator } from './policy';
import { changeAccess } from './repository';

export async function decideAccess(
  actor: AuthenticatedActor,
  kind: 'organizations' | 'users',
  id: string,
  input: { suspended: boolean; reason: string; currentPassword: string },
) {
  requirePlatformAdministrator(actor.permissions);
  const row = (await query('SELECT password_hash FROM users WHERE id=$1', [actor.id])).rows[0];
  if (!row || !(await bcrypt.compare(input.currentPassword, row.password_hash))) {
    await recordSecurityEvent({
      eventType: 'access.reauthentication.failed',
      success: false,
      actorUserId: actor.id,
      actorOrganizationId: actor.organizationId,
      sessionId: actor.sessionId,
      reason: 'current_password_invalid',
    });
    throw new AppError(
      'Confirm your current administrator password to continue',
      403,
      'REAUTHENTICATION_REQUIRED',
    );
  }
  return changeAccess(actor, kind, id, input.suspended, input.reason, row.password_hash);
}
