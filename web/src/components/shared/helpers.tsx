import { statusPresentation, type StatusDomain } from './statusPresentation';

export function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function StatusBadge({
  status,
  domain = 'general',
}: {
  status?: string;
  domain?: StatusDomain;
}) {
  const presentation = statusPresentation(status, domain);
  return <span className={`badge badge-${presentation.tone}`}>{presentation.label}</span>;
}

export function fmtMoney(n?: number, currency = 'EUR', minorUnits = currency === 'JPY' ? 0 : 2) {
  return `${currency} ${Number(n || 0).toLocaleString('en', {
    minimumFractionDigits: minorUnits,
    maximumFractionDigits: minorUnits,
  })}`;
}

export function milePct(m?: string) {
  const order = [
    'requested',
    'accepted',
    'picked_up',
    'warehouse_received',
    'port_received',
    'loaded',
    'departed',
    'arrived',
    'customs_cleared',
    'delivered',
  ];
  const i = order.indexOf(m || '');
  return i < 0 ? 0 : Math.round(((i + 1) / order.length) * 100);
}
