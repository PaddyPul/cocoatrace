import { api } from './http';
export interface FeeStatementDeliveryState {
  queued: number;
  sending: number;
  sent: number;
  suppressed: number;
  failed: number;
  failed_terminal: number;
  missingContact: boolean;
}
const keys = ['queued', 'sending', 'sent', 'suppressed', 'failed', 'failed_terminal'] as const;
function parse(value: unknown): FeeStatementDeliveryState {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid statement delivery response. Refresh to retry.');
  const row = value as Record<string, unknown>;
  if (
    typeof row.missingContact !== 'boolean' ||
    keys.some((key) => !Number.isSafeInteger(row[key]) || Number(row[key]) < 0)
  )
    throw new Error('Invalid statement delivery response. Refresh to retry.');
  return {
    queued: row.queued as number,
    sending: row.sending as number,
    sent: row.sent as number,
    suppressed: row.suppressed as number,
    failed: row.failed as number,
    failed_terminal: row.failed_terminal as number,
    missingContact: row.missingContact,
  };
}
async function request(method: string, id: string) {
  return parse(await api<unknown>(method, `/contracts/${id}/fee/statement-delivery`));
}
export const feeStatementDelivery = {
  read: (id: string) => request('GET', id),
  request: (id: string) => request('POST', id),
};
