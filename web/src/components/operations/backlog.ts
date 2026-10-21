export const queueLabels = {
  cleanup: 'Object cleanup',
  payment_reminder: 'Payment reminder email',
  recall: 'Recall email',
  fee_statement: 'Fee statement email',
  invitation: 'Invitation email',
};
type Count = { count: number; more: boolean };
export type Backlog = {
  observedAt: string;
  limit: number;
  overdueAfterSeconds: number;
  needsAttention: boolean;
  queues: {
    name: keyof typeof queueLabels;
    queued: Count;
    leased: Count;
    terminal: Count;
    retryingObserved: number;
    expiredLeasesObserved: number;
    oldestDueAt: string | null;
    incidents: string[];
  }[];
};
const incidentNames = [
  'TERMINAL_WORK_PENDING',
  'EXPIRED_LEASE',
  'OVERDUE_WORK',
  'MONITOR_LIMIT_REACHED',
];
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function integer(value: unknown, maximum = 1000): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}
function count(value: unknown): value is Count {
  return (
    record(value) &&
    integer(value.count) &&
    typeof value.more === 'boolean' &&
    (!value.more || value.count === 1000)
  );
}
export function validBacklog(value: unknown): value is Backlog {
  if (
    !record(value) ||
    typeof value.observedAt !== 'string' ||
    !Number.isFinite(Date.parse(value.observedAt)) ||
    value.limit !== 1000 ||
    value.overdueAfterSeconds !== 900 ||
    typeof value.needsAttention !== 'boolean' ||
    !Array.isArray(value.queues) ||
    value.queues.length !== Object.keys(queueLabels).length
  )
    return false;
  const seen = new Set<string>();
  const observed = Date.parse(value.observedAt);
  return (
    value.queues.every((row) => {
      if (
        !record(row) ||
        typeof row.name !== 'string' ||
        !Object.prototype.hasOwnProperty.call(queueLabels, row.name) ||
        seen.has(row.name) ||
        !count(row.queued) ||
        !count(row.leased) ||
        !count(row.terminal) ||
        !integer(row.retryingObserved) ||
        !integer(row.expiredLeasesObserved) ||
        row.retryingObserved > row.queued.count ||
        row.expiredLeasesObserved > row.leased.count ||
        !(
          row.oldestDueAt === null ||
          (typeof row.oldestDueAt === 'string' &&
            Number.isFinite(Date.parse(row.oldestDueAt)) &&
            Date.parse(row.oldestDueAt) <= observed)
        ) ||
        (row.oldestDueAt !== null && row.queued.count === 0) ||
        !Array.isArray(row.incidents) ||
        new Set(row.incidents).size !== row.incidents.length ||
        row.incidents.some((code) => !incidentNames.includes(code))
      )
        return false;
      const incidents = row.incidents;
      const expected = [];
      if (row.terminal.count) expected.push('TERMINAL_WORK_PENDING');
      if (row.expiredLeasesObserved) expected.push('EXPIRED_LEASE');
      if (row.oldestDueAt !== null && observed - Date.parse(row.oldestDueAt as string) >= 900000)
        expected.push('OVERDUE_WORK');
      if (row.queued.more || row.leased.more || row.terminal.more)
        expected.push('MONITOR_LIMIT_REACHED');
      if (
        expected.length !== row.incidents.length ||
        expected.some((code) => !incidents.includes(code))
      )
        return false;
      seen.add(row.name);
      return true;
    }) && value.needsAttention === value.queues.some((row) => row.incidents.length > 0)
  );
}
export const displayCount = (value: Count) =>
  `${value.more ? '≥' : ''}${value.count.toLocaleString('en')}`;
export const incidentLabels: Record<string, string> = {
  TERMINAL_WORK_PENDING: 'Terminal work',
  EXPIRED_LEASE: 'Expired or missing lease',
  OVERDUE_WORK: 'Due for at least 15 minutes',
  MONITOR_LIMIT_REACHED: 'Observation limit reached',
};
