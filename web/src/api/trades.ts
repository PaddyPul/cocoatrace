import { api } from './http';
import type { CatalogPage } from './http';

export interface CancellationState {
  contractStatus: string;
  blockedReason: string | null;
  requests: {
    id: string;
    requested_by_organization_id: string;
    status: 'requested' | 'approved' | 'rejected';
    reason: string;
  }[];
}

export interface ContractSummary {
  count: number;
  active_count: number;
  settled_count: number;
  cancelled_count: number;
  latest_active_id: string | null;
}

export const contracts = {
  page: (parameters: Record<string, string> = {}) =>
    api<CatalogPage<import('../types').Contract>>(
      'GET',
      `/contracts/page?${new URLSearchParams({ limit: '50', ...parameters })}`,
    ),
  summary: () => api<ContractSummary>('GET', '/contracts/summary'),
  cancellation: (id: string) => api<CancellationState>('GET', `/contracts/${id}/cancellation`),
  requestCancellation: (id: string, reason: string) =>
    api('POST', `/contracts/${id}/cancellation`, { reason }),
  reviewCancellation: (id: string, requestId: string, approve: boolean) =>
    api('POST', `/contracts/${id}/cancellation/${requestId}/${approve ? 'approve' : 'reject'}`, {}),
  delivery: (id: string) => api<any>('GET', `/contracts/${id}/delivery`),
  acceptDelivery: (id: string, data: { receivedQuantityKg: number; note: string }) =>
    api<any>('POST', `/contracts/${id}/delivery/accept`, data),
  reportDiscrepancy: (
    id: string,
    data: { kind: string; receivedQuantityKg: number; reason: string; evidenceIds: string[] },
  ) => api<any>('POST', `/contracts/${id}/delivery/discrepancy`, data),
  proposeDeliveryResolution: (id: string, note: string) =>
    api<any>('POST', `/contracts/${id}/delivery/resolution`, { note }),
  approveDeliveryResolution: (id: string) =>
    api<any>('POST', `/contracts/${id}/delivery/resolution/approve`, {}),
  list: () => api<import('../types').Contract[]>('GET', '/contracts'),
  get: (id: string) => api<any>('GET', `/contracts/${id}`),
  requestPayment: (id: string, data: { amountTotal: number; currency?: string }) =>
    api<any>('POST', `/contracts/${id}/payment-requests`, data),
  updateEudr: (id: string, data: { eudrDueDiligenceReference: string }) =>
    api<any>('PATCH', `/contracts/${id}/eudr`, data),
  updateCompliance: (id: string, data: { scheme: string; reference: string }) =>
    api<any>('PATCH', `/contracts/${id}/compliance`, data),
  updatePaymentTerms: (
    id: string,
    data: {
      paymentPlan: string;
      depositPercentage?: number;
      creditDays?: number;
      note?: string;
      paymentEvidenceRequired?: boolean;
    },
  ) => api<any>('PATCH', `/contracts/${id}/payment-terms`, data),
  confirmPaymentTerms: (id: string) => api<any>('POST', `/contracts/${id}/payment-terms/confirm`),
};

export type PaymentIssueType = 'payment_dispute' | 'reference_correction' | 'receipt_reversal';

export interface PaymentOperationIssue {
  id: string;
  issue_type: PaymentIssueType;
  status: string;
  installment_id: string | null;
  reason: string;
  proposed_reference: string | null;
  resolution_note: string | null;
  resolution_proposed_by_organization_id: string | null;
  created_at: string;
}

export interface PaymentOperationsData {
  timeline: Array<{
    id: string;
    action: string;
    occurred_at: string;
    metadata: Record<string, unknown>;
    actor_name: string | null;
  }>;
  issues: PaymentOperationIssue[];
  installments: Array<{
    id: string;
    installment_type: string;
    status: string;
    due_at: string | null;
    dueState: string;
    amount_due: string | number;
  }>;
  reminders: Array<{
    id: string;
    created_at: string;
    installment_id?: string;
    message?: string;
    email_recipient_count?: number;
    email_sent_count?: number;
    email_failed_count?: number;
    email_suppressed_count?: number;
    email_pending_count?: number;
  }>;
}

