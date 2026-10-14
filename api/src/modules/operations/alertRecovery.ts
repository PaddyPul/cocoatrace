import type { PoolClient } from 'pg';
import { ConflictError, NotFoundError } from '../../errors';
import { recordAudit, type AuditActor } from '../../services/auditWriter';
import { withCatalogRead } from '../catalog/paging';
import { alertOptions, lockAlertRecipient, type AlertOptions } from './alerts';
import { safeSignalKey } from './incidentSignals';
import { assertOperator } from './recovery';

const retryErrors = ['SMTP_SUBMISSION_FAILED', 'LEASE_EXPIRED'];
export function safeAlertError(value: unknown): string | null {
  if (value === null) return null;
  return typeof value === 'string' && [...retryErrors, 'INCONSISTENT_SUBMISSION'].includes(value)
    ? value
    : 'UNKNOWN_ALERT_FAILURE';
}

/** A bounded metadata register; no recipient, incident payload or provider diagnostics. */
export async function readTerminalAlerts(options = alertOptions()) {
  return withCatalogRead(async (execute) => {
    const result = await execute(
      `WITH terminal AS (
      SELECT id,status,attempts,last_error_code,created_at,sent_at,lease_token,lease_expires_at,incident_id,recipient_user_id
      FROM operations_alert_outbox WHERE status='failed_terminal' ORDER BY id LIMIT 51)
      SELECT t.id,t.status,t.attempts,t.last_error_code,t.created_at,
      ($2::boolean AND t.sent_at IS NULL AND t.lease_token IS NULL AND t.lease_expires_at IS NULL
        AND t.last_error_code=ANY($3::text[]) AND i.state='open'
        AND t.recipient_user_id=ANY($1::uuid[])
        AND EXISTS(SELECT 1 FROM users u JOIN organizations o ON o.id=u.organization_id
          JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
          WHERE u.id=t.recipient_user_id AND u.active AND u.access_suspended_at IS NULL
          AND o.access_suspended_at IS NULL AND o.verification_status='verified' AND '*'=ANY(r.permissions))) AS retryable,
      i.signal_key FROM terminal t JOIN operations_incidents i ON i.id=t.incident_id ORDER BY t.id`,
      [options.recipientUserIds, options.enabled, retryErrors],
    );
    return {
      items: result.rows.slice(0, 50).map(({ signal_key, last_error_code, retryable, ...row }) => ({
        ...row,
        last_error_code: safeAlertError(last_error_code),
        retryable:
          retryable === true && typeof signal_key === 'string' && safeSignalKey(signal_key),
      })),
      more: result.rows.length > 50,
    };
  });
}

/** Requeue only; the ordinary worker performs the eventual submission and current eligibility checks. */
export async function retryOperatorAlert(
  client: PoolClient,
  actor: AuditActor & { sessionId: string },
  id: string,
  reason: string,
  options: AlertOptions = alertOptions(),
): Promise<void> {
  await assertOperator(client, actor);
  const row = (
    await client.query(
      `SELECT status,attempts,last_error_code,sent_at,lease_token,lease_expires_at,incident_id,recipient_user_id
    FROM operations_alert_outbox WHERE id=$1 FOR UPDATE`,
      [id],
    )
  ).rows[0];
  if (!row) throw new NotFoundError('Operator alert record not found');
  if (
    row.status !== 'failed_terminal' ||
    row.sent_at ||
    row.lease_token ||
    row.lease_expires_at ||
    !retryErrors.includes(row.last_error_code)
  )
    throw new ConflictError(
      'Only terminal, unleased operator alerts with a recognized delivery failure and no recorded submission can be retried',
    );
  if (
    !options.enabled ||
    !options.recipientUserIds.some((target) => target.toLowerCase() === row.recipient_user_id)
  )
    throw new ConflictError(
      'Operator alerts must be enabled and the original recipient must remain configured',
    );
  const incident = (
    await client.query(
      "SELECT signal_key FROM operations_incidents WHERE id=$1 AND state='open' FOR SHARE",
      [row.incident_id],
    )
  ).rows[0];
  if (
    !incident ||
    !safeSignalKey(incident.signal_key) ||
    !(await lockAlertRecipient(client, row.recipient_user_id))
  )
    throw new ConflictError('A current incident and eligible original operator are required');
  await client.query(
    `UPDATE operations_alert_outbox SET status='queued',attempts=0,next_attempt_at=NOW(),last_error_code=NULL,
    lease_token=NULL,lease_expires_at=NULL WHERE id=$1`,
    [id],
  );
  await recordAudit(client, actor, 'operations.alert.retry', 'operations_alert_outbox', id, {
    reason,
    previousAttempts: row.attempts,
    previousErrorCode: row.last_error_code,
  });
}
