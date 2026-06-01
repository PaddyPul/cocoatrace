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
  get: (id: string) => api<{ farm: import('./types').Farm; plots: any[]; certificates: any[] }>('GET', `/farms/${id}`),
  create: (data: { name: string; country?: string; region: string; district: string; community?: string; officialTraceabilityId?: string }) =>
    api<import('./types').Farm>('POST', '/farms', data),
  createPlot: (farmId: string, data: { plotCode: string; areaHectares: number; crops?: string[]; gpsLat?: number; gpsLng?: number; geolocationSource?: string }) =>
    api<any>('POST', `/farms/${farmId}/plots`, data),
};

export const batches = {
  list: () => api<import('./types').Batch[]>('GET', '/batches'),
  get: (id: string) => api<{ batch: import('./types').Batch; evidence: import('./types').Evidence[] }>('GET', `/batches/${id}`),
  create: (data: { farmId: string; plotIds?: string[]; crop?: string; harvestDate: string; quantityKg: number; moisturePercent?: number; grade?: string }) =>
    api<import('./types').Batch>('POST', '/batches', data),
  pushToMarketplace: (id: string, data: { quantityKg: number; pricePerKg: number; currency?: string; incoterm?: string; originLocation: string; destinationLocation: string }) =>
    api<import('./types').Listing>('POST', `/batches/${id}/push-to-marketplace`, data),
  attest: (id: string, data: { certificateId: string; notes?: string }) =>
    api<{ attestation: any; policyChecks: any[] }>('POST', `/batches/${id}/attest`, data),
};

export const listings = {
  list: () => api<import('./types').Listing[]>('GET', '/listings'),
  get: (id: string) => api<import('./types').Listing>('GET', `/listings/${id}`),
};

export const contracts = {
  list: () => api<import('./types').Contract[]>('GET', '/contracts'),
  get: (id: string) => api<any>('GET', `/contracts/${id}`),
  requestShipment: (id: string, data: { logisticsOrganizationId?: string; vesselName?: string; containerReference?: string; originPort?: string; destinationPort?: string; etaArrival?: string }) =>
    api<any>('POST', `/contracts/${id}/shipments`, data),
  requestPayment: (id: string, data: { amountTotal: number; currency?: string }) =>
    api<any>('POST', `/contracts/${id}/payment-requests`, data),
  updateEudr: (id: string, data: { eudrDueDiligenceReference: string }) =>
    api<any>('PATCH', `/contracts/${id}/eudr`, data),
};

export const payments = {
  list: () => api<import('./types').Payment[]>('GET', '/payment-requests'),
  get: (id: string) => api<any>('GET', `/payment-requests/${id}`),
  pay: (id: string, data: { transactionReference: string }) =>
    api<any>('POST', `/payment-requests/${id}/pay`, data),
};

export const shipments = {
  list: () => api<import('./types').Shipment[]>('GET', '/shipments'),
  get: (id: string) => api<{ shipment: import('./types').Shipment; milestones: any[] }>('GET', `/shipments/${id}`),
  accept: (id: string) => api<any>('POST', `/shipments/${id}/accept`),
  recordMilestone: (id: string, data: { milestone: string; location?: string; notes?: string }) =>
    api<any>('POST', `/shipments/${id}/milestones`, data),
};

export const holdings = {
  list: () => api<import('./types').Holding[]>('GET', '/holdings'),
  get: (id: string) => api<{ holding: import('./types').Holding; batch: import('./types').Batch | null }>('GET', `/holdings/${id}`),
  create: (data: { batchId: string; quantityKg: number; warehouseLocation?: string }) =>
    api<import('./types').Holding>('POST', '/holdings', data),
  transfer: (id: string, data: { toOrganizationId: string; quantityKg: number; reason?: string }) =>
    api<any>('POST', `/holdings/${id}/transfer`, data),
  listTransfers: () => api<any[]>('GET', '/transfers'),
  acceptTransfer: (id: string) => api<any>('POST', `/transfers/${id}/accept`),
};

export const evidence = {
  list: () => api<import('./types').Evidence[]>('GET', '/evidence'),
  upload: (file: File, data: { type?: string; linkedEntityType: string; linkedEntityId: string; claimDescription?: string }) => {
    const fd = new FormData();
    fd.append('file', file);
    if (data.type) fd.append('type', data.type);
    fd.append('linkedEntityType', data.linkedEntityType);
    fd.append('linkedEntityId', data.linkedEntityId);
    if (data.claimDescription) fd.append('claimDescription', data.claimDescription);
    return api<any>('POST', '/evidence', fd, true);
  },
};

export const organizations = {
  list: () => api<any[]>('GET', '/organizations'),
  members: (id: string) => api<any[]>('GET', `/organizations/${id}/members`),
};

export const audit = {
  list: () => api<import('./types').AuditEvent[]>('GET', '/audit/events'),
  export: () => `${API_BASE}/audit/export`,
};

export const offers = {
  list: () => api<import('./types').Offer[]>('GET', '/offers'),
  create: (listingId: string, data: { quantityKg: number; offeredPricePerKg: number; currency?: string; validUntil?: string }) =>
    api('POST', `/listings/${listingId}/offers`, data),
  accept: (offerId: string) => api<any>('POST', `/offers/${offerId}/accept`),
  reject: (offerId: string) => api<any>('POST', `/offers/${offerId}/reject`),
};

export const certificates = {
  list: (farmId?: string) => api<import('./types').Certificate[]>('GET', `/certificates${farmId ? `?farmId=${farmId}` : ''}`),
  get: (id: string) => api<import('./types').Certificate>('GET', `/certificates/${id}`),
  issue: (data: { farmerOrganizationId: string; farmId: string; standard: string; cropScope: string[]; validFrom: string; validTo: string; issuingAuthority: string; accreditationReference: string }) =>
    api<import('./types').Certificate>('POST', '/certificates', data),
  updateStatus: (id: string, action: string, data?: { reason?: string }) =>
    api<any>('POST', `/certificates/${id}/${action}`, data),
};

export const provenance = {
  get: (batchId: string) => api<import('./types').ProvenancePack>('GET', `/provenance/batches/${batchId}`),
  exportBatch: (batchId: string) => {
    const url = `${API_BASE}/provenance/batches/${batchId}/export?format=json`;
    window.open(url, '_blank');
  },
};
