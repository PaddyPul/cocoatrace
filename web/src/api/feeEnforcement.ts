import { api } from './http';

export type FeeEnforcementState = {
  enforced: boolean;
  terms: string;
  policy_version?: string;
  expectedFingerprint?: string;
  terms_accepted_at?: string | null;
  credit_until?: string | null;
  credit_revision?: number;
  credit_active?: boolean;
  amount_total?: string;
  currency?: string;
  status?: string;
  payer_organization_id?: string | null;
  receipt_verified?: boolean;
};
export const feeEnforcement = {
  read: async (id: string): Promise<FeeEnforcementState> => {
    const value = await api<FeeEnforcementState>(
      'GET',
      `/contracts/${encodeURIComponent(id)}/fee/enforcement`,
    );
    if (
      !value ||
      typeof value.enforced !== 'boolean' ||
      typeof value.terms !== 'string' ||
      (value.enforced &&
        (typeof value.expectedFingerprint !== 'string' ||
          !/^[a-f0-9]{64}$/.test(value.expectedFingerprint) ||
          value.policy_version !== 'seller-predispatch-v3' ||
          typeof value.amount_total !== 'string' ||
          typeof value.currency !== 'string' ||
          !Number.isInteger(value.credit_revision)))
    ) {
      throw new Error('Fee collection terms could not be read safely.');
    }
    return value;
  },
  accept: (id: string, policyVersion: string, expectedFingerprint: string) =>
    api('POST', `/contracts/${encodeURIComponent(id)}/fee/terms`, {
      policyVersion,
      accepted: true,
      expectedFingerprint,
    }),
  credit: (id: string, reason: string, expectedRevision: number, creditUntil: string | null) =>
    api('POST', `/contracts/${encodeURIComponent(id)}/fee/credit`, {
      reason,
      expectedRevision,
      creditUntil,
    }),
};
