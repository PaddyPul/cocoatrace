export function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function statusBadge(s?: string) {
  const map: Record<string, string> = {
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
    requested: 'amber',
    departed: 'amber',
    none: 'gray',
    suspended: 'amber',
    expired: 'amber',
    disputed: 'red',
    revoked: 'red',
    rejected: 'red',
    cancelled: 'red',
  };
  const cls = map[s || ''] || 'gray';
  return `<span class="badge badge-${cls}">${(s || '').replace(/_/g, ' ')}</span>`;
}

export function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, string> = {
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
    requested: 'amber',
    departed: 'amber',
    none: 'gray',
    suspended: 'amber',
    expired: 'amber',
    disputed: 'red',
    revoked: 'red',
    rejected: 'red',
    cancelled: 'red',
  };
  const cls = map[status || ''] || 'gray';
  return (
    <span className={`badge badge-${cls}`}>
      {(status || '').replace(/_/g, ' ')}
    </span>
  );
}

export function fmtMoney(n?: number, currency = 'EUR') {
  return `${currency} ${(n || 0).toLocaleString('en', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function milePct(m?: string) {
  const order = [
    'requested', 'accepted', 'picked_up', 'warehouse_received',
    'port_received', 'loaded', 'departed', 'arrived',
    'customs_cleared', 'delivered',
  ];
  const i = order.indexOf(m || '');
  return i < 0 ? 0 : Math.round(((i + 1) / order.length) * 100);
}
