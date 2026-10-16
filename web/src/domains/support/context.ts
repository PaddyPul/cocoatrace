const contexts: Record<string, string> = {
  home: 'home',
  dashboard: 'home',
  marketplace: 'marketplace',
  listing: 'marketplace',
  'source-new': 'marketplace',
  'supply-new': 'supply',
  holdings: 'supply',
  farms: 'supply',
  batches: 'supply',
  offers: 'offers',
  contracts: 'agreement',
  contract: 'agreement',
  'deal-room': 'agreement',
  shipments: 'shipment',
  shipment: 'shipment',
  payments: 'payment',
  payment: 'payment',
  evidence: 'evidence',
  certs: 'evidence',
  recalls: 'recall',
  account: 'account',
  security: 'account',
  pilot: 'account',
};
/** Copy only a reviewed workflow label and an optional UUID, never URLs/query/token text. */
export function supportLink(page: string, pathname: string): string {
  const context = contexts[page] || 'other';
  const match =
    /^\/(?:listing|contracts|shipments|payments|deals)\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.exec(
      pathname,
    );
  return `/support?${new URLSearchParams({ context, ...(match ? { entityId: match[1] } : {}) })}`;
}
