const API_BASE = '/api';

let token: string | null = localStorage.getItem('ct_token');

export function setAuthToken(t: string | null) {
  token = t;
  if (t) localStorage.setItem('ct_token', t);
  else localStorage.removeItem('ct_token');
}

export function getToken() { return token; }

export async function api<T = any>(
  method: string,
  path: string,
  body?: any,
  isForm = false,
): Promise<T> {
  const opts: RequestInit = {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  };
  if (body && !isForm) {
    (opts.headers as Record<string, string>)['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  } else if (body && isForm) {
    opts.body = body;
  }
  const res = await fetch(API_BASE + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.details ? `${data.error}: ${data.details.map((d: any) => d.message).join('; ')}` : (data.error || `HTTP ${res.status}`);
    throw new Error(msg);
  }
  return data;
}

export const auth = {
  login: (email: string, password: string) =>
    api<{ accessToken: string; user: any }>('POST', '/auth/login', { email, password }),
};

export const farms = {
  list: () => api<import('./types').Farm[]>('GET', '/farms'),
  create: (data: { name: string; country?: string; region: string; district: string; community?: string; officialTraceabilityId?: string }) =>
    api<import('./types').Farm>('POST', '/farms', data),
};

export const batches = {
  list: () => api<import('./types').Batch[]>('GET', '/batches'),
  create: (data: { farmId: string; plotIds?: string[]; crop?: string; harvestDate: string; quantityKg: number; moisturePercent?: number; grade?: string }) =>
    api<import('./types').Batch>('POST', '/batches', data),
  pushToMarketplace: (id: string, data: { quantityKg: number; pricePerKg: number; currency?: string; incoterm?: string; originLocation: string; destinationLocation: string }) =>
    api<import('./types').Listing>('POST', `/batches/${id}/push-to-marketplace`, data),
};

export const listings = {
  list: () => api<import('./types').Listing[]>('GET', '/listings'),
  get: (id: string) => api<import('./types').Listing>('GET', `/listings/${id}`),
};

export const contracts = {
  list: () => api<import('./types').Contract[]>('GET', '/contracts'),
  get: (id: string) => api<any>('GET', `/contracts/${id}`),
};

export const shipments = {
  list: () => api<import('./types').Shipment[]>('GET', '/shipments'),
  get: (id: string) => api<{ shipment: import('./types').Shipment; milestones: any[] }>('GET', `/shipments/${id}`),
};

export const holdings = {
  list: () => api<import('./types').Holding[]>('GET', '/holdings'),
};

export const payments = {
  list: () => api<import('./types').Payment[]>('GET', '/payment-requests'),
  get: (id: string) => api<any>('GET', `/payment-requests/${id}`),
};

export const evidence = {
  list: () => api<import('./types').Evidence[]>('GET', '/evidence'),
};

export const audit = {
  list: () => api<import('./types').AuditEvent[]>('GET', '/audit/events'),
};

export const offers = {
  list: () => api<import('./types').Offer[]>('GET', '/offers'),
  create: (listingId: string, data: { quantityKg: number; offeredPricePerKg: number; currency?: string; validUntil?: string }) =>
    api('POST', `/listings/${listingId}/offers`, data),
};

export const provenance = {
  get: (batchId: string) => api<import('./types').ProvenancePack>('GET', `/provenance/batches/${batchId}`),
};
