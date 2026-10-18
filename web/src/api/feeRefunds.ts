import { api } from './http';

export interface FeeRefundState {
  expectedFingerprint: string;
  eligible: boolean;
  blockedReason: string | null;
  canRequest: boolean;
  canSend: boolean;
  canConfirm: boolean;
  canReject: boolean;
  refund: null | {
    id: string;
    status: 'requested' | 'sent' | 'confirmed' | 'rejected';
    reason: string;
    amount: string;
    currency: string;
    revision: number;
    externalReference?: string | null;
  };
  history: { id: string; action: string; reason: string; created_at: string }[];
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid fee refund response. Refresh to retry.');
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid fee refund response. Refresh to retry.');
  return value;
}
function parseState(value: unknown): FeeRefundState {
  const data = object(value);
  const invalid = () => {
    throw new Error('Invalid fee refund response. Refresh to retry.');
  };
  const fingerprint = text(data.expectedFingerprint);
  if (!/^[a-f0-9]{64}$/.test(fingerprint)) invalid();
  const boolean = (key: string): boolean => {
    if (typeof data[key] !== 'boolean') return invalid();
    return data[key] as boolean;
  };
  const blockedReason = data.blockedReason === null ? null : text(data.blockedReason);
  let refund: FeeRefundState['refund'] = null;
  if (data.refund !== null) {
    const item = object(data.refund);
    const status = text(item.status);
    if (!['requested', 'sent', 'confirmed', 'rejected'].includes(status)) invalid();
    if (!Number.isSafeInteger(item.revision) || Number(item.revision) < 0) invalid();
    const amount = text(item.amount),
      currency = text(item.currency);
    if (!/^\d+(?:\.\d+)?$/.test(amount) || !/^[A-Z]{3}$/.test(currency)) invalid();
    refund = {
      id: text(item.id),
      status: status as NonNullable<FeeRefundState['refund']>['status'],
      reason: text(item.reason),
      amount,
      currency,
      revision: item.revision as number,
    };
    if (item.externalReference !== undefined)
      refund.externalReference =
        item.externalReference === null ? null : text(item.externalReference);
  }
  if (!Array.isArray(data.history)) return invalid();
  const history = data.history.map((value) => {
    const event = object(value);
    const created_at = text(event.created_at);
    if (!Number.isFinite(Date.parse(created_at))) invalid();
    return {
      id: text(event.id),
      action: text(event.action),
      reason: text(event.reason),
      created_at,
    };
  });
  return {
    expectedFingerprint: fingerprint,
    eligible: boolean('eligible'),
    blockedReason,
    canRequest: boolean('canRequest'),
    canSend: boolean('canSend'),
    canConfirm: boolean('canConfirm'),
    canReject: boolean('canReject'),
    refund,
    history,
  };
}
const path = (id: string) => `/contracts/${id}/fee/refund`;
async function request(method: string, url: string, body?: unknown): Promise<FeeRefundState> {
  return parseState(await api<unknown>(method, url, body));
}
export const feeRefunds = {
  read: (id: string) => request('GET', path(id)),
  request: (id: string, reason: string, idempotencyKey: string, expectedFingerprint: string) =>
    request('POST', `${path(id)}/request`, {
      reason,
      idempotencyKey,
      expectedFingerprint,
    }),
  send: (
    id: string,
    body: {
      refundId: string;
      expectedRevision: number;
      amount: string;
      currency: string;
      reference: string;
      reason: string;
    },
  ) => request('POST', `${path(id)}/send`, body),
  decide: (
    id: string,
    action: 'confirm' | 'reject',
    refundId: string,
    expectedRevision: number,
    reason: string,
  ) => request('POST', `${path(id)}/${action}`, { refundId, expectedRevision, reason }),
};
