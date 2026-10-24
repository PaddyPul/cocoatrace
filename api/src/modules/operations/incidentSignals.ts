import { compareOrdinal } from '../../utils/ordinal';
import { jobNames, type JobStatus } from './jobs';
import { type QueueSignal, queueNames } from './backlog';
const jobCodes = ['JOB_FAILED', 'JOB_STALE', 'JOB_NOT_OBSERVED'];
const queueCodes = [
  'TERMINAL_WORK_PENDING',
  'EXPIRED_LEASE',
  'OVERDUE_WORK',
  'MONITOR_LIMIT_REACHED',
];
export const unavailableSignal = 'monitor:operations:MONITOR_UNAVAILABLE';
export function safeSignalKey(value: string): boolean {
  const [kind, name, code, ...extra] = value.split(':');
  return (
    !extra.length &&
    ((kind === 'job' &&
      (jobNames as readonly string[]).includes(name) &&
      jobCodes.includes(code)) ||
      (kind === 'queue' &&
        (queueNames as readonly string[]).includes(name) &&
        queueCodes.includes(code)) ||
      value === unavailableSignal)
  );
}
export function incidentSignals(jobs: JobStatus[], queues: QueueSignal[], now: number): string[] {
  const signals: string[] = [];
  for (const name of jobNames) {
    const row = jobs.find((job) => job.job_name === name);
    let code: string | null = null;
    if (!row || !row.last_success_at) code = 'JOB_NOT_OBSERVED';
    else if (row.status === 'failed' || row.error_code || row.consecutive_failures > 0)
      code = 'JOB_FAILED';
    else {
      const age =
        now -
        new Date(row.status === 'running' ? row.started_at : (row.finished_at ?? '')).getTime();
      if (!Number.isFinite(age) || age < 0 || age >= 900000) code = 'JOB_STALE';
    }
    if (code) signals.push(`job:${name}:${code}`);
  }
  for (const queue of queues)
    for (const code of queue.incidents) {
      const key = `queue:${queue.name}:${code}`;
      if (!safeSignalKey(key)) throw new Error('Invalid incident observation');
      signals.push(key);
    }
  return [...new Set(signals)].sort(compareOrdinal);
}
