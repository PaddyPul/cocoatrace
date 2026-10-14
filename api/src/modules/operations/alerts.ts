import crypto from 'node:crypto';
import type { PoolClient } from 'pg';
import { config } from '../../config/env';
import { query } from '../../db';
import { inDatabaseTransaction } from '../../services/databaseTransaction';
import { emailSender, type EmailSender } from '../../services/emailSender';
import { withCatalogRead } from '../catalog/paging';
import { loadQueueBacklog } from './backlog';
import { incidentSignals, safeSignalKey, unavailableSignal } from './incidentSignals';

export type AlertOptions = { enabled: boolean; recipientUserIds: readonly string[] };
export const alertOptions = (): AlertOptions => ({
  enabled: config.operationsAlertsEnabled,
  recipientUserIds: config.operationsAlertRecipientUserIds,
});
export function alertConfigurationFingerprint(options: AlertOptions): string {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        recipients: [...options.recipientUserIds].map((id) => id.toLowerCase()).sort(),
        url: config.publicWebUrl,
        host: config.smtpHost,
        port: config.smtpPort,
        from: config.emailFrom,
        secure: config.smtpSecure,
        tls: config.smtpRequireTls,
        verifyTls: config.smtpTlsRejectUnauthorized,
        auth: config.smtpAuthMethod,
      }),
    )
    .digest('hex');
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function recipientsValid(ids: readonly string[]) {
  if (
    !ids.length ||
    ids.length > 5 ||
    new Set(ids.map((id) => id.toLowerCase())).size !== ids.length ||
    ids.some((id) => !uuid.test(id))
  )
    throw new Error('Invalid operator recipients');
}
const eligibleOperator = `u.active AND u.access_suspended_at IS NULL AND o.access_suspended_at IS NULL AND o.verification_status='verified' AND '*'=ANY(r.permissions)`;
export async function observeIncidents(): Promise<string[]> {
  return withCatalogRead(async (execute) => {
    const backlog = await loadQueueBacklog(execute);
    const jobs = await execute(
      'SELECT job_name,status,started_at,finished_at,last_success_at,error_code,consecutive_failures,runs FROM operations_job_status ORDER BY job_name',
    );
    return incidentSignals(
      jobs.rows as unknown as Parameters<typeof incidentSignals>[0],
      backlog.queues,
      Date.parse(backlog.observedAt),
    );
  });
}
export async function syncIncidents(
  keys: readonly string[],
  complete: boolean,
  recipientIds: readonly string[],
): Promise<void> {
  recipientsValid(recipientIds);
  if (keys.length > 25 || keys.some((key) => !safeSignalKey(key)))
    throw new Error('Invalid incident keys');
  await inDatabaseTransaction(async (client) => {
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('bettertrade.operations.incident-register',0))",
    );
    for (const key of [...new Set(keys)].sort())
      await client.query(
        `INSERT INTO operations_incidents(signal_key) VALUES($1)
      ON CONFLICT(signal_key) WHERE state='open' DO UPDATE SET last_observed_at=NOW()`,
        [key],
      );
    // An incomplete observation cannot resolve previously observed incidents.
    if (complete)
      await client.query(
        `UPDATE operations_incidents SET state='resolved',resolved_at=NOW()
      WHERE state='open' AND NOT(signal_key=ANY($1::text[]))`,
        [keys],
      );
    await client.query(
      `INSERT INTO operations_alert_outbox(incident_id,recipient_user_id)
      SELECT i.id,u.id FROM operations_incidents i JOIN users u ON u.id=ANY($1::uuid[])
      JOIN organizations o ON o.id=u.organization_id JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
      WHERE i.state='open' AND ${eligibleOperator} ON CONFLICT(incident_id,recipient_user_id) DO NOTHING`,
      [recipientIds],
    );
  });
}
export function alertMessage(key: string, detectedAt: string, to: string) {
  if (!safeSignalKey(key) || !Number.isFinite(Date.parse(detectedAt)))
    throw new Error('Invalid alert metadata');
  const link = new URL('/operations', config.publicWebUrl);
  if (link.username || link.password || !['http:', 'https:'].includes(link.protocol))
    throw new Error('Invalid console URL');
  return {
    to,
    category: 'operations_alert' as const,
    subject: 'BetterTrade operations need attention',
    text: `Operations signal: ${key}\nDetected: ${new Date(detectedAt).toISOString()}\n\nSign in to investigate current job and queue status:\n${link.toString()}\n\nThis is an operational observation, not confirmation of inbox delivery, data loss or an inventory safety decision.`,
  };
}
export async function deliverAlerts(
  options: AlertOptions,
  delivery: EmailSender = emailSender(),
  limit = 4,
) {
  const totals = { sent: 0, suppressed: 0, failed: 0, lost: 0 };
  if (!options.enabled) return totals;
  recipientsValid(options.recipientUserIds);
  if (!Number.isInteger(limit) || limit < 1 || limit > 4)
    throw new Error('Invalid alert batch limit');
  await query(`WITH expired AS (SELECT id FROM operations_alert_outbox
    WHERE status='sending' AND (lease_expires_at<=NOW() OR lease_expires_at IS NULL)
    ORDER BY lease_expires_at NULLS FIRST,id FOR UPDATE SKIP LOCKED LIMIT 4)
    UPDATE operations_alert_outbox q SET status=CASE WHEN q.attempts>=8 THEN 'failed_terminal' ELSE 'failed' END,
    last_error_code='LEASE_EXPIRED',lease_token=NULL,lease_expires_at=NULL,next_attempt_at=NOW()
    FROM expired WHERE q.id=expired.id`);
  await query(`WITH invalid AS (SELECT id FROM operations_alert_outbox
    WHERE status IN ('queued','failed') AND (attempts>=8 OR sent_at IS NOT NULL)
    ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 4)
    UPDATE operations_alert_outbox q SET status='failed_terminal',last_error_code='INCONSISTENT_SUBMISSION'
    FROM invalid WHERE q.id=invalid.id`);
  for (let index = 0; index < limit; index++) {
    const lease = crypto.randomUUID();
    const claimed = await inDatabaseTransaction(async (client) => {
      const row = (
        await client.query(`SELECT id FROM operations_alert_outbox WHERE status IN ('queued','failed')
        AND next_attempt_at<=NOW() AND attempts<8 AND sent_at IS NULL ORDER BY next_attempt_at,id FOR UPDATE SKIP LOCKED LIMIT 1`)
      ).rows[0];
      if (row)
        await client.query(
          `UPDATE operations_alert_outbox SET status='sending',attempts=attempts+1,lease_token=$2,lease_expires_at=NOW()+INTERVAL '5 minutes' WHERE id=$1`,
          [row.id, lease],
        );
      return row;
    });
    if (!claimed) break;
    try {
      const outcome = await inDatabaseTransaction(async (client) => {
        const row = (
          await client.query(
            `SELECT incident_id,recipient_user_id FROM operations_alert_outbox
          WHERE id=$1 AND status='sending' AND lease_token=$2 AND lease_expires_at>NOW() FOR UPDATE`,
            [claimed.id, lease],
          )
        ).rows[0];
        if (!row) return 'lost' as const;
        const incident = (
          await client.query(
            "SELECT signal_key,detected_at FROM operations_incidents WHERE id=$1 AND state='open' FOR SHARE",
            [row.incident_id],
          )
        ).rows[0];
        const identity = (
          await client.query('SELECT organization_id FROM users WHERE id=$1', [
            row.recipient_user_id,
          ])
        ).rows[0];
        if (identity)
          await client.query('SELECT id FROM organizations WHERE id=$1 FOR SHARE', [
            identity.organization_id,
          ]);
        const recipient = (
          await client.query(
            `SELECT u.email FROM users u JOIN organizations o ON o.id=u.organization_id
          JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE u.id=$1 AND ${eligibleOperator}
          FOR SHARE OF u,o,ur,r`,
            [row.recipient_user_id],
          )
        ).rows[0];
        const eligible =
          incident &&
          recipient &&
          options.recipientUserIds.some((id) => id.toLowerCase() === row.recipient_user_id);
        const status = eligible
          ? (
              await delivery.send(
                alertMessage(
                  incident.signal_key,
                  new Date(incident.detected_at).toISOString(),
                  recipient.email,
                ),
              )
            ).status
          : 'suppressed';
        await client.query(
          `UPDATE operations_alert_outbox SET status=$3,sent_at=CASE WHEN $3='sent' THEN NOW() ELSE sent_at END,
          last_error_code=CASE WHEN $4 THEN CASE WHEN $3='suppressed' THEN 'EMAIL_SUPPRESSED' ELSE NULL END ELSE 'INCIDENT_OR_OPERATOR_INELIGIBLE' END,
          lease_token=NULL,lease_expires_at=NULL WHERE id=$1 AND lease_token=$2 AND status='sending'`,
          [claimed.id, lease, status, Boolean(eligible)],
        );
        return status;
      });
      totals[outcome]++;
    } catch {
      await query(
        `UPDATE operations_alert_outbox SET status=CASE WHEN attempts>=8 THEN 'failed_terminal' ELSE 'failed' END,
        last_error_code='SMTP_SUBMISSION_FAILED',next_attempt_at=NOW()+make_interval(secs=>LEAST(3600,60*attempts)),
        lease_token=NULL,lease_expires_at=NULL WHERE id=$1 AND lease_token=$2 AND status='sending'`,
        [claimed.id, lease],
      );
      totals.failed++;
    }
  }
  return totals;
}
export async function runAlertCycle(
  client: PoolClient,
  options = alertOptions(),
  delivery: EmailSender = emailSender(),
) {
  if (!options.enabled) return 'disabled' as const;
  recipientsValid(options.recipientUserIds);
  const locked = (
    await client.query(
      "SELECT pg_try_advisory_lock(hashtextextended('bettertrade.operations.alert-cycle',0)) AS acquired",
    )
  ).rows[0]?.acquired;
  if (!locked) return 'busy' as const;
  try {
    const recent = (
      await client.query(
        "SELECT id FROM operations_alert_status WHERE last_poll_at>NOW()-INTERVAL '60 seconds'",
      )
    ).rows.length;
    if (recent) return 'busy' as const;
    await client.query(
      `INSERT INTO operations_alert_status(id,config_fingerprint,last_poll_at,error_code) VALUES(1,$1,NOW(),'ALERT_POLL_RUNNING')
      ON CONFLICT(id) DO UPDATE SET config_fingerprint=$1,last_poll_at=NOW(),error_code='ALERT_POLL_RUNNING'`,
      [alertConfigurationFingerprint(options)],
    );
    let code: string | null = null;
    let keys: string[];
    try {
      keys = await observeIncidents();
    } catch {
      keys = [unavailableSignal];
      code = 'MONITOR_UNAVAILABLE';
    }
    await syncIncidents(keys, code === null, options.recipientUserIds);
    let transportReady = true;
    try {
      await delivery.healthcheck();
    } catch {
      transportReady = false;
      code = code || 'ALERT_TRANSPORT_UNAVAILABLE';
    }
    const delivered = transportReady
      ? await deliverAlerts(options, delivery)
      : { sent: 0, suppressed: 0, failed: 0, lost: 0 };
    if (delivered.failed || delivered.lost) code = code || 'ALERT_SUBMISSION_FAILED';
    const terminal = (
      await query(
        "SELECT EXISTS(SELECT 1 FROM operations_alert_outbox WHERE status='failed_terminal') AS terminal",
      )
    ).rows[0].terminal;
    if (terminal) code = code || 'TERMINAL_ALERT_PENDING';
    const eligibility = (
      await query(
        `SELECT COUNT(DISTINCT u.id)::int AS count FROM users u JOIN organizations o ON o.id=u.organization_id
      JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE u.id=ANY($1::uuid[]) AND ${eligibleOperator}`,
        [options.recipientUserIds],
      )
    ).rows[0].count;
    if (eligibility !== options.recipientUserIds.length) code = code || 'OPERATOR_UNAVAILABLE';
    const pending = (
      await query(`SELECT EXISTS(SELECT 1 FROM operations_alert_outbox WHERE status='failed') AS retry,
      EXISTS(SELECT 1 FROM operations_incidents i WHERE i.state='open' AND EXISTS(
        SELECT 1 FROM operations_alert_outbox a WHERE a.incident_id=i.id AND a.status='suppressed' AND a.last_error_code='EMAIL_SUPPRESSED')) AS suppressed`)
    ).rows[0];
    if (pending.retry) code = code || 'ALERT_RETRY_PENDING';
    const overdue = (
      await query(
        "SELECT EXISTS(SELECT 1 FROM operations_alert_outbox WHERE status IN ('queued','failed') AND next_attempt_at<=NOW()-INTERVAL '15 minutes') AS overdue",
      )
    ).rows[0].overdue;
    if (overdue) code = code || 'ALERT_BACKLOG_OVERDUE';
    if (pending.suppressed) code = code || 'ALERT_SUPPRESSED';
    await client.query(
      `UPDATE operations_alert_status SET error_code=$1,
      last_success_at=CASE WHEN $1::text IS NULL THEN NOW() ELSE last_success_at END,
      consecutive_failures=CASE WHEN $1::text IS NULL THEN 0 ELSE consecutive_failures+1 END WHERE id=1`,
      [code],
    );
    return code ? ('failed' as const) : ('succeeded' as const);
  } finally {
    await client.query(
      "SELECT pg_advisory_unlock(hashtextextended('bettertrade.operations.alert-cycle',0))",
    );
  }
}