export interface PaymentSummary {
  count: number;
  open_count: number;
  settled_count: number;
  cancelled_count: number;
}

export const payments = {
  page: (parameters: Record<string, string> = {}) =>
    api<CatalogPage<import('../types').Payment>>(
      'GET',
      `/payment-requests/page?${new URLSearchParams({ limit: '50', ...parameters })}`,
    ),
  summary: () => api<PaymentSummary>('GET', '/payment-requests/summary'),
  list: () => api<import('../types').Payment[]>('GET', '/payment-requests'),
  get: (id: string) => api<any>('GET', `/payment-requests/${id}`),
  pay: (id: string, data: { transactionReference: string }) =>
    api<any>('POST', `/payment-requests/${id}/pay`, data),
  submitDocuments: (id: string) => api<any>('POST', `/payment-requests/${id}/submit-documents`),
  submitInstallment: (id: string, transactionReference: string, evidenceId?: string) =>
    api<any>('POST', `/payment-installments/${id}/submit`, { transactionReference, evidenceId }),
  confirmInstallment: (id: string) => api<any>('POST', `/payment-installments/${id}/confirm`),
  rejectInstallment: (id: string, reason: string) =>
    api<any>('POST', `/payment-installments/${id}/reject`, { reason }),
  submitSecurity: (id: string, provider: string, reference: string) =>
    api<any>('POST', `/payment-requests/${id}/security`, { provider, reference }),
  confirmSecurity: (id: string) => api<any>('POST', `/payment-requests/${id}/security/confirm`),
  operations: (id: string) =>
    api<PaymentOperationsData>('GET', `/payment-requests/${id}/operations`),
  remind: (id: string) => api<{ created: number }>('POST', `/payment-requests/${id}/remind`, {}),
  raiseIssue: (
    id: string,
    data: {
      issueType: PaymentIssueType;
      installmentId?: string;
      reason: string;
      proposedReference?: string;
    },
  ) => api<PaymentOperationIssue>('POST', `/payment-requests/${id}/issues`, data),
  proposeIssueResolution: (id: string, note: string) =>
    api<PaymentOperationIssue>('POST', `/payment-issues/${id}/propose-resolution`, { note }),
  approveIssueResolution: (id: string) =>
    api<PaymentOperationIssue>('POST', `/payment-issues/${id}/approve-resolution`, {}),
};

export interface ShipmentSummary {
  count: number;
  active_count: number;
  delivered_count: number;
  cancelled_count: number;
}

export const shipments = {
  page: (parameters: Record<string, string> = {}) =>
    api<CatalogPage<import('../types').Shipment>>(
      'GET',
      `/shipments/page?${new URLSearchParams({ limit: '50', ...parameters })}`,
    ),
  summary: () => api<ShipmentSummary>('GET', '/shipments/summary'),
  list: () => api<import('../types').Shipment[]>('GET', '/shipments'),
  get: (id: string) =>
    api<{
      shipment: import('../types').Shipment;
      milestones: any[];
      permissions: {
        canArrange: boolean;
        supported: boolean;
        milestones: string[];
        responsibilities: Record<string, string | null>;
      };
    }>('GET', `/shipments/${id}`),
  updateDetails: (
    id: string,
    data: {
      serviceProviderName?: string;
      bookingReference?: string;
      transportMode?: string;
      transportDocumentType?: string;
      transportDocumentReference?: string;
      trackingUrl?: string;
      vesselName?: string;
      containerReference?: string;
      originLocation?: string;
      destinationLocation?: string;
      etaArrival?: string;
    },
  ) => api<any>('PATCH', `/shipments/${id}/details`, data),
  recordMilestone: (
    id: string,
    data: {
      milestone: string;
      location?: string;
      notes?: string;
      exceptionalDispatch?: { reason: string; acknowledgePaymentRisk: true };
    },
  ) => api<any>('POST', `/shipments/${id}/milestones`, data),
};
