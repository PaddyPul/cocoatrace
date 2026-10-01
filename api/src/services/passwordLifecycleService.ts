import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getClient, query } from '../db';
import { AppError, AuthenticationError } from '../errors';
import { recordSecurityEvent, securityIdentifierHash } from './securityEventService';

const resetLifetimeMinutes = 60;

function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export type PasswordResetDelivery = {
  userId: string;
  organizationId: string;
  email: string;
  name: string;
  token: string;
} | null;

export async function requestPasswordReset(email: string): Promise<PasswordResetDelivery> {
  const normalizedEmail = email.trim().toLowerCase();
  const userResult = await query(
    `SELECT u.id,u.email,u.name,u.organization_id
       FROM users u JOIN organizations o ON o.id=u.organization_id
      WHERE u.email=$1 AND u.active=TRUE`,
    [normalizedEmail],
  );
  const user = userResult.rows[0];
  if (!user) {
    await recordSecurityEvent({
      eventType: 'password.reset.requested', success: true,
      metadata: { accountFound: false, emailHash: securityIdentifierHash(normalizedEmail) },
    });
    return null;
  }

  const rawToken = crypto.randomBytes(32).toString('base64url');
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE password_reset_tokens SET used_at=NOW()
        WHERE user_id=$1 AND used_at IS NULL`,
      [user.id],
    );
    await client.query(
      `INSERT INTO password_reset_tokens(user_id,token_hash,expires_at)
       VALUES ($1,$2,NOW()+($3::text || ' minutes')::interval)`,
      [user.id, hashResetToken(rawToken), resetLifetimeMinutes],
    );
    await recordSecurityEvent({
      eventType: 'password.reset.requested', success: true,
      actorUserId: user.id, actorOrganizationId: user.organization_id,
    }, client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return { userId: user.id, organizationId: user.organization_id, email: user.email, name: user.name, token: rawToken };
}

export async function resetPassword(rawToken: string, password: string): Promise<void> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const tokenResult = await client.query(
      `SELECT t.id,t.user_id,u.organization_id
         FROM password_reset_tokens t JOIN users u ON u.id=t.user_id
        WHERE t.token_hash=$1 AND t.used_at IS NULL AND t.expires_at>NOW() AND u.active=TRUE
        FOR UPDATE OF t`,
      [hashResetToken(rawToken)],
    );
    const reset = tokenResult.rows[0];
    if (!reset) {
      await client.query('ROLLBACK');
      throw new AppError('Password reset token is invalid or expired', 400, 'PASSWORD_RESET_INVALID');
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await client.query(
      'UPDATE users SET password_hash=$1,password_changed_at=NOW() WHERE id=$2',
      [passwordHash, reset.user_id],
    );
    await client.query('UPDATE password_reset_tokens SET used_at=NOW() WHERE id=$1', [reset.id]);
    await client.query(
      `UPDATE sessions SET revoked_at=NOW(),revoked_reason='password_reset'
        WHERE user_id=$1 AND revoked_at IS NULL`,
      [reset.user_id],
    );
    await recordSecurityEvent({
      eventType: 'password.reset.completed', success: true,
      actorUserId: reset.user_id, actorOrganizationId: reset.organization_id,
    }, client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function changePassword(
  userId: string,
  organizationId: string,
  sessionId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT password_hash FROM users WHERE id=$1 AND active=TRUE FOR UPDATE', [userId]);
    if (!result.rows[0] || !await bcrypt.compare(currentPassword, result.rows[0].password_hash)) {
      await client.query('ROLLBACK');
      await recordSecurityEvent({
        eventType: 'password.change.failed', success: false,
        actorUserId: userId, actorOrganizationId: organizationId, sessionId,
        reason: 'current_password_invalid',
      });
      throw new AuthenticationError('Current password is incorrect');
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await client.query('UPDATE users SET password_hash=$1,password_changed_at=NOW() WHERE id=$2', [passwordHash, userId]);
    await client.query(
      `UPDATE sessions SET revoked_at=NOW(),revoked_reason='password_change'
        WHERE user_id=$1 AND id<>$2 AND revoked_at IS NULL`,
      [userId, sessionId],
    );
    await client.query(
      `UPDATE password_reset_tokens SET used_at=NOW()
        WHERE user_id=$1 AND used_at IS NULL`,
      [userId],
    );
    await recordSecurityEvent({
      eventType: 'password.changed', success: true,
      actorUserId: userId, actorOrganizationId: organizationId, sessionId,
    }, client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
