import type { PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import {
  jobErrorCode,
  jobNames,
  resultCode,
  runTrackedJob,
  statusHealthy,
  type JobStatus,
} from './jobs';

describe('durable operation signals', () => {
  it('never reports missing, failed, stuck or never-successful jobs healthy', () => {
    const now = Date.now();
    const rows: JobStatus[] = jobNames.map((name) => ({
      job_name: name,
      status: 'succeeded',
      started_at: new Date(now - 1000),
      finished_at: new Date(now - 500),
      last_success_at: new Date(now - 500),
      error_code: null,
      consecutive_failures: 0,
      runs: 1,
    }));
    expect(statusHealthy(rows, now)).toBe(true);
    expect(statusHealthy(rows.slice(1), now)).toBe(false);
    for (const change of [
      { status: 'failed' },
      { last_success_at: null },
      { finished_at: new Date(now - 900_001) },
      { status: 'running', started_at: new Date(now - 900_001) },
      { status: 'running', consecutive_failures: 1 },
      { error_code: 'TERMINAL_WORK_PENDING' },
    ]) {
      expect(statusHealthy([{ ...rows[0], ...change }, ...rows.slice(1)], now)).toBe(false);
    }
  });
  it('distinguishes suppressed delivery, busy scans, terminal work and retry incidents', () => {
    expect(resultCode({ skipped: 1 })).toBe('EMAIL_NOT_CONFIGURED');
    expect(resultCode({ busy: true })).toBe('MAINTENANCE_BUSY');
    expect(resultCode({ terminalFailures: 2 })).toBe('TERMINAL_WORK_PENDING');
    expect(resultCode({ lostClaims: 1 })).toBe('WORK_RETRY_PENDING');
    expect(resultCode({ failed: 0 })).toBeNull();
    expect(jobErrorCode(new Error('secret@example.com /private/object-key'))).toBe(
      'OPERATIONS_JOB_FAILED',
    );
  });
  it('skips a held deployment lock without consuming work or overwriting its status', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ acquired: false }] });
    const run = vi.fn();
    expect(
      await runTrackedJob({ query } as unknown as PoolClient, { name: 'recall_email', run }),
    ).toBe('busy');
    expect(run).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('holds the session lock through real completion and releases it after a redacted failure', async () => {
    const sequence: string[] = [];
    const query = vi.fn(async (sql: string, values?: unknown[]) => {
      if (sql.includes('pg_try')) {
        sequence.push('lock');
        return { rows: [{ acquired: true }] };
      }
      if (sql.includes('INSERT')) sequence.push('started');
      if (sql.startsWith('UPDATE')) {
        sequence.push('failed');
        expect(values?.[1]).toBe('OPERATIONS_JOB_FAILED');
      }
      if (sql.includes('pg_advisory_unlock')) sequence.push('unlock');
      return { rows: [] };
    });
    expect(
      await runTrackedJob({ query } as unknown as PoolClient, {
        name: 'recall_email',
        run: async () => {
          sequence.push('work');
          throw new Error('credential-secret');
        },
      }),
    ).toBe('failed');
    expect(sequence).toEqual(['lock', 'started', 'work', 'failed', 'unlock']);
    expect(JSON.stringify(query.mock.calls)).not.toContain('credential-secret');
  });
  it('releases the session lock even if durable status recording fails', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('pg_try')) return { rows: [{ acquired: true }] };
      if (sql.startsWith('UPDATE')) throw new Error('database disconnected');
      return { rows: [] };
    });
    await expect(
      runTrackedJob({ query } as unknown as PoolClient, {
        name: 'evidence_scan',
        run: async () => ({}),
      }),
    ).rejects.toThrow('database disconnected');
    expect(query.mock.calls.at(-1)?.[0]).toContain('pg_advisory_unlock');
  });
});
