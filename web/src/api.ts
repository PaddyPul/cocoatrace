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
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const auth = {
  login: (email: string, password: string) =>
    api<{ accessToken: string; user: any }>('POST', '/auth/login', { email, password }),
};

export const farms = {
  list: () => api<import('./types').Farm[]>('GET', '/farms'),
};

export const batches = {
  list: () => api<import('./types').Batch[]>('GET', '/batches'),
};

export const listings = {
  list: () => api<import('./types').Listing[]>('GET', '/listings'),
  get: (id: string) => api<import('./types').Listing>('GET', `/listings/${id}`),
};

export const contracts = {
  list: () => api<import('./types').Contract[]>('GET', '/contracts'),
};

export const shipments = {
  list: () => api<import('./types').Shipment[]>('GET', '/shipments'),
};

export const holdings = {
  list: () => api<import('./types').Holding[]>('GET', '/holdings'),
};

export const payments = {
  list: () => api<import('./types').Payment[]>('GET', '/payment-requests'),
};

export const evidence = {
  list: () => api<import('./types').Evidence[]>('GET', '/evidence'),
};

export const audit = {
  list: () => api<import('./types').AuditEvent[]>('GET', '/audit/events'),
};

export const offers = {
  list: () => api<import('./types').Offer[]>('GET', '/offers'),
  create: (data: any) => api('POST', '/offers', data),
};

export const provenance = {
  get: (batchId: string) => api<import('./types').ProvenancePack>('GET', `/provenance/${batchId}`),
};
