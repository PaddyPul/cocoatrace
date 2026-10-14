import { api } from './http';
import type { CatalogPage } from './http';
import { API_BASE } from './http';

export const provenance = {
  get: (batchId: string) =>
    api<import('../types').ProvenancePack>('GET', `/provenance/batches/${batchId}`),
  exportBatch: (batchId: string) => {
    const url = `${API_BASE}/provenance/batches/${batchId}/export?format=json`;
    window.open(url, '_blank', 'noopener,noreferrer');
  },
};

export const publicProducts = {
  noticesPage: (slug: string, parameters: Record<string, string>) =>
    api<
      CatalogPage<import('../types').PublicNotice> & {
        count: number;
        safety: import('../types').PublicNoticeSafety;
      }
    >(
      'GET',
      `/public/products/${encodeURIComponent(slug)}/notices/page?${new URLSearchParams(parameters)}`,
    ),
  journeyPage: (slug: string, parameters: Record<string, string>) =>
    api<CatalogPage<import('../types').JourneyEvent & { id: string }> & { count: number }>(
      'GET',
      `/public/products/${encodeURIComponent(slug)}/journey/page?${new URLSearchParams(parameters)}`,
    ),
  evidencePage: (slug: string, parameters: Record<string, string>) =>
    api<CatalogPage<import('../types').PublicProduct['evidence'][number]> & { count: number }>(
      'GET',
      `/public/products/${encodeURIComponent(slug)}/evidence/page?${new URLSearchParams(parameters)}`,
    ),
  get: (slug: string) => api<import('../types').PublicProduct>('GET', `/public/products/${slug}`),
  recordScan: (slug: string) => api<void>('POST', `/public/products/${slug}/scans`),
};

export const productProfiles = {
  page: (parameters: Record<string, string>) =>
    api<CatalogPage<import('../types').ProductProfileSummary>>(
      'GET',
      `/product-profiles/page?${new URLSearchParams(parameters)}`,
    ),
  summary: () =>
    api<{ count: number; published_count: number; held_count: number }>(
      'GET',
      '/product-profiles/summary',
    ),
  list: () => api<import('../types').ProductProfileSummary[]>('GET', '/product-profiles'),
  getForBatch: (batchId: string) =>
    api<import('../types').ProductProfile>('GET', `/product-profiles/batch/${batchId}`),
  save: (data: {
    batchId: string;
    slug: string;
    displayName: string;
    brandName?: string;
    description?: string;
    gtin?: string;
    lotCode: string;
    heroImageUrl?: string;
  }) => api<import('../types').ProductProfile>('POST', '/product-profiles', data),
  publish: (id: string) =>
    api<import('../types').ProductProfile>('POST', `/product-profiles/${id}/publish`),
};

export const recalls = {
  page: (parameters: Record<string, string>) =>
    api<CatalogPage<import('../types').RecallRegisterRow>>(
      'GET',
      `/recalls/page?${new URLSearchParams(parameters)}`,
    ),
  summary: () => api<{ count: number; active_count: number }>('GET', '/recalls/summary'),
  list: () => api<import('../types').RecallNotice[]>('GET', '/recalls'),
  create: (data: {
    referenceCode: string;
    title: string;
    reason: string;
    instructions: string;
    severity: 'advisory' | 'warning' | 'critical';
    batchIds?: string[];
    lots?: Array<{ lotId: string; quantityKg?: number }>;
  }) => api<import('../types').RecallNotice>('POST', '/recalls', data),
  response: (id: string, parameters: Record<string, string> = {}) =>
    api<import('../types').RecallResponse>(
      'GET',
      `/recalls/${id}/response?${new URLSearchParams(parameters)}`,
    ),
  acknowledge: (id: string, note: string) => api('POST', `/recalls/${id}/acknowledge`, { note }),
  contact: (
    id: string,
    organizationId: string,
    data: { status: 'contacted' | 'unreachable' | 'escalated'; note: string },
  ) => api('PATCH', `/recalls/${id}/participants/${organizationId}/contact`, data),
  recovery: (
    id: string,
    holdingId: string,
    data: {
      quarantinedKg: number;
      returnedKg: number;
      destroyedKg: number;
      correctedKg: number;
      releasedKg: number;
      note: string;
    },
  ) => api('PUT', `/recalls/${id}/recovery/${holdingId}`, data),
  resolve: (id: string, data: { reason: string; evidenceIds: string[] }) =>
    api<import('../types').RecallNotice>('POST', `/recalls/${id}/resolve`, data),
};

export const traceability = {
  listLots: () => api<import('../types').MaterialLot[]>('GET', '/traceability/lots'),
  listLotPage: (search = '', cursor?: string) =>
    api<{ items: import('../types').MaterialLot[]; nextCursor: string | null; hasMore: boolean }>(
      'GET',
      `/traceability/lots/page?${new URLSearchParams({ search, limit: '50', ...(cursor ? { cursor } : {}) })}`,
    ),
  traceBack: (lotId: string, quantityKg?: number) =>
    api<import('../types').TraceBackResult>(
      'GET',
      `/traceability/lots/${lotId}/trace-back${quantityKg ? `?quantityKg=${quantityKg}` : ''}`,
    ),
  traceForward: (lotId: string, quantityKg?: number) =>
    api<import('../types').RecallImpactResult>(
      'GET',
      `/traceability/lots/${lotId}/trace-forward${quantityKg ? `?quantityKg=${quantityKg}` : ''}`,
    ),
  recallImpact: (lots: Array<{ lotId: string; quantityKg?: number }>) =>
    api<import('../types').RecallImpactResult>('POST', '/traceability/recall-impact', { lots }),
};
