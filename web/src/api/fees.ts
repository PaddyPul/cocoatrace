import { api } from './http';

export interface FeeStatement {
  statementNumber: string;
  taxNotice: string;
  documentType: string;
  fee: {
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
