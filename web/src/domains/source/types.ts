import type { TrustSummary } from '../trust/types';

export interface Farm {
  id: string;
  name: string;
  country: string;
  region: string;
  district: string;
  community?: string;
  farmer_organization_id: string;
  farmer_org_name?: string;
  official_traceability_id?: string;
  verification_status: string;
}

export interface Batch {
  trust?: TrustSummary;
  id: string;
  farm_id?: string | null;
  farm_name?: string;
  current_holder_id: string;
  harvest_date: string;
  quantity_kg: number;
  grade?: string;
  organic_claim_status: string;
  holder_name?: string;
  crop: string;
  source_mode?: 'farm_traceable' | 'direct_inventory';
  source_name?: string;
  source_country?: string;
  source_region?: string;
  region?: string;
  country?: string;
  standard?: string;
  certifier_name?: string;
  att_hash?: string;
  attested_at?: string;
  att_notes?: string;
  cert_standard?: string;
  cert_valid_to?: string;
}

export interface Holding {
  trust?: TrustSummary;
  id: string;
  batch_id: string;
  crop: string;
  harvest_date?: string;
  farm_name?: string;
  grade?: string;
  organic_claim_status?: string;
  source_mode?: 'farm_traceable' | 'direct_inventory';
  source_name?: string;
  source_country?: string;
  source_region?: string;
  quantity_kg: number;
  warehouse_location?: string;
  status: string;
  holder_organization_id?: string;
  created_at?: string;
}
