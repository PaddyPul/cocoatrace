import type { PoolClient } from 'pg';
import { ConflictError, NotFoundError, ForbiddenError } from '../../errors';
import { recordAudit, type AuditActor } from '../../services/auditWriter';
import { assertMutationAssurance } from '../mfa/assurance';

export async function assertOperator(
  client: PoolClient,
  actor: AuditActor & { sessionId: string },
): Promise<void> {
  await assertMutationAssurance(client, actor);
  const authority = await client.query(
    `SELECT u.id FROM users u
    JOIN organizations o ON o.id=u.organization_id
    JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
    WHERE u.id=$1 AND u.organization_id=$2 AND u.active AND u.access_suspended_at IS NULL
      AND o.access_suspended_at IS NULL AND o.verification_status='verified' AND '*'=ANY(r.permissions)
    FOR SHARE OF u,o,ur,r`,
    [actor.id, actor.organizationId],
  );
  const session = await client.query(
    'SELECT id FROM sessions WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at>NOW() FOR SHARE',
    [actor.sessionId, actor.id],
  );
  if (!authority.rows.length || !session.rows.length)
    throw new ForbiddenError('Current platform administrator required');
}

export async function retryCleanup(
  client: PoolClient,
  actor: AuditActor & { sessionId: string },
  id: string,
  reason: string,
): Promise<void> {
  await assertOperator(client, actor);
  const selected = await client.query(
    `SELECT id,state,last_error_code FROM evidence_object_cleanup WHERE id=$1 FOR UPDATE`,
    [id],
  );
  const row = selected.rows[0];
  if (!row) throw new NotFoundError('Cleanup record not found');
  if (row.state !== 'dead') throw new ConflictError('Only terminal cleanup work can be retried');
  if (
    ['LIVE_EVIDENCE_REFERENCE', 'INVALID_OBJECT_KEY', 'STORAGE_PROVIDER_MISMATCH'].includes(
      row.last_error_code,
    )
  ) {
    throw new ConflictError('Unsafe cleanup requires investigation; retry is refused');
  }
  await client.query(
    `UPDATE evidence_object_cleanup SET state='pending',attempts=0,next_attempt_at=NOW(),
    last_error_code=NULL,lease_token=NULL,lease_expires_at=NULL,updated_at=NOW() WHERE id=$1`,
    [id],
  );
  await recordAudit(client, actor, 'operations.cleanup.retry', 'evidence_cleanup', id, {
    reason,
    previousErrorCode: row.last_error_code,
  });
}

// Only these identifiers may be interpolated into outbox queries.
export const emailOutboxes = {
  payment_reminder: 'payment_reminder_email_outbox',
  recall: 'recall_email_outbox',
  fee_statement: 'fee_statement_email_outbox',
} as const;
export type EmailQueue = keyof typeof emailOutboxes;

export async function retryEmail(
  client: PoolClient,
  actor: AuditActor & { sessionId: string },
  queue: EmailQueue,
  id: string,
  reason: string,
): Promise<void> {
  await assertOperator(client, actor);
  const table = emailOutboxes[queue];
  const row = (
    await client.query(
      `SELECT status,attempts,last_error,sent_at,lease_token,lease_expires_at FROM ${table} WHERE id=$1 FOR UPDATE`,
      [id],
    )
  ).rows[0];
  if (!row) throw new NotFoundError('Email record not found');
  if (row.status !== 'failed_terminal' || row.sent_at || row.lease_token || row.lease_expires_at)
    throw new ConflictError(
      'Only terminal, unleased email work without recorded submission can be retried',
    );
  await client.query(
    `UPDATE ${table} SET status='queued',attempts=0,next_attempt_at=NOW(),last_error=NULL,
      lease_token=NULL,lease_expires_at=NULL${queue === 'recall' ? ',exhausted_at=NULL' : ''} WHERE id=$1`,
    [id],
  );
  await recordAudit(client, actor, 'operations.email.retry', table, id, {
    reason,
    queue,
    previousAttempts: row.attempts,
    previousErrorCode: safeEmailError(row.last_error),
  });
}

export function safeEmailError(value: unknown): string | null {
  if (value === null) return null;
  return value === 'SMTP_SUBMISSION_FAILED' || value === 'FINAL_LEASE_EXPIRED'
    ? value
    : 'UNKNOWN_EMAIL_FAILURE';
}
