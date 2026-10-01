const API_BASE = '/api';

let token: string | null = null;

export function setAuthToken(t: string | null) {
  token = t;
  localStorage.removeItem('ct_token');
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
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  };
  if (body && !isForm) {
    (opts.headers as Record<string, string>)['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  } else if (body && isForm) {
    opts.body = body;
  }
  const res = await fetch(API_BASE + path, opts);
  if (res.status === 401) {
    token = null;
    localStorage.removeItem('ct_token');
    localStorage.removeItem('ct_user');
    window.location.href = '/login';
    throw new Error('Session expired');
  }
  let data: any = {};
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) {
    const msg = data?.details ? `${data.error}: ${data.details.map((d: any) => d.message).join('; ')}` : (data?.error || `HTTP ${res.status}`);
    throw new Error(msg);
  }
  return data;
}

export const auth = {
  login: (email: string, password: string) =>
    api<{ accessToken: string; user: any }>('POST', '/auth/login', { email, password }),
  me: () => api<any>('GET', '/me'),
  logout: () => api<void>('POST', '/auth/logout'),
  requestAccess: (data: {
    organizationName: string;
    organizationType: 'buyer' | 'supplier';
    jurisdiction: string;
    legalRegistrationNumber?: string;
    adminName: string;
    adminEmail: string;
  }) => api<{ application: AccessApplication; verificationUrl?: string }>('POST', '/auth/request-access', data),
  verifyAccessRequest: (verificationToken: string) =>
    api<{ id: string; status: 'pending_review'; emailVerifiedAt: string }>('POST', '/auth/request-access/verify', { token: verificationToken }),
  forgotPassword: (email: string) =>
    api<{ message: string }>('POST', '/auth/password/forgot', { email }),
  resetPassword: (resetToken: string, password: string) =>
    api<void>('POST', '/auth/password/reset', { token: resetToken, password }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api<void>('POST', '/auth/password/change', { currentPassword, newPassword }),
  invitation: (token: string) => api<any>('GET', `/auth/invitations/${token}`),
  acceptInvitation: (token: string, data: { name: string; password: string }) => api<any>('POST', `/auth/invitations/${token}/accept`, data),
};

export interface AccessApplication {
  id: string;
  status: 'pending_email_verification' | 'pending_review' | 'approved' | 'rejected' | string;
  organizationName: string;
  organizationType: 'buyer' | 'supplier';
  jurisdiction: string;
  legalRegistrationNumber?: string | null;
  adminName: string;
  adminEmail: string;
  verificationExpiresAt?: string | null;
  emailVerifiedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  reviewReason?: string | null;
  reviewedAt?: string | null;
  reviewedByUserId?: string | null;
  approvedOrganizationId?: string | null;
  firstAdminInvitationId?: string | null;
}

export const accessApplications = {
  list: () => api<AccessApplication[]>('GET', '/access-applications'),
  get: (id: string) => api<AccessApplication>('GET', `/access-applications/${id}`),
  approve: (id: string, reason?: string) =>
    api<{ application: AccessApplication; organizationId: string; invitationId: string; invitationExpiresAt: string; inviteUrl?: string }>('POST', `/access-applications/${id}/approve`, reason ? { reason } : {}),
  reject: (id: string, reason?: string) =>
    api<AccessApplication>('POST', `/access-applications/${id}/reject`, reason ? { reason } : {}),
};

export const invitations = {
  list: () => api<any[]>('GET', '/invitations'),
  create: (data: { email: string; organizationId?: string; role?: string }) => api<any>('POST', '/invitations', data),
  resend: (id: string) => api<any>('POST', `/invitations/${id}/resend`),
  revoke: (id: string) => api<void>('POST', `/invitations/${id}/revoke`),
};

export const workspace = {
  getOnboarding: () => api<import('./types').OnboardingState>('GET', '/onboarding'),
  updateOnboarding: (data: { status: 'not_started' | 'in_progress' | 'completed'; currentStep: number; primaryGoal?: string; pilotMode: boolean }) =>
    api<import('./types').OnboardingState>('PUT', '/onboarding', data),
  sendFeedback: (data: { page: string; task: string; rating: number; comment: string }) =>
    api<any>('POST', '/pilot-feedback', data),
  tradeActions: () => api<any[]>('GET', '/trade-actions'),
  listFeedback: () => api<any[]>('GET', '/pilot-feedback'),
};

export const readiness = {
  get: () => api<any>('GET', '/readiness'),
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
  createDirectInventory: (data: { commodity: string; quantityKg: number; inventoryDate: string; sourceName?: string; sourceCountry: string; sourceRegion?: string; warehouseLocation?: string; moisturePercent?: number; grade?: string }) =>
    api<import('./types').Batch>('POST', '/inventory/direct', data),
  pushToMarketplace: (id: string, data: { quantityKg: number; pricePerKg: number; currency?: string; incoterm?: string; originLocation: string; destinationLocation: string }) =>
    api<import('./types').Listing>('POST', `/batches/${id}/push-to-marketplace`, data),
  attest: (id: string, data: { certificateId: string; notes?: string }) =>
    api<{ attestation: any; policyChecks: any[] }>('POST', `/batches/${id}/attest`, data),
};

export const listings = {
  list: () => api<import('./types').Listing[]>('GET', '/listings'),
  get: (id: string) => api<import('./types').Listing>('GET', `/listings/${id}`),
  create: (data: { holdingId: string; availableQuantityKg: number; pricePerKg: number; currency?: string; incoterm?: string; originLocation: string; destinationLocation: string }) =>
    api<import('./types').Listing>('POST', '/listings', data),
};

export const sourcing = {
  list: () => api<import('./types').SourcingRequest[]>('GET', '/sourcing-requests'),
  structure: (brief: string) => api<import('./types').StructuredSourcingBrief>('POST', '/sourcing-requests/structure', { brief }),
  create: (data: {
    title: string; commodity: string; quantityKg: number; originCountries?: string[];
    qualityRequirements?: Record<string, unknown>; assuranceRequirements?: Record<string, unknown>;
    deliveryLocation: string; incoterm?: string; requiredBy?: string; offerDeadline?: string;
    visibility?: 'matched' | 'invited' | 'private'; status?: 'draft' | 'open';
  }) => api<import('./types').SourcingRequest>('POST', '/sourcing-requests', data),
  update: (id: string, data: { status?: string; title?: string; offerDeadline?: string }) =>
    api<import('./types').SourcingRequest>('PATCH', `/sourcing-requests/${id}`, data),
};

export const contracts = {
  list: () => api<import('./types').Contract[]>('GET', '/contracts'),
  get: (id: string) => api<any>('GET', `/contracts/${id}`),
  requestPayment: (id: string, data: { amountTotal: number; currency?: string }) =>
    api<any>('POST', `/contracts/${id}/payment-requests`, data),
  updateEudr: (id: string, data: { eudrDueDiligenceReference: string }) =>
    api<any>('PATCH', `/contracts/${id}/eudr`, data),
  updateCompliance: (id: string, data: { scheme: string; reference: string }) =>
    api<any>('PATCH', `/contracts/${id}/compliance`, data),
  updatePaymentTerms: (id: string, data: { paymentPlan: string; depositPercentage?: number; creditDays?: number; note?: string }) =>
    api<any>('PATCH', `/contracts/${id}/payment-terms`, data),
  confirmPaymentTerms: (id: string) => api<any>('POST', `/contracts/${id}/payment-terms/confirm`),
};

export const payments = {
  list: () => api<import('./types').Payment[]>('GET', '/payment-requests'),
  get: (id: string) => api<any>('GET', `/payment-requests/${id}`),
  pay: (id: string, data: { transactionReference: string }) =>
    api<any>('POST', `/payment-requests/${id}/pay`, data),
  submitDocuments: (id: string) => api<any>('POST', `/payment-requests/${id}/submit-documents`),
  submitInstallment: (id: string, transactionReference: string) => api<any>('POST', `/payment-installments/${id}/submit`, { transactionReference }),
  confirmInstallment: (id: string) => api<any>('POST', `/payment-installments/${id}/confirm`),
  rejectInstallment: (id: string, reason: string) => api<any>('POST', `/payment-installments/${id}/reject`, { reason }),
  submitSecurity: (id: string, provider: string, reference: string) => api<any>('POST', `/payment-requests/${id}/security`, { provider, reference }),
  confirmSecurity: (id: string) => api<any>('POST', `/payment-requests/${id}/security/confirm`),
};

export const shipments = {
  list: () => api<import('./types').Shipment[]>('GET', '/shipments'),
  get: (id: string) => api<{ shipment: import('./types').Shipment; milestones: any[] }>('GET', `/shipments/${id}`),
  updateDetails: (id: string, data: { serviceProviderName?: string; bookingReference?: string; transportMode?: string; transportDocumentType?: string; transportDocumentReference?: string; trackingUrl?: string; vesselName?: string; containerReference?: string; originLocation?: string; destinationLocation?: string; etaArrival?: string }) =>
    api<any>('PATCH', `/shipments/${id}/details`, data),
  recordMilestone: (id: string, data: { milestone: string; location?: string; notes?: string; exceptionalDispatch?: { reason: string; acknowledgePaymentRisk: true } }) =>
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
  split: (id: string, data: { quantities: number[] }) =>
    api<any>('POST', `/holdings/${id}/split`, data),
};

export const evidence = {
  list: (entityType?: string, entityId?: string) => {
    const qs = entityType && entityId ? `?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}` : '';
    return api<import('./types').Evidence[]>('GET', `/evidence${qs}`);
  },
  upload: (file: File, data: { type?: string; linkedEntityType: string; linkedEntityId: string; claimDescription?: string }) => {
    return api<{ uploadUrl: string }>('POST', '/evidence/upload-intents', {
      type: data.type || 'other', fileName: file.name, mimeType: file.type,
      fileSizeBytes: file.size, linkedEntityType: data.linkedEntityType,
      linkedEntityId: data.linkedEntityId, claimDescription: data.claimDescription,
    }).then(async ({ uploadUrl }) => {
      const res = await fetch(API_BASE + uploadUrl, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || `Upload failed (${res.status})`);
      return result;
    });
  },
  download: async (id: string, fileName: string) => {
    const res = await fetch(`${API_BASE}/evidence/${id}/download`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Could not download document');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  },
};

export const organizations = {
  list: () => api<any[]>('GET', '/organizations'),
  get: (id: string) => api<any>('GET', `/organizations/${id}`),
  create: (data: { name: string; type: string; country?: string; verificationStatus?: string }) =>
    api<any>('POST', '/organizations', data),
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

export const publicProducts = {
  get: (slug: string) => api<import('./types').PublicProduct>('GET', `/public/products/${slug}`),
  recordScan: (slug: string) => api<void>('POST', `/public/products/${slug}/scans`),
};

export const productProfiles = {
  list: () => api<import('./types').ProductProfileSummary[]>('GET', '/product-profiles'),
  getForBatch: (batchId: string) => api<import('./types').ProductProfile>('GET', `/product-profiles/batch/${batchId}`),
  save: (data: { batchId: string; slug: string; displayName: string; brandName?: string; description?: string; gtin?: string; lotCode: string; heroImageUrl?: string }) =>
    api<import('./types').ProductProfile>('POST', '/product-profiles', data),
  publish: (id: string) => api<import('./types').ProductProfile>('POST', `/product-profiles/${id}/publish`),
};

export const recalls = {
  list: () => api<import('./types').RecallNotice[]>('GET', '/recalls'),
  create: (data: { referenceCode: string; title: string; reason: string; instructions: string; severity: 'advisory' | 'warning' | 'critical'; batchIds?: string[]; lots?: Array<{ lotId: string; quantityKg?: number }> }) =>
    api<import('./types').RecallNotice>('POST', '/recalls', data),
  resolve: (id: string) => api<import('./types').RecallNotice>('POST', `/recalls/${id}/resolve`),
};

export const traceability = {
  listLots: () => api<import('./types').MaterialLot[]>('GET', '/traceability/lots'),
  traceBack: (lotId: string, quantityKg?: number) => api<import('./types').TraceBackResult>(
    'GET', `/traceability/lots/${lotId}/trace-back${quantityKg ? `?quantityKg=${quantityKg}` : ''}`
  ),
  traceForward: (lotId: string, quantityKg?: number) => api<import('./types').RecallImpactResult>(
    'GET', `/traceability/lots/${lotId}/trace-forward${quantityKg ? `?quantityKg=${quantityKg}` : ''}`
  ),
  recallImpact: (lots: Array<{ lotId: string; quantityKg?: number }>) =>
    api<import('./types').RecallImpactResult>('POST', '/traceability/recall-impact', { lots }),
};
