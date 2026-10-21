import { withCatalogRead, type Execute } from '../catalog/paging';

export const backlogLimit = 1000;
export const overdueAfterSeconds = 900;
export const queueNames = [
  'cleanup',
  'payment_reminder',
  'recall',
  'fee_statement',
  'invitation',
] as const;
export type QueueName = (typeof queueNames)[number];
const sources = {
  invitation: {
    table: 'invitation_email_outbox',
    state: 'status',
    pending: "status IN ('queued','failed')",
    leased: 'sending',
    terminal: 'failed_terminal',
    terminalOrder: 'id',
    leaseOrder: 'lease_expires_at NULLS FIRST,id',
  },
  cleanup: {
    table: 'evidence_object_cleanup',
    state: 'state',
    pending: "state='pending'",
    leased: 'processing',
    terminal: 'dead',
    terminalOrder: 'updated_at,id',
    leaseOrder: 'lease_expires_at,id',
  },
  payment_reminder: {
    table: 'payment_reminder_email_outbox',
    state: 'status',
    pending: "status IN ('queued','failed')",
    leased: 'sending',
    terminal: 'failed_terminal',
    terminalOrder: 'id',
    leaseOrder: 'lease_expires_at NULLS FIRST,id',
  },
  recall: {
    table: 'recall_email_outbox',
    state: 'status',
    pending: "status IN ('queued','failed')",
    leased: 'sending',
    terminal: 'failed_terminal',
    terminalOrder: 'id',
    leaseOrder: 'lease_expires_at NULLS FIRST,id',
  },
  fee_statement: {
    table: 'fee_statement_email_outbox',
    state: 'status',
    pending: "status IN ('queued','failed')",
    leased: 'sending',
    terminal: 'failed_terminal',
    terminalOrder: 'id',
    leaseOrder: 'lease_expires_at NULLS FIRST,id',
  },
} as const;
export type BacklogCount = { count: number; more: boolean };
export type QueueSignal = {
  name: QueueName;
  queued: BacklogCount;
  leased: BacklogCount;
  terminal: BacklogCount;
  retryingObserved: number;
  expiredLeasesObserved: number;
  oldestDueAt: string | null;
  incidents: string[];
};
function integer(value: unknown): number {
  const result = Number(value);
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(result) ||
    result < 0 ||
    result > backlogLimit + 1
  )
    throw new Error('Invalid queue observation');
  return result;
}
function count(value: unknown): BacklogCount {
  const observed = integer(value);
  return { count: Math.min(observed, backlogLimit), more: observed > backlogLimit };
}
export function queueSignal(name: QueueName, row: Record<string, unknown>): QueueSignal {
  const queued = count(row.queued),
    leased = count(row.leased),
    terminal = count(row.terminal);
  const retryingObserved = Math.min(integer(row.retrying), backlogLimit);
  const expiredLeasesObserved = Math.min(integer(row.expired), backlogLimit);
  const observed = new Date(String(row.observed_at)).getTime();
  const due = row.oldest_due === null ? null : new Date(String(row.oldest_due)).getTime();
  if (
    !Number.isFinite(observed) ||
    (due !== null && (!Number.isFinite(due) || due > observed)) ||
    (due !== null && queued.count === 0) ||
    retryingObserved > queued.count ||
    expiredLeasesObserved > leased.count
  )
    throw new Error('Invalid queue observation');
  const incidents = [];
  if (terminal.count) incidents.push('TERMINAL_WORK_PENDING');
  if (expiredLeasesObserved) incidents.push('EXPIRED_LEASE');
  if (due !== null && observed - due >= overdueAfterSeconds * 1000) incidents.push('OVERDUE_WORK');
  if (queued.more || leased.more || terminal.more) incidents.push('MONITOR_LIMIT_REACHED');
  return {
    name,
    queued,
    leased,
    terminal,
    retryingObserved,
    expiredLeasesObserved,
    oldestDueAt: due === null ? null : new Date(due).toISOString(),
    incidents,
  };
}
export async function loadQueueBacklog(execute: Execute) {
  const queues: QueueSignal[] = [];
  let observedAt = '';
  for (const name of queueNames) {
    const source = sources[name];
    // Fixed identifiers only; indexed probes stop at the sentinel. Counts are lower bounds
    // when capped. Queue contents, recipient data and provider errors are never returned.
    const result = await execute(`WITH queued AS MATERIALIZED (
      SELECT id,next_attempt_at,attempts FROM ${source.table} WHERE ${source.pending}
      ORDER BY next_attempt_at,id LIMIT ${backlogLimit + 1}
    ), leased AS MATERIALIZED (
      SELECT id,lease_expires_at FROM ${source.table} WHERE ${source.state}='${source.leased}'
      ORDER BY ${source.leaseOrder} LIMIT ${backlogLimit + 1}
    ), terminal AS MATERIALIZED (
      SELECT id FROM ${source.table} WHERE ${source.state}='${source.terminal}'
      ORDER BY ${source.terminalOrder} LIMIT ${backlogLimit + 1}
    ) SELECT NOW() AS observed_at,
      (SELECT COUNT(*)::int FROM queued) AS queued,
      (SELECT COUNT(*)::int FROM leased) AS leased,
      (SELECT COUNT(*)::int FROM terminal) AS terminal,
      (SELECT COUNT(*)::int FROM (SELECT attempts FROM queued ORDER BY next_attempt_at,id LIMIT ${backlogLimit}) observed WHERE attempts>0) AS retrying,
      (SELECT COUNT(*)::int FROM (SELECT lease_expires_at FROM leased ORDER BY ${source.leaseOrder} LIMIT ${backlogLimit}) observed WHERE lease_expires_at IS NULL OR lease_expires_at<=NOW()) AS expired,
      (SELECT MIN(next_attempt_at) FROM queued WHERE next_attempt_at<=NOW()) AS oldest_due`);
    if (result.rows.length !== 1) throw new Error('Missing queue observation');
    queues.push(queueSignal(name, result.rows[0]));
    observedAt = new Date(String(result.rows[0].observed_at)).toISOString();
  }
  return {
    observedAt,
    limit: backlogLimit,
    overdueAfterSeconds,
    needsAttention: queues.some((queue) => queue.incidents.length > 0),
    queues,
  };
}
export const readQueueBacklog = () => withCatalogRead(loadQueueBacklog);
