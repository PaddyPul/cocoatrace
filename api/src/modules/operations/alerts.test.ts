import type { PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn() }));
vi.mock('../../db', () => ({ query: mocks.query }));
vi.mock('../../services/databaseTransaction', () => ({ inDatabaseTransaction: mocks.transaction }));
vi.mock('../../services/emailSender', () => ({
  emailSender: () => ({ send: vi.fn(), healthcheck: vi.fn() }),
}));
import {
  alertConfigurationFingerprint,
  alertMessage,
  alertStatusHealthy,
  deliverAlerts,
  runAlertCycle,
  syncIncidents,
} from './alerts';
import { incidentSignals, safeSignalKey } from './incidentSignals';
import { jobNames, type JobStatus } from './jobs';
const recipient = '11111111-1111-4111-8111-111111111111';
const now = Date.parse('2026-10-13T22:00:00Z');
const healthy = jobNames.map((job_name) => ({
  job_name,
  status: 'succeeded',
  started_at: new Date(now - 1000),
  finished_at: new Date(now - 500),
  last_success_at: new Date(now - 500),
  error_code: null,
  consecutive_failures: 0,
  runs: 1,
})) as JobStatus[];
describe('redacted deduplicated operator incident alerts', () => {
  it('classifies missing, failed and stale jobs without copying private provider errors', () => {
    expect(incidentSignals(healthy, [], now)).toEqual([]);
    expect(incidentSignals([], [], now)).toHaveLength(jobNames.length);
    expect(
      incidentSignals(
        [
          { ...healthy[0], error_code: 'private@example.test secret provider payload' },
          ...healthy.slice(1),
        ],
        [],
        now,
      ),
    ).toEqual(['job:evidence_scan:JOB_FAILED']);
    expect(
      incidentSignals(
        [{ ...healthy[0], finished_at: new Date(now - 900000) }, ...healthy.slice(1)],
        [],
        now,
      ),
    ).toEqual(['job:evidence_scan:JOB_STALE']);
  });
  it('admits only fixed signal vocabularies and produces a generic authenticated-console link', () => {
    for (const key of [
      'job:evidence_scan:SECRET_VALUE',
      'queue:customer:TERMINAL_WORK_PENDING',
      'queue:recall:private@example.test',
      'job:evidence_scan:JOB_FAILED:extra',
    ])
      expect(safeSignalKey(key)).toBe(false);
    const message = alertMessage(
      'queue:recall:TERMINAL_WORK_PENDING',
      new Date(now).toISOString(),
      'operator@integration.test',
    );
    expect(message.category).toBe('operations_alert');
    expect(message.text).toContain('/operations');
    expect(message.text).not.toContain('operator@');
    expect(() =>
      alertMessage('job:private:SECRET', new Date(now).toISOString(), 'operator@integration.test'),
    ).toThrow();
  });
  it('never resolves existing incidents after an incomplete observation and uses durable uniqueness', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    mocks.transaction.mockImplementation(async (callback) => callback({ query }));
    await syncIncidents(['monitor:operations:MONITOR_UNAVAILABLE'], false, [recipient]);
    expect(query.mock.calls.some(([sql]) => sql.includes("SET state='resolved'"))).toBe(false);
    expect(
      query.mock.calls.some(([sql]) =>
        sql.includes('ON CONFLICT(incident_id,recipient_user_id) DO NOTHING'),
      ),
    ).toBe(true);
    expect(query.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
  });
  it('rejects arbitrary signal text and malformed or duplicate recipients before a transaction', async () => {
    mocks.transaction.mockClear();
    await expect(syncIncidents(['job:tenant:SECRET'], true, [recipient])).rejects.toThrow();
    await expect(syncIncidents([], true, [recipient, recipient])).rejects.toThrow();
    await expect(syncIncidents([], true, ['not-an-id'])).rejects.toThrow();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it('disabled operation does not read queues or submit any mail', async () => {
    mocks.query.mockClear();
    const client = { query: vi.fn() } as unknown as PoolClient;
    const sender = { send: vi.fn(), healthcheck: vi.fn() };
    expect(await runAlertCycle(client, { enabled: false, recipientUserIds: [] }, sender)).toBe(
      'disabled',
    );
    expect(await deliverAlerts({ enabled: false, recipientUserIds: [] }, sender)).toEqual({
      sent: 0,
      suppressed: 0,
      failed: 0,
      lost: 0,
    });
    expect(mocks.query).not.toHaveBeenCalled();
    expect(sender.send).not.toHaveBeenCalled();
  });
  it('a held deployment lock does not collect incidents or send alerts', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [{ acquired: false }] }),
    } as unknown as PoolClient;
    const sender = { send: vi.fn(), healthcheck: vi.fn() };
    expect(
      await runAlertCycle(client, { enabled: true, recipientUserIds: [recipient] }, sender),
    ).toBe('busy');
    expect(sender.send).not.toHaveBeenCalled();
  });
  it('binds the configuration fingerprint and preserves unknown observations instead of reporting success', async () => {
    const local = vi.fn().mockResolvedValue({ rows: [] });
    mocks.transaction.mockImplementation(async (callback) => callback({ query: local }));
    mocks.query.mockImplementation(async (sql: string) => ({
      rows: [
        sql.includes('COUNT(DISTINCT')
          ? { count: 1 }
          : { terminal: false, retry: false, suppressed: false, overdue: false },
      ],
    }));
    const query = vi.fn(async (sql: string, values?: unknown[]) => {
      if (sql.includes('pg_try')) return { rows: [{ acquired: true }] };
      if (sql.startsWith('SELECT id')) return { rows: [] };
      if (sql.startsWith('INSERT')) {
        expect(values).toEqual([
          alertConfigurationFingerprint({ enabled: true, recipientUserIds: [recipient] }),
        ]);
        expect(sql).toContain('config_fingerprint=$1');
      }
      return { rows: [] };
    });
    const delivery = { send: vi.fn(), healthcheck: async () => {} };
    expect(
      await runAlertCycle(
        { query } as unknown as PoolClient,
        { enabled: true, recipientUserIds: [recipient] },
        delivery,
      ),
    ).toBe('failed');
    expect(local.mock.calls.some(([sql]) => sql.includes("SET state='resolved'"))).toBe(false);
    expect(query.mock.calls.at(-1)?.[0]).toContain('pg_advisory_unlock');
  });
  it('holds no success claim for disabled, missing, failed, terminal or stale polling', () => {
    const row = {
      last_poll_at: new Date(now - 1000),
      last_success_at: new Date(now - 1000),
      error_code: null,
      consecutive_failures: 0,
    };
    expect(alertStatusHealthy(row, true, false, now)).toBe(true);
    expect(alertStatusHealthy(row, false, false, now)).toBe(false);
    expect(alertStatusHealthy(null, true, false, now)).toBe(false);
    expect(alertStatusHealthy(row, true, true, now)).toBe(false);
    expect(
      alertStatusHealthy({ ...row, error_code: 'SMTP_SUBMISSION_FAILED' }, true, false, now),
    ).toBe(false);
    expect(
      alertStatusHealthy({ ...row, last_poll_at: new Date(now - 900000) }, true, false, now),
    ).toBe(false);
    expect(
      alertStatusHealthy({ ...row, last_success_at: new Date(now + 1) }, true, false, now),
    ).toBe(false);
  });
});
