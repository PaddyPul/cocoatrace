import { api } from './http';
import type { CatalogPage } from './http';

export type ListingSummary = { count: number; own_count: number; quantity_kg: string };

export const listings = {
  list: () => api<import('../types').Listing[]>('GET', '/listings'),
  page: (parameters: Record<string, string> = {}) =>
    api<CatalogPage<import('../types').Listing>>(
      'GET',
      `/listings/page?${new URLSearchParams({ limit: '50', ...parameters })}`,
    ),
  summary: () => api<ListingSummary>('GET', '/listings/summary'),
  get: (id: string) => api<import('../types').Listing>('GET', `/listings/${id}`),
  create: (data: {
    holdingId: string;
    availableQuantityKg: number;
    pricePerKg: number;
    currency?: string;
    incoterm?: string;
    originLocation: string;
    destinationLocation: string;
  }) => api<import('../types').Listing>('POST', '/listings', data),
};

export interface SourcingSummary {
  own_count: number;
  open_count: number;
  latest_own: import('../types').SourcingRequest | null;
  latest_own_open: import('../types').SourcingRequest | null;
  latest_open: import('../types').SourcingRequest | null;
}

function validSourcingRequest(value: unknown): value is import('../types').SourcingRequest {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    [
      'id',
      'buyer_organization_id',
      'title',
      'commodity',
      'status',
      'incoterm',
      'delivery_location',
    ].every((key) => typeof row[key] === 'string') &&
    ['draft', 'open', 'awarded', 'closed', 'cancelled'].includes(String(row.status)) &&
    (typeof row.quantity_kg === 'number' || typeof row.quantity_kg === 'string') &&
    Number.isFinite(Number(row.quantity_kg)) &&
    Number(row.quantity_kg) > 0 &&
    (row.visibility === undefined ||
      ['matched', 'invited', 'private'].includes(String(row.visibility))) &&
    (row.quality_requirements === undefined ||
      (row.quality_requirements !== null &&
        typeof row.quality_requirements === 'object' &&
        !Array.isArray(row.quality_requirements))) &&
    (row.origin_countries === undefined ||
      (Array.isArray(row.origin_countries) &&
        row.origin_countries.every((country) => typeof country === 'string'))) &&
    (row.assurance_requirements === undefined ||
      (row.assurance_requirements !== null &&
        typeof row.assurance_requirements === 'object' &&
        !Array.isArray(row.assurance_requirements)))
  );
}

export const sourcing = {
  list: () => api<import('../types').SourcingRequest[]>('GET', '/sourcing-requests'),
  page: async (parameters: Record<string, string> = {}) => {
    const page = await api<CatalogPage<import('../types').SourcingRequest>>(
      'GET',
      `/sourcing-requests/page?${new URLSearchParams({ limit: '50', ...parameters })}`,
    );
    if (!page || !Array.isArray(page.items) || !page.items.every(validSourcingRequest))
      throw new Error('Invalid sourcing request page. Retry or contact the platform operator.');
    return page;
  },
  summary: async () => {
    const summary = await api<SourcingSummary>('GET', '/sourcing-requests/summary');
    if (
      !summary ||
      ![summary.own_count, summary.open_count].every(
        (count) => Number.isSafeInteger(count) && count >= 0,
      ) ||
      !(summary.latest_own === null || validSourcingRequest(summary.latest_own)) ||
      !(
        summary.latest_own_open === null ||
        (validSourcingRequest(summary.latest_own_open) && summary.latest_own_open.status === 'open')
      ) ||
      !(summary.latest_open === null || validSourcingRequest(summary.latest_open))
    )
      throw new Error('Invalid sourcing request totals.');
    return summary;
  },
  structure: (brief: string) =>
    api<import('../types').StructuredSourcingBrief>('POST', '/sourcing-requests/structure', {
      brief,
    }),
  create: (data: {
    title: string;
    commodity: string;
    quantityKg: number;
    originCountries?: string[];
    qualityRequirements?: Record<string, unknown>;
    assuranceRequirements?: Record<string, unknown>;
    deliveryLocation: string;
    incoterm?: string;
    requiredBy?: string;
    offerDeadline?: string;
    visibility?: 'matched' | 'invited' | 'private';
    status?: 'draft' | 'open';
  }) => api<import('../types').SourcingRequest>('POST', '/sourcing-requests', data),
  update: (id: string, data: { status?: string; title?: string; offerDeadline?: string }) =>
    api<import('../types').SourcingRequest>('PATCH', `/sourcing-requests/${id}`, data),
};

export interface OfferSummary {
  received_count: number;
  sent_count: number;
  received_pending: number;
  sent_pending: number;
}

export const offers = {
  page: (parameters: Record<string, string> = {}) =>
    api<CatalogPage<import('../types').Offer>>(
      'GET',
      `/offers/page?${new URLSearchParams({ limit: '50', ...parameters })}`,
    ),
  summary: () => api<OfferSummary>('GET', '/offers/summary'),
  list: () => api<import('../types').Offer[]>('GET', '/offers'),
  create: (
    listingId: string,
    data: { quantityKg: number; offeredPricePerKg: number; currency?: string; validUntil?: string },
  ) => api('POST', `/listings/${listingId}/offers`, data),
  accept: (offerId: string, feeRateBps?: number) =>
    api<any>('POST', `/offers/${offerId}/accept`, { feeRateBps }),
  reject: (offerId: string) => api<any>('POST', `/offers/${offerId}/reject`),
};
