import type { PoolClient } from 'pg';
import { AppError } from '../../errors';

export const jobNames = [
  'evidence_scan',
  'evidence_cleanup',
  'payment_reminders',
  'recall_email',
  'fee_statement_email',
] as const;
export type JobName = (typeof jobNames)[number];
export type JobResult = {
  failed?: number;
  dead?: number;
  retried?: number;
  lostClaims?: number;
  terminalFailures?: number;
  busy?: boolean;
  skipped?: number;
};
export type Job = { name: JobName; run(): Promise<JobResult> };

export function jobErrorCode(error: unknown): string {
  const code = error instanceof AppError ? error.code : 'OPERATIONS_JOB_FAILED';
  return /^[A-Z0-9_]{1,80}$/.test(code) ? code : 'OPERATIONS_JOB_FAILED';
}

export function resultCode(result: JobResult): string | null {
  if (result.skipped) return 'EMAIL_NOT_CONFIGURED';
  if (result.busy) return 'MAINTENANCE_BUSY';
  if (result.terminalFailures || result.dead) return 'TERMINAL_WORK_PENDING';
  if (result.failed || result.retried || result.lostClaims) return 'WORK_RETRY_PENDING';
  return null;
}

/** Session lock stays held through provider I/O and status recording; no timeout releases it early. */
export async function runTrackedJob(
  client: PoolClient,
  job: Job,
): Promise<'busy' | 'succeeded' | 'failed'> {
  const lockName = `bettertrade.operations.${job.name}`;
  const acquired = await client.query(
    'SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired',
    [lockName],
  );
  if (!acquired.rows[0]?.acquired) return 'busy';
  try {
    await client.query(
      `INSERT INTO operations_job_status(job_name,status,started_at,runs)
      VALUES($1,'running',NOW(),1) ON CONFLICT(job_name) DO UPDATE
      SET status='running',started_at=NOW(),finished_at=NULL,error_code=NULL,runs=operations_job_status.runs+1`,
      [job.name],
    );
    let code: string | null;
    try {
      code = resultCode(await job.run());
    } catch (error) {
      code = jobErrorCode(error);
    }
    await client.query(
      `UPDATE operations_job_status SET status=CASE WHEN $2::text IS NULL THEN 'succeeded' ELSE 'failed' END,
      finished_at=NOW(),last_success_at=CASE WHEN $2::text IS NULL THEN NOW() ELSE last_success_at END,
      error_code=$2,consecutive_failures=CASE WHEN $2::text IS NULL THEN 0 ELSE consecutive_failures+1 END
      WHERE job_name=$1`,
      [job.name, code],
    );
    return code ? 'failed' : 'succeeded';
  } finally {
    await client.query('SELECT pg_advisory_unlock(hashtextextended($1,0))', [lockName]);
  }
}

export type JobStatus = {
  job_name: string;
  status: string;
  started_at: string | Date;
  finished_at: string | Date | null;
  last_success_at: string | Date | null;
  error_code: string | null;
  consecutive_failures: number;
  runs: string | number;
};

export function statusHealthy(rows: JobStatus[], now = Date.now()): boolean {
  return jobNames.every((name) => {
    const row = rows.find((item) => item.job_name === name);
    if (
      !row ||
      row.error_code ||
      !row.last_success_at ||
      row.status === 'failed' ||
      row.consecutive_failures > 0
    )
      return false;
    const time = new Date(
      row.status === 'running' ? row.started_at : (row.finished_at ?? ''),
    ).getTime();
    return Number.isFinite(time) && time <= now && now - time < 15 * 60_000;
  });
}
