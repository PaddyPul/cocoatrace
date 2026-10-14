import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuthCtx } from '../components/auth/AuthProvider';
import Layout from '../components/layout/Layout';
import {
  validBacklog,
  displayCount,
  incidentLabels,
  queueLabels,
  type Backlog,
} from '../components/operations/backlog';

type Job = {
  job_name: string;
  status: string;
  error_code: string | null;
  last_success_at: string | null;
  consecutive_failures: number;
};
type Ticket = { id: string; last_error_code: string | null; attempts: number };
type EmailQueue = 'payment_reminder' | 'recall' | 'operator_alert';
type EmailTicket = Ticket & { retryable: boolean };
type Selection = Ticket & { queue: 'cleanup' | EmailQueue };
const emailNames = {
  payment_reminder: 'Payment reminder',
  recall: 'Recall',
  operator_alert: 'Operator alert',
};
const names = ['evidence_scan', 'evidence_cleanup', 'payment_reminders', 'recall_email'];
const unsafe = ['LIVE_EVIDENCE_REFERENCE', 'INVALID_OBJECT_KEY', 'STORAGE_PROVIDER_MISMATCH'];
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function code(value: unknown) {
  return value === null || (typeof value === 'string' && /^[A-Z0-9_]{1,80}$/.test(value));
}
function statuses(value: unknown): value is { healthy: boolean; jobs: Job[] } {
  if (
    !record(value) ||
    typeof value.healthy !== 'boolean' ||
    !Array.isArray(value.jobs) ||
    value.jobs.length > 4
  )
    return false;
  const seen = new Set<string>();
  return (
    value.jobs.every((row) => {
      if (
        !record(row) ||
        typeof row.job_name !== 'string' ||
        !names.includes(row.job_name) ||
        seen.has(row.job_name) ||
        !['running', 'succeeded', 'failed'].includes(String(row.status)) ||
        !code(row.error_code) ||
        !(
          row.last_success_at === null ||
          (typeof row.last_success_at === 'string' &&
            Number.isFinite(Date.parse(row.last_success_at)))
        ) ||
        !Number.isSafeInteger(row.consecutive_failures) ||
        Number(row.consecutive_failures) < 0
      )
        return false;
      seen.add(row.job_name);
      return true;
    }) &&
    (!value.healthy ||
      (value.jobs.length === 4 &&
        value.jobs.every(
          (row) =>
            record(row) &&
            row.status !== 'failed' &&
            row.error_code === null &&
            row.last_success_at !== null &&
            row.consecutive_failures === 0,
        )))
  );
}
function tickets(value: unknown, email = false): value is { items: EmailTicket[]; more: boolean } {
  return (
    record(value) &&
    typeof value.more === 'boolean' &&
    Array.isArray(value.items) &&
    value.items.length <= 50 &&
    value.items.every(
      (row) =>
        record(row) &&
        typeof row.id === 'string' &&
        /^[0-9a-f-]{36}$/i.test(row.id) &&
        (email
          ? row.status === 'failed_terminal' && typeof row.retryable === 'boolean'
          : row.state === 'dead') &&
        code(row.last_error_code) &&
        Number.isSafeInteger(row.attempts) &&
        Number(row.attempts) >= 0,
    )
  );
}

