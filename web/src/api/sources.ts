import { api } from './http';
import type { CatalogPage } from './http';

export interface FarmPlot {
  id: string;
  plot_code: string;
  area_hectares: string | number;
  crops: string[];
  gps_lat?: string | number | null;
  gps_lng?: string | number | null;
}

export type HoldingSummary = {
  count: number;
  available_count: number;
  available_kg: string;
  commodities: string[];
};

export interface FarmSummary {
  count: number;
  owned_count: number;
}

export const farms = {
  plotsPage: (id: string, parameters: Record<string, string>) =>
    api<CatalogPage<FarmPlot>>('GET', `/farms/${id}/plots/page?${new URLSearchParams(parameters)}`),
  plotsSummary: (id: string) =>
    api<{ count: number; crops?: string[] }>('GET', `/farms/${id}/plots/summary`),
  list: () => api<import('../types').Farm[]>('GET', '/farms'),
  page: (parameters: Record<string, string> = {}) =>
    api<CatalogPage<import('../types').Farm>>(
      'GET',
      `/farms/page?${new URLSearchParams({ limit: '50', ...parameters })}`,
    ),
  summary: () => api<FarmSummary>('GET', '/farms/summary'),
  get: (id: string) =>
    api<{
      farm: import('../types').Farm;
      plots: null;
      plot_collection: 'paged';
      certificates: null;
      certificate_collection: 'paged' | 'unavailable';
    }>('GET', `/farms/${id}?certificateMode=paged&plotMode=paged`),
  create: (data: {
    name: string;
    country?: string;
    region: string;
    district: string;
    community?: string;
    officialTraceabilityId?: string;
  }) => api<import('../types').Farm>('POST', '/farms', data),
  createPlot: (
    farmId: string,
    data: {
      plotCode: string;
      areaHectares: number;
      crops: string[];
      gpsLat?: number;
      gpsLng?: number;
      geolocationSource?: string;
    },
  ) => api<any>('POST', `/farms/${farmId}/plots`, data),
};

export const batches = {
  summary: (farm?: string) =>
    api<{ count: number; recorded_quantity_kg: string }>(
      'GET',
      `/batches/summary${farm ? '?' + new URLSearchParams({ farm }) : ''}`,
    ),
  list: () => api<import('../types').Batch[]>('GET', '/batches'),
  page: (parameters: Record<string, string> = {}) =>
    api<CatalogPage<import('../types').Batch>>(
      'GET',
      `/batches/page?${new URLSearchParams({ limit: '50', ...parameters })}`,
    ),
  get: (id: string) =>
    api<{
      batch: import('../types').Batch;
      evidence: null;
      evidence_collection: 'paged' | 'unavailable';
    }>('GET', `/batches/${id}?evidenceMode=paged`),
  create: (data: {
    farmId: string;
    plotIds?: string[];
    crop: string;
    harvestDate: string;
    quantityKg: number;
    moisturePercent?: number;
    grade?: string;
  }) => api<import('../types').Batch>('POST', '/batches', data),
  createDirectInventory: (data: {
    commodity: string;
    quantityKg: number;
    inventoryDate: string;
    sourceName?: string;
    sourceCountry: string;
    sourceRegion?: string;
    warehouseLocation?: string;
    moisturePercent?: number;
    grade?: string;
  }) => api<import('../types').Batch & { holding_id: string }>('POST', '/inventory/direct', data),
  pushToMarketplace: (
    id: string,
    data: {
      quantityKg: number;
      pricePerKg: number;
      currency?: string;
      incoterm?: string;
      originLocation: string;
      destinationLocation: string;
    },
  ) => api<import('../types').Listing>('POST', `/batches/${id}/push-to-marketplace`, data),
  attest: (id: string, data: { certificateId: string; notes?: string }) =>
    api<{ attestation: any; policyChecks: any[] }>('POST', `/batches/${id}/attest`, data),
};

export interface CustodyTransfer {
  id: string;
  holding_id: string;
  from_organization_id: string;
  to_organization_id: string;
  from_org_name: string;
  to_org_name: string;
  quantity_kg: string | number;
  status: string;
  requested_at: string;
  responded_at: string | null;
  warehouse_location: string | null;
  crop: string;
  activeRecall: boolean;
}

export const holdings = {
  list: () => api<import('../types').Holding[]>('GET', '/holdings'),
  page: (parameters: Record<string, string> = {}) =>
    api<CatalogPage<import('../types').Holding>>(
      'GET',
      `/holdings/page?${new URLSearchParams({ limit: '50', ...parameters })}`,
    ),
  summary: () => api<HoldingSummary>('GET', '/holdings/summary'),
  get: (id: string) =>
    api<{ holding: import('../types').Holding; batch: import('../types').Batch | null }>(
      'GET',
      `/holdings/${id}`,
    ),
  create: (data: { batchId: string; quantityKg: number; warehouseLocation?: string }) =>
    api<import('../types').Holding>('POST', '/holdings', data),
  transfer: (id: string, data: { toOrganizationId: string; quantityKg: number; reason?: string }) =>
    api<any>('POST', `/holdings/${id}/transfer`, data),
  listTransfers: () => api<CustodyTransfer[]>('GET', '/transfers'),
  transferPage: (parameters: Record<string, string> = {}) =>
    api<CatalogPage<CustodyTransfer>>(
      'GET',
      `/transfers/page?${new URLSearchParams({ limit: '50', ...parameters })}`,
    ),
  acceptTransfer: (id: string) => api<any>('POST', `/transfers/${id}/accept`),
  split: (id: string, data: { quantities: number[] }) =>
    api<any>('POST', `/holdings/${id}/split`, data),
};

export const certificates = {
  page: (parameters: Record<string, string>) =>
    api<CatalogPage<import('../types').Certificate>>(
      'GET',
      `/certificates/page?${new URLSearchParams(parameters)}`,
    ),
  summary: (parameters: Record<string, string> = {}) =>
    api<{
      count: number;
      active_count: number;
      suspended_count: number;
      revoked_count: number;
      expired_count: number;
    }>('GET', `/certificates/summary?${new URLSearchParams(parameters)}`),
  list: (farmId?: string) =>
    api<import('../types').Certificate[]>(
      'GET',
      `/certificates${farmId ? `?farmId=${farmId}` : ''}`,
    ),
  get: (id: string) => api<import('../types').Certificate>('GET', `/certificates/${id}`),
  issue: (data: {
    farmerOrganizationId: string;
    farmId: string;
    standard: string;
    cropScope: string[];
    validFrom: string;
    validTo: string;
    issuingAuthority: string;
    accreditationReference: string;
  }) => api<import('../types').Certificate>('POST', '/certificates', data),
  updateStatus: (id: string, action: string, data?: { reason?: string }) =>
    api<any>('POST', `/certificates/${id}/${action}`, data),
};
