import crypto from 'node:crypto';
import type { PoolClient } from 'pg';
import { config } from '../../config/env';
import { recordAudit, type AuditActor } from '../../services/auditWriter';
import { ConflictError } from '../../errors';
import { sealToken } from './credentials';

export const invitationTokenHash = (token: string) =>
  crypto.createHash('sha256').update(token).digest('hex');
export async function cancelInvitationDelivery(
  client: PoolClient,
  invitationId: string,
): Promise<void> {
  await client.query(
    `UPDATE invitation_email_outbox SET status='suppressed',last_error='INVITATION_NO_LONGER_ELIGIBLE',
    key_id=NULL,token_ciphertext=NULL,lease_token=NULL,lease_expires_at=NULL
    WHERE invitation_id=$1 AND status<>'sent'`,
    [invitationId],
  );
}
/** Parent invitation is locked/created by the caller. This never opens a connection or sends email. */
export async function enqueueInvitationDelivery(
  client: PoolClient,
  actor: AuditActor,
  invitationId: string,
  token: string,
): Promise<void> {
  const tokenHash = invitationTokenHash(token);
  const current = (
    await client.query<{ token_hash: string; email: string }>(
      'SELECT token_hash,email FROM user_invitations WHERE id=$1 FOR UPDATE',
      [invitationId],
    )
  ).rows[0];
  if (!current || current.token_hash !== tokenHash)
    throw new ConflictError('Invitation generation changed');
  const recipientDigest = crypto
    .createHash('sha256')
    .update(current.email.toLowerCase())
    .digest('hex');
  const enabled = config.identityEmailEnabled && config.emailDriver === 'smtp';
  const sealed = enabled
    ? sealToken(token, invitationId, tokenHash, config.invitationDeliveryKey, recipientDigest)
    : null;
  // A new generation supersedes older queued credentials; repeated enqueue is harmless.
  await client.query(
    `UPDATE invitation_email_outbox SET status='suppressed',last_error='INVITATION_SUPERSEDED',
    key_id=NULL,token_ciphertext=NULL,lease_token=NULL,lease_expires_at=NULL
    WHERE invitation_id=$1 AND token_hash<>$2 AND status<>'sent'`,
    [invitationId, tokenHash],
  );
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO invitation_email_outbox
    (invitation_id,token_hash,key_id,token_ciphertext,status,last_error,actor_user_id,recipient_digest)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(invitation_id,token_hash) DO NOTHING RETURNING id`,
    [
      invitationId,
      tokenHash,
      sealed?.keyId ?? null,
      sealed?.ciphertext ?? null,
      enabled ? 'queued' : 'suppressed',
      enabled ? null : 'EMAIL_NOT_CONFIGURED',
      actor.id,
      recipientDigest,
    ],
  );
  if (inserted.rows[0])
    await client.query(
      `UPDATE user_invitations SET email_delivery_status=$3
    WHERE id=$1 AND token_hash=$2`,
      [invitationId, tokenHash, enabled ? 'pending' : 'suppressed'],
    );
  if (inserted.rows[0])
    await recordAudit(
      client,
      actor,
      'member.invitation_email_queued',
      'user_invitation',
      invitationId,
      { outboxId: inserted.rows[0].id, deliveryEnabled: enabled },
    );
}