type AlertStatus = {
  enabled: boolean;
  configuredRecipients: number;
  healthy: boolean;
  terminal: boolean;
  pending: boolean;
  observation: {
    last_poll_at: string;
    last_success_at: string | null;
    error_code: string | null;
    consecutive_failures: number;
  } | null;
};
function alertsValid(value: unknown): value is AlertStatus {
  if (
    !record(value) ||
    typeof value.enabled !== 'boolean' ||
    !Number.isSafeInteger(value.configuredRecipients) ||
    Number(value.configuredRecipients) < 0 ||
    Number(value.configuredRecipients) > 5 ||
    typeof value.healthy !== 'boolean' ||
    typeof value.terminal !== 'boolean' ||
    typeof value.pending !== 'boolean'
  )
    return false;
  const row = value.observation;
  if (
    row !== null &&
    (!record(row) ||
      typeof row.last_poll_at !== 'string' ||
      !Number.isFinite(Date.parse(row.last_poll_at)) ||
      !(
        row.last_success_at === null ||
        (typeof row.last_success_at === 'string' &&
          Number.isFinite(Date.parse(row.last_success_at)))
      ) ||
      !code(row.error_code) ||
      !Number.isSafeInteger(row.consecutive_failures) ||
      Number(row.consecutive_failures) < 0)
  )
    return false;
  return (
    !value.healthy ||
    (value.enabled &&
      Number(value.configuredRecipients) > 0 &&
      !value.terminal &&
      record(row) &&
      row.last_success_at !== null &&
      row.error_code === null &&
      row.consecutive_failures === 0)
  );
}
export default function OperationsPage() {
  const { canDo } = useAuthCtx();
  const allowed = canDo('*');
  const [data, setData] = useState<{ healthy: boolean; jobs: Job[] } | null>(null),
    [dead, setDead] = useState<{ items: Ticket[]; more: boolean } | null>(null);
  const [emails, setEmails] = useState<Record<
    EmailQueue,
    { items: EmailTicket[]; more: boolean }
  > | null>(null);
  const [alertStatus, setAlertStatus] = useState<AlertStatus | null>(null);
  const [backlog, setBacklog] = useState<Backlog | null>(null);
  const [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [selected, setSelected] = useState<Selection | null>(null),
    [reason, setReason] = useState(''),
    [saving, setSaving] = useState(false),
    [decisionError, setDecisionError] = useState('');
  const version = useRef(0);
  const refresh = useCallback(async () => {
    if (!allowed) return;
    const current = ++version.current;
    setLoading(true);
    try {
      const [status, queue, payment, recall, observation, alerts, operatorAlerts] =
        await Promise.all([
          api<unknown>('GET', '/operations/status'),
          api<unknown>('GET', '/operations/cleanup/dead'),
          api<unknown>('GET', '/operations/email/payment_reminder/dead'),
          api<unknown>('GET', '/operations/email/recall/dead'),
          api<unknown>('GET', '/operations/backlog'),
          api<unknown>('GET', '/operations/alerts'),
          api<unknown>('GET', '/operations/alerts/dead'),
        ]);
      if (
        !statuses(status) ||
        !tickets(queue) ||
        !tickets(payment, true) ||
        !tickets(recall, true) ||
        !tickets(operatorAlerts, true) ||
        !validBacklog(observation) ||
        !alertsValid(alerts)
      )
        throw new Error('Invalid operations response. Retry to refresh.');
      if (current === version.current) {
        setData(status);
        setBacklog(observation);
        setAlertStatus(alerts);
        setDead(queue);
        setEmails({ payment_reminder: payment, recall, operator_alert: operatorAlerts });
        setError('');
      }
    } catch {
      if (current === version.current) {
        setData(null);
        setBacklog(null);
        setAlertStatus(null);
        setDead(null);
        setEmails(null);
        setError(
          'Operations status unavailable. Queue backlog is unknown. Operator alert delivery is unknown. Retry to refresh; healthy operation has not been confirmed.',
        );
      }
    } finally {
      if (current === version.current) setLoading(false);
    }
  }, [allowed]);
  useEffect(() => {
    void refresh();
    return () => {
      version.current++;
    };
  }, [refresh]);
  const retry = async () => {
    if (!selected || saving) return;
    setSaving(true);
    setDecisionError('');
    try {
      const path =
        selected.queue === 'cleanup'
          ? 'cleanup'
          : selected.queue === 'operator_alert'
            ? 'alerts'
            : `email/${selected.queue}`;
      const result = await api<unknown>('POST', `/operations/${path}/${selected.id}/retry`, {
        reason: reason.trim(),
      });
      if (!record(result) || result.queued !== true) throw new Error('Retry was not confirmed');
      setSelected(null);
      setReason('');
      await refresh();
    } catch (e) {
      setDecisionError(e instanceof Error ? e.message : 'Retry was not confirmed.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Layout currentPage="operations">
      <section aria-label="Operations monitor" className="mx-auto max-w-5xl space-y-5">
        <h1 className="text-2xl font-bold">Operations monitor</h1>
        {!allowed ? (
          <p role="alert">Platform administrator access required.</p>
        ) : (
          <>
            <p className="text-sm text-text-muted">
              Scheduled evidence scans, cleanup and notification delivery. This monitor does not
              confirm email inbox delivery or release retained inventory.
            </p>
            <button className="btn-secondary" onClick={() => void refresh()} disabled={loading}>
              Refresh operations
            </button>
            {loading && <p role="status">Refreshing operations…</p>}
            {error && <p role="alert">{error}</p>}
            {data && (
              <>
                <p role="status">
                  {data.healthy && backlog && !backlog.needsAttention
                    ? 'Scheduled jobs healthy'
                    : 'Scheduled jobs need attention'}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th>Job</th>
                        <th>State</th>
                        <th>Last successful run</th>
                        <th>Incident</th>
                      </tr>
                    </thead>
                    <tbody>
                      {names.map((name) => {
                        const job = data.jobs.find((row) => row.job_name === name);
                        return (
                          <tr key={name}>
                            <td>{name}</td>
                            <td>{job?.status ?? 'Not yet observed'}</td>
                            <td>
                              {job?.last_success_at
                                ? new Date(job.last_success_at).toLocaleString()
                                : 'No successful run recorded'}
                            </td>
                            <td>{job?.error_code ?? '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {alertStatus && (
              <section aria-label="Operator alert delivery" className="space-y-2">
                <h2 className="text-lg font-bold">Operator alert delivery</h2>
                <p role="status">
                  {!alertStatus.enabled
                    ? 'Operator alerts disabled'
                    : alertStatus.healthy
                      ? 'Alert polling and submission checks passed'
                      : 'Operator alert delivery needs investigation'}
                </p>
                <p className="text-sm">
                  {alertStatus.configuredRecipients} configured operator targets. SMTP submission is
                  not proof of inbox receipt. Incident alerts contain redacted operational signals
                  only.
                </p>
                {alertStatus.enabled && (
                  <p className="text-sm">
                    Last successful cycle:{' '}
                    {alertStatus.observation?.last_success_at
                      ? new Date(alertStatus.observation.last_success_at).toLocaleString()
                      : 'Not yet observed'}{' '}
                    ·{' '}
                    {alertStatus.observation?.error_code ??
                      (alertStatus.terminal
                        ? 'Terminal alert pending'
                        : 'No current error recorded')}
                  </p>
                )}
                {alertStatus.pending && (
                  <p className="text-sm">
                    Alert work remains queued or leased. Delivery runs in bounded batches.
                  </p>
                )}
              </section>
            )}
            {backlog && (
              <section aria-label="Queue backlog" className="space-y-3">
                <h2 className="text-lg font-bold">Queue backlog</h2>
                <p role="status">
                  {backlog.needsAttention
                    ? 'Queue incidents need investigation'
                    : 'No queue incidents observed'}
                </p>
                <p className="text-sm text-text-muted">
                  Cleanup and notification queues. Counts stop at 1,000 per state; ≥ means at least
                  that many. Retry and expired-lease counts cover the observed records. Due work
                  ages from its scheduled retry time. Evidence scanning uses the job status above.
                  This is not inbox-delivery confirmation.
                </p>
                <p className="text-sm">Observed: {new Date(backlog.observedAt).toLocaleString()}</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th>Queue</th>
                        <th>Queued</th>
                        <th>Leased</th>
                        <th>Terminal</th>
                        <th>Retries observed</th>
                        <th>Expired leases observed</th>
                        <th>Oldest due</th>
                        <th>Incidents</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backlog.queues.map((queue) => (
                        <tr key={queue.name}>
                          <th scope="row">{queueLabels[queue.name]}</th>
                          <td>{displayCount(queue.queued)}</td>
                          <td>{displayCount(queue.leased)}</td>
                          <td>{displayCount(queue.terminal)}</td>
                          <td>{queue.retryingObserved.toLocaleString('en')}</td>
                          <td>{queue.expiredLeasesObserved.toLocaleString('en')}</td>
                          <td>
                            {queue.oldestDueAt
                              ? new Date(queue.oldestDueAt).toLocaleString()
                              : 'No due work observed'}
                          </td>
                          <td>
                            {queue.incidents.length
                              ? queue.incidents.map((code) => incidentLabels[code]).join(' · ')
                              : 'None observed'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            {dead && (
              <section aria-label="Terminal cleanup">
                <h2 className="text-lg font-bold">Terminal cleanup</h2>
                <p className="text-sm">
                  Quota stays charged until physical deletion succeeds. Live evidence, invalid keys
                  and provider mismatches require investigation.
                </p>
                {dead.items.length === 0 ? (
                  <p>No terminal cleanup records observed.</p>
                ) : (
                  <ul className="space-y-3">
                    {dead.items.map((item) => (
                      <li key={item.id} className="rounded-lg border border-border p-3">
                        <span>
                          {item.id} · {item.last_error_code ?? 'Unknown incident'} · {item.attempts}{' '}
                          attempts
                        </span>
                        {!unsafe.includes(item.last_error_code ?? '') && (
                          <button
                            className="btn-secondary ml-3"
                            disabled={saving}
                            onClick={() => {
                              setSelected({ ...item, queue: 'cleanup' });
                              setReason('');
                              setDecisionError('');
                            }}
                          >
                            Review cleanup retry
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {dead.more && (
                  <p role="status">
                    Showing the first 50 terminal records. Resolve reviewed incidents and refresh
                    for the next records.
                  </p>
                )}
              </section>
            )}
            {emails &&
              (Object.keys(emailNames) as EmailQueue[]).map((queue) => (
                <section key={queue} aria-label={`${emailNames[queue]} terminal email`}>
                  <h2 className="text-lg font-bold">{emailNames[queue]} terminal email</h2>
                  {emails[queue].items.length === 0 ? (
                    <p>No terminal email records observed.</p>
                  ) : (
                    <ul className="space-y-3">
                      {emails[queue].items.map((item) => (
                        <li key={item.id} className="rounded-lg border border-border p-3">
                          <span>
                            {item.id} · {item.last_error_code ?? 'Unknown incident'} ·{' '}
                            {item.attempts} attempts
                          </span>
                          {item.retryable ? (
                            <button
                              className="btn-secondary ml-3"
                              disabled={saving}
                              onClick={() => {
                                setSelected({ ...item, queue });
                                setReason('');
                                setDecisionError('');
                              }}
                            >
                              Review email retry
                            </button>
                          ) : (
                            <p>
                              {queue === 'operator_alert'
                                ? 'Retry unavailable: check alert configuration, the original operator, incident state, recorded submission and lease.'
                                : 'Recorded submission or lease requires investigation; retry unavailable.'}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {emails[queue].more && (
                    <p role="status">
                      Showing the first 50 terminal email records. Resolve reviewed incidents and
                      refresh for the next records.
                    </p>
                  )}
                </section>
              ))}
            {selected && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label={selected.queue === 'cleanup' ? 'Cleanup recovery' : 'Email recovery'}
                className="rounded-xl border border-border bg-surface p-5"
              >
                <h2 className="text-lg font-bold">
                  {selected.queue === 'cleanup'
                    ? 'Review cleanup retry'
                    : `Review ${emailNames[selected.queue].toLowerCase()} email retry`}
                </h2>
                <p>{selected.id}</p>
                <p className="text-sm">
                  {selected.queue === 'cleanup'
                    ? 'Investigate the incident before requeueing. The worker rechecks references and storage safety; this action cannot delete evidence directly.'
                    : selected.queue === 'operator_alert'
                      ? 'Correct the alert delivery incident first. Alerts must be enabled, the original operator must still be configured and eligible, and the incident must remain open. Retry preserves the recipient and incident. An earlier SMTP submission may have succeeded, so retry can duplicate email. Queueing is not inbox receipt or incident resolution.'
                      : 'Correct the delivery incident before requeueing. The existing worker checks current delivery eligibility. An earlier submission may have succeeded before a crash, so retrying can duplicate email. Queueing does not confirm inbox receipt or acknowledge a recall.'}
                </p>
                <label className="block" htmlFor="operations-recovery-explanation">
                  Recovery explanation
                </label>
                <textarea
                  id="operations-recovery-explanation"
                  className="form-input"
                  value={reason}
                  maxLength={500}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={saving}
                />
                {decisionError && <p role="alert">{decisionError}</p>}
                <button
                  className="btn-primary"
                  onClick={() => void retry()}
                  disabled={saving || reason.trim().length < 10}
                >
                  Queue reviewed retry
                </button>
                <button
                  className="btn-secondary ml-3"
                  onClick={() => setSelected(null)}
                  disabled={saving}
                >
                  Cancel recovery
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </Layout>
  );
}
