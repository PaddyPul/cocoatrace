import { api } from './http';
import type { CatalogPage } from './http';

export interface FeeStatement {
  refundSupported?: boolean;
  statementDeliverySupported?: boolean;
  statementNumber: string;
  taxNotice: string;
  documentType: string;
  fee: {
    created_at?: string;
    invoiced_at?: string | null;
    latest_submission_at?: string | null;
    pending_submission_count?: number;
    refund_status?: 'requested' | 'sent' | 'confirmed' | 'rejected' | null;
    receipt_verified: boolean;
    amount_matches: boolean;
    payer_matches: boolean;
    id: string;
    contract_id: string;
    status: string;
    amount_total: string;
    currency: string;
    currency_minor_units: number;
    rate_bps: number;
    fee_payer: string;
    payer_organization_id: string | null;
    policy_version: string;
    due_at: string | null;
    paid_at: string | null;
    seller_name: string;
    buyer_name: string;
    contract_status: string;
  };
  submissions: { id: string; status: string; reference: string; rejection_reason: string | null }[];
}

export interface FeeReconciliation {
  confirmedRefundTotals?: {
    currency: string;
    currency_minor_units: number;
    count: number;
    amount_total: string;
  }[];
  netCollectedTotals?: { currency: string; currency_minor_units: number; amount_total: string }[];
  ok: boolean;
  issues: { code: string; fee_id: string | null; contract_id: string }[];
  totals: {
    currency: string;
    currency_minor_units: number;
    status: string;
    count: number;
    amount_total: string;
  }[];
  limitations: string[];
}

export const platformFees = {
  page: async (parameters: Record<string, string> = {}) => {
    const value = await api<CatalogPage<FeeStatement['fee']>>(
      'GET',
      `/platform-fees?${new URLSearchParams({ view: 'page', ...parameters })}`,
    );
    if (
      !value ||
      typeof value.hasMore !== 'boolean' ||
      (value.hasMore
        ? typeof value.nextCursor !== 'string' || !value.nextCursor
        : value.nextCursor !== null) ||
      !Array.isArray(value.items) ||
      value.items.some(
        (fee) =>
          !fee ||
          typeof fee.id !== 'string' ||
          typeof fee.contract_id !== 'string' ||
          typeof fee.status !== 'string' ||
          typeof fee.currency !== 'string' ||
          !Number.isFinite(Number(fee.amount_total)) ||
          !Number.isInteger(fee.pending_submission_count) ||
          Number(fee.pending_submission_count) < 0,
      )
    )
      throw new Error('Invalid fee register response. Refresh to retry.');
    return value;
  },
  list: () => api<FeeStatement['fee'][]>('GET', '/platform-fees'),
  statement: (id: string) => api<FeeStatement>('GET', `/contracts/${id}/fee`),
  download: (id: string) => api<FeeStatement>('GET', `/contracts/${id}/fee/statement`),
  submit: (id: string, reference: string) =>
    api('POST', `/contracts/${id}/fee/submit`, { reference }),
  verify: (
    id: string,
    submissionId: string,
    amount: string,
    currency: string,
    receiptReference: string,
  ) =>
    api('POST', `/contracts/${id}/fee/submissions/${submissionId}/review`, {
      decision: 'verify',
      amount,
      currency,
      receiptReference,
    }),
  reject: (id: string, submissionId: string, reason: string) =>
    api('POST', `/contracts/${id}/fee/submissions/${submissionId}/review`, {
      decision: 'reject',
      reason,
    }),
  writeOff: (id: string, reason: string) =>
    api('POST', `/contracts/${id}/fee/write-off`, { reason }),
  reconcile: () => api<FeeReconciliation>('GET', '/platform-fees/reconciliation'),
};
