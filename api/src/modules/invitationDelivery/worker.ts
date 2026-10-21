import crypto from 'node:crypto';
import { config } from '../../config/env';
import { query } from '../../db';
import { AppError } from '../../errors';
import logger from '../../logger';
import { inDatabaseTransaction } from '../../services/databaseTransaction';
import { sendInvitationEmail } from '../../services/emailSender';
import { lockAccessDecisions } from '../mfa/reviewers';
import { openToken } from './credentials';

export type InvitationSender = typeof sendInvitationEmail;
export async function processInvitationEmails(
  sender?: InvitationSender,
  limit = 20,
  invitationId?: string,
) {
  const totals = { sent: 0, suppressed: 0, failed: 0, skipped: 0 };
  // Disabling delivery does not discard already queued work or continuously retry SMTP.
  const bounded = Number.isFinite(limit) ? Math.max(0, Math.min(100, Math.floor(limit))) : 0;
  // Bounded credential retention even for terminal work. Invite mutation holds parent before queue.
  await query(`WITH obsolete AS (SELECT q.id FROM invitation_email_outbox q JOIN user_invitations i ON i.id=q.invitation_id
    WHERE q.token_ciphertext IS NOT NULL AND (i.accepted_at IS NOT NULL OR i.revoked_at IS NOT NULL OR i.expires_at<=clock_timestamp() OR i.token_hash<>q.token_hash)
    ORDER BY q.id LIMIT 100 FOR UPDATE OF q SKIP LOCKED)
    UPDATE invitation_email_outbox q SET status='suppressed',last_error='INVITATION_NO_LONGER_ELIGIBLE',key_id=NULL,token_ciphertext=NULL,lease_token=NULL,lease_expires_at=NULL
    FROM obsolete WHERE q.id=obsolete.id`);
  if (!sender && (!config.identityEmailEnabled || config.emailDriver !== 'smtp')) {
    totals.skipped = 1;
    return totals;
  }
  for (let index = 0; index < bounded; index++) {
    const lease = crypto.randomUUID();
    const claimed = await inDatabaseTransaction(async (client) => {
      await client.query(`WITH exhausted AS (SELECT id FROM invitation_email_outbox WHERE attempts>=8
        AND (status IN ('queued','failed') OR (status='sending' AND (lease_expires_at IS NULL OR lease_expires_at<NOW())))
        ORDER BY id LIMIT 100 FOR UPDATE SKIP LOCKED)
        UPDATE invitation_email_outbox q SET status='failed_terminal',last_error='FINAL_LEASE_EXPIRED',lease_token=NULL,lease_expires_at=NULL
        FROM exhausted WHERE q.id=exhausted.id`);
      const row = (
        await client.query<{ id: string; invitation_id: string }>(
          `SELECT id,invitation_id FROM invitation_email_outbox
        WHERE ($1::uuid IS NULL OR invitation_id=$1) AND attempts<8
        AND ((status IN ('queued','failed') AND next_attempt_at<=NOW()) OR (status='sending' AND (lease_expires_at IS NULL OR lease_expires_at<NOW())))
        ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED`,
          [invitationId ?? null],
        )
      ).rows[0];
      if (row)
        await client.query(
          `UPDATE invitation_email_outbox SET status='sending',attempts=attempts+1,
        lease_token=$2,lease_expires_at=NOW()+INTERVAL '5 minutes' WHERE id=$1`,
          [row.id, lease],
        );
      return row;
    });
    if (!claimed) break;
    try {
      const status = await inDatabaseTransaction(async (client) => {
        // Match lifecycle -> organizations/users/roles -> invitation -> queue order.
        await lockAccessDecisions(client);
        const found = (
          await client.query<{ organization_id: string; invited_by_user_id: string }>(
            `SELECT i.organization_id,q.actor_user_id AS invited_by_user_id FROM user_invitations i
            JOIN invitation_email_outbox q ON q.invitation_id=i.id WHERE q.id=$1`,
            [claimed.id],
          )
        ).rows[0];
        if (!found) return 'lost' as const; // FK cascade removed the queue as well.
        const issuer = (
          await client.query<{ id: string; organization_id: string }>(
            `SELECT u.id,u.organization_id FROM users u JOIN organizations o ON o.id=u.organization_id
          WHERE u.id=$1 AND u.active AND u.access_suspended_at IS NULL AND o.access_suspended_at IS NULL AND o.verification_status='verified'
          FOR SHARE OF o,u`,
            [found.invited_by_user_id],
          )
        ).rows[0];
        const roles = (
          await client.query<{ permissions: string[] }>(
            `SELECT r.permissions FROM user_roles ur JOIN roles r ON r.id=ur.role_id
          WHERE ur.user_id=$1 FOR SHARE OF ur,r`,
            [found.invited_by_user_id],
          )
        ).rows;
        const rights = roles.flatMap((r) => r.permissions);
        const org = (
          await client.query<{ name: string; type: string }>(
            `SELECT name,type FROM organizations WHERE id=$1
          AND access_suspended_at IS NULL AND verification_status='verified' FOR SHARE`,
            [found.organization_id],
          )
        ).rows[0];
        const invite = (
          await client.query<{ email: string; token_hash: string; role_name: string }>(
            `SELECT i.email,i.token_hash,r.name AS role_name
          FROM user_invitations i JOIN roles r ON r.id=i.role_id WHERE i.id=$1 AND i.accepted_at IS NULL
          AND i.revoked_at IS NULL AND i.expires_at>clock_timestamp() FOR UPDATE OF i FOR SHARE OF r`,
            [claimed.invitation_id],
          )
        ).rows[0];
        const owned = (
          await client.query<{
            token_hash: string;
            recipient_digest: string;
            key_id: string;
            token_ciphertext: string;
          }>(
            `SELECT token_hash,recipient_digest,key_id,token_ciphertext FROM invitation_email_outbox
          WHERE id=$1 AND status='sending' AND lease_token=$2 AND lease_expires_at>NOW() FOR UPDATE`,
            [claimed.id, lease],
          )
        ).rows[0];
        if (!owned) return 'lost' as const;
        const platform = rights.includes('*');
        const eligible = !!(
          issuer &&
          org &&
          invite &&
          invite.token_hash === owned.token_hash &&
          crypto.createHash('sha256').update(invite.email.toLowerCase()).digest('hex') ===
            owned.recipient_digest &&
          (platform ||
            (issuer.organization_id === found.organization_id &&
              rights.includes('member.invite') &&
              invite.role_name === (org.type === 'cooperative' ? 'farmer' : org.type)))
        );
        let result: 'sent' | 'suppressed' = 'suppressed';
        if (eligible) {
          const token = openToken(
            { keyId: owned.key_id, ciphertext: owned.token_ciphertext },
            claimed.invitation_id,
            owned.token_hash,
            config.invitationDeliveryKey,
            owned.recipient_digest,
          );
          result = (
            await (sender ?? sendInvitationEmail)({
              to: invite!.email,
              organizationName: org!.name,
              invitationUrl: `${config.publicWebUrl}/accept-invite/${token}`,
            })
          ).status;
        }
        await client.query(
          `UPDATE invitation_email_outbox SET status=$3,sent_at=CASE WHEN $3='sent' THEN NOW() ELSE sent_at END,
          last_error=CASE WHEN $4 THEN NULL ELSE 'INVITATION_NO_LONGER_ELIGIBLE' END,key_id=NULL,token_ciphertext=NULL,
          lease_token=NULL,lease_expires_at=NULL WHERE id=$1 AND lease_token=$2 AND status='sending'`,
          [claimed.id, lease, result, eligible],
        );
        await client.query(
          `UPDATE user_invitations SET email_delivery_status=$3,email_attempted_at=NOW()
          WHERE id=$1 AND token_hash=$2`,
          [claimed.invitation_id, owned.token_hash, result],
        );
        return result;
      });
      if (status !== 'lost') totals[status]++;
    } catch (error) {
      const code =
        error instanceof AppError &&
        ['INVITATION_KEY_UNAVAILABLE', 'INVITATION_CREDENTIAL_INVALID'].includes(error.code)
          ? error.code
          : 'SMTP_SUBMISSION_FAILED';
      await query(
        `UPDATE invitation_email_outbox SET status=CASE WHEN attempts>=8 OR $3<>'SMTP_SUBMISSION_FAILED' THEN 'failed_terminal' ELSE 'failed' END,
        last_error=$3,next_attempt_at=NOW()+make_interval(secs=>LEAST(3600,60*attempts)),lease_token=NULL,lease_expires_at=NULL
        WHERE id=$1 AND lease_token=$2 AND status='sending'`,
        [claimed.id, lease, code],
      );
      // Condition on generation and queue ownership, so a newer resend never gets overwritten.
      await query(
        `UPDATE user_invitations i SET email_delivery_status='failed',email_attempted_at=NOW()
        FROM invitation_email_outbox q WHERE q.id=$1 AND q.invitation_id=i.id AND q.token_hash=i.token_hash AND q.status IN ('failed','failed_terminal')`,
        [claimed.id],
      );
      totals.failed++;
      logger.error(
        { notificationId: claimed.id, errorCode: code },
        'Invitation submission incomplete; durable recovery retained',
      );
    }
  }
  return totals;
}
