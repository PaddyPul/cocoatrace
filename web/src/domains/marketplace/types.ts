import type { TrustSummary } from '../trust/types';

export interface Listing {
  expires_at?: string | null;
  renewed_at?: string | null;
  active?: boolean;
  currency: string;
  activeRecall?: boolean;
  trust?: TrustSummary;
  id: string;
  seller_name?: string;
  seller_organization_id: string;
  batch_id: string;
  farm_name?: string;
  farm_region?: string;
  origin_location?: string;
  destination_location?: string;
  available_quantity_kg: number;
  price_per_kg: number;
  incoterm: string;
  crop?: string;
  harvest_date?: string;
  grade?: string;
  organic_claim_status: string;
  source_mode?: 'farm_traceable' | 'direct_inventory';
  source_name?: string;
  source_country?: string;
  source_region?: string;
  farm_country?: string;
}

export interface StructuredSourcingBrief {
  title: string;
  commodity: string;
  quantityKg: number | null;
  originCountries: string[];
  qualityRequirements: Record<string, unknown>;
  assuranceRequirements: Record<string, unknown>;
  deliveryLocation: string;
  incoterm: string;
  requiredBy: string;
  extractedFacts: Array<{ field: string; value: string; confidence: 'high' | 'medium' }>;
  unresolved: string[];
}

export interface SourcingRequest {
  id: string;
  buyer_organization_id: string;
  buyer_name?: string;
  title: string;
  commodity: string;
  quantity_kg: number;
  origin_countries: string[];
  quality_requirements: Record<string, unknown>;
  assurance_requirements: Record<string, unknown>;
  delivery_location: string;
  incoterm: string;
  required_by?: string;
  offer_deadline?: string;
  visibility: 'matched' | 'invited' | 'private';
  status: 'draft' | 'open' | 'awarded' | 'closed' | 'cancelled';
  created_at: string;
}

export interface Offer {
  rejection_reason?: string | null;
  currency_minor_units?: number;
  trade_value?: string;
  platform_fee_rate_bps?: number;
  platform_fee_estimate?: string;
  platform_fee_payer?: string;
  id: string;
  listing_id: string;
  seller_name?: string;
  seller_organization_id?: string;
  buyer_name?: string;
  buyer_organization_id?: string;
  quantity_kg: number;
  offered_price_per_kg: number;
  currency?: string;
  valid_until: string;
  status: string;
  origin_location?: string;
  destination_location?: string;
  created_at?: string;
}