export function alertStatusHealthy(
  row: {
    last_poll_at: string | Date;
    last_success_at: string | Date | null;
    error_code: string | null;
    consecutive_failures: number;
  } | null,
  enabled: boolean,
  terminal: boolean,
  now = Date.now(),
) {
  if (
    !enabled ||
    !row ||
    terminal ||
    row.error_code ||
    row.consecutive_failures ||
    !row.last_success_at
  )
    return false;
  return [row.last_poll_at, row.last_success_at].every((value) => {
    const age = now - new Date(value).getTime();
    return Number.isFinite(age) && age >= 0 && age < 900000;
  });
}
export async function readAlertStatus() {
  return withCatalogRead(async (execute) => {
    const row =
      (
        await execute(
          'SELECT config_fingerprint,last_poll_at,last_success_at,error_code,consecutive_failures FROM operations_alert_status WHERE id=1',
        )
      ).rows[0] ?? null;
    const delivery = (
      await execute(
        "SELECT EXISTS(SELECT 1 FROM operations_alert_outbox WHERE status='failed_terminal') AS terminal, EXISTS(SELECT 1 FROM operations_alert_outbox WHERE status IN ('queued','failed','sending')) AS pending",
      )
    ).rows[0];
    if (typeof delivery?.terminal !== 'boolean' || typeof delivery.pending !== 'boolean')
      throw new Error('Missing alert observation');
    const options = alertOptions();
    const eligibility = options.enabled
      ? (
          await execute(
            `SELECT COUNT(DISTINCT u.id)::int AS count FROM users u JOIN organizations o ON o.id=u.organization_id JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE u.id=ANY($1::uuid[]) AND ${eligibleOperator}`,
            [options.recipientUserIds],
          )
        ).rows[0].count
      : 0;
    const errorCodes = [
      'ALERT_POLL_RUNNING',
      'MONITOR_UNAVAILABLE',
      'ALERT_SUBMISSION_FAILED',
      'TERMINAL_ALERT_PENDING',
      'OPERATOR_UNAVAILABLE',
      'ALERT_RETRY_PENDING',
      'ALERT_SUPPRESSED',
      'ALERT_BACKLOG_OVERDUE',
      'ALERT_TRANSPORT_UNAVAILABLE',
    ];
    const error =
      row === null
        ? null
        : row.error_code === null
          ? null
          : errorCodes.includes(String(row.error_code))
            ? String(row.error_code)
            : 'UNKNOWN_ALERT_FAILURE';
    const configurationMatches = row?.config_fingerprint === alertConfigurationFingerprint(options);
    const effectiveError =
      options.enabled && !configurationMatches
        ? 'ALERT_CONFIGURATION_CHANGED'
        : options.enabled && eligibility !== options.recipientUserIds.length
          ? 'OPERATOR_UNAVAILABLE'
          : error;
    const observation = row
      ? {
          last_poll_at: row.last_poll_at,
          last_success_at: row.last_success_at,
          error_code: effectiveError,
          consecutive_failures: row.consecutive_failures,
        }
      : null;
    return {
      enabled: options.enabled,
      configuredRecipients: options.recipientUserIds.length,
      healthy: alertStatusHealthy(
        observation as unknown as Parameters<typeof alertStatusHealthy>[0],
        options.enabled,
        delivery.terminal,
      ),
      terminal: delivery.terminal,
      pending: delivery.pending,
      observation,
    };
  });
}
