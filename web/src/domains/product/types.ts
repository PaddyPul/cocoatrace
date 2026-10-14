import type { TrustSummary } from '../trust/types';

export interface ProductProfile {
  id: string;
  batch_id: string;
  slug: string;
  display_name: string;
  brand_name?: string;
  description: string;
  gtin?: string;
  lot_code: string;
  visibility: 'draft' | 'published' | 'archived';
  profileUrl: string;
  qrSvgUrl: string;
}

export interface ProductProfileSummary extends ProductProfile {
  inventory_held?: boolean;
  crop: string;
  harvest_date: string;
  quantity_kg: number;
  organic_claim_status: string;
  farm_name: string;
  region: string;
  country: string;
  current_holder_name: string;
  scan_count: number;
  evidence_count: number;
  safety_status: 'clear' | 'advisory' | 'warning' | 'critical';
}

export interface JourneyEvent {
  type: 'harvest' | 'verification' | 'custody' | 'shipment' | 'recall';
  title: string;
  summary: string;
  occurredAt: string;
  location?: string;
  organization?: string;
  verified?: boolean;
}

export interface PublicProduct {
  trust?: TrustSummary;
  profile: {
    slug: string;
    displayName: string;
    brandName?: string;
    description: string;
    gtin?: string;
    lotCode: string;
    heroImageUrl?: string;
    publishedAt: string;
    profileUrl: string;
    qrSvgUrl: string;
  };
  product: {
    crop: string;
    harvestDate: string;
    quantityKg: number;
    moisturePercent?: number;
    grade?: string;
    organicClaimStatus: string;
    provenanceHash?: string;
    currentHolderName: string;
  };
  origin: {
    farmName: string;
    farmerName: string;
    country: string;
    region: string;
    district: string;
    community?: string;
    officialTraceabilityId?: string;
    verificationStatus: string;
    plot_count: number;
    total_area_hectares: number;
    geolocation_complete: boolean;
    eudr_cutoff_checked: boolean;
    deforestation_risk_clear: boolean;
  };
  certificate?: {
    standard: string;
    valid_from: string;
    valid_to: string;
    status: string;
    accreditation_reference: string;
    certifier_name: string;
    attested_at: string;
    notes?: string;
  };
  evidence: Array<{
    id?: string;
    type: string;
    file_name: string;
    sha256_hash: string;
    review_status: string;
    claim_description: string;
    created_at: string;
  }>;
  evidencePaging?: { count: number; hasMore: boolean; nextCursor: string | null };
  noticesPaging?: { count: number; hasMore: boolean; nextCursor: string | null };
  journeyPaging?: { count: number; hasMore: boolean; nextCursor: string | null };
  journey: JourneyEvent[];
  safety: {
    inventoryHeld?: boolean;
    status: 'clear' | 'advisory' | 'warning' | 'critical';
    activeRecalls: Array<{
      id: string;
      reference_code: string;
      title: string;
      reason: string;
      instructions: string;
      severity: string;
      status: string;
      initiated_at: string;
      issued_by: string;
    }>;
    resolvedRecalls: any[];
    checkedAt: string;
  };
}
