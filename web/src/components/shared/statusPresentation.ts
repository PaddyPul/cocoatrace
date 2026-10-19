export type StatusDomain = 'general' | 'trade' | 'payment' | 'terms' | 'transport';
export type StatusTone = 'green' | 'amber' | 'red' | 'gray';

const general: Record<string, StatusTone> = {
  attested: 'green',
  active: 'green',
  verified: 'green',
  approved: 'green',
  delivered: 'green',
  settled: 'green',
  accepted: 'green',
  pending: 'amber',
  pending_attestation: 'amber',
  in_transit: 'amber',
  awaiting_shipment: 'amber',
  fulfilment_in_progress: 'amber',
  awaiting_documents: 'amber',
  payment_received: 'amber',
  requested: 'amber',
  planning: 'amber',
  booked: 'amber',
  cargo_ready: 'amber',
  handed_over: 'amber',
  loaded: 'amber',
  arrived: 'amber',
  customs_cleared: 'amber',
  departed: 'amber',
  none: 'gray',
  suspended: 'amber',
  expired: 'amber',
  disputed: 'red',
  revoked: 'red',
  rejected: 'red',
  cancelled: 'red',
};

const domains: Record<Exclude<StatusDomain, 'general'>, Record<string, StatusTone>> = {
  trade: {
    accepted: 'amber',
    awaiting_documents: 'amber',
    awaiting_payment: 'amber',
    payment_received: 'amber',
    awaiting_shipment: 'amber',
    fulfilment_in_progress: 'amber',
    in_transit: 'amber',
    delivered: 'amber',
    settled: 'green',
    cancelled: 'red',
    disputed: 'red',
  },
  payment: {
    requested: 'amber',
    pending: 'amber',
    awaiting_trigger: 'gray',
    due: 'amber',
    payment_submitted: 'amber',
    partially_paid: 'amber',
    paid: 'green',
    settled: 'green',
    rejected: 'red',
    disputed: 'red',
    cancelled: 'red',
    failed: 'red',
  },
  terms: { draft: 'gray', proposed: 'amber', agreed: 'green', rejected: 'red' },
  transport: {
    planning: 'amber',
    booked: 'amber',
    requested: 'amber',
    accepted: 'amber',
    cargo_ready: 'amber',
    export_cleared: 'amber',
    picked_up: 'amber',
    warehouse_received: 'amber',
    handed_over: 'amber',
    port_received: 'amber',
    loaded: 'amber',
    departed: 'amber',
    arrived: 'amber',
    customs_cleared: 'amber',
    unloaded: 'amber',
    in_transit: 'amber',
    delivered: 'green',
    cancelled: 'red',
  },
};

// Domain matters: accepting transport or receiving goods does not settle a trade.
export function statusPresentation(status?: string | null, domain: StatusDomain = 'general') {
  const value = status?.trim() || '';
  const tone = (domain === 'general' ? general : domains[domain])[value] || 'gray';
  return { label: value ? value.replace(/_/g, ' ') : 'Unknown', tone };
}

// Next actions are server-owned workflow observations, not payment or transport receipts.
export function tradeActionPresentation(action: {
  id: string;
  kind: string;
  requiresAction: boolean;
}) {
  if (action.kind === 'complete') {
    const cancelled = action.id.endsWith(':cancelled');
    return {
      label: cancelled ? 'Cancelled' : 'Completed',
      tone: cancelled ? ('red' as const) : ('green' as const),
    };
  }
  return { label: action.requiresAction ? 'Your action' : 'In progress', tone: 'amber' as const };
}
