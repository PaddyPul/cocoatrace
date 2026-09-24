export interface User {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  orgName: string;
  orgType: string;
  roles: string[];
  permissions: string[];
}

export interface OnboardingState {
  user_id: string;
  status: 'not_started' | 'in_progress' | 'completed';
  current_step: number;
  primary_goal?: string | null;
  pilot_mode: boolean;
  completed_at?: string | null;
}

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
  id: string;
  farm_id: string;
  farm_name?: string;
  current_holder_id: string;
  harvest_date: string;
  quantity_kg: number;
  grade?: string;
  organic_claim_status: string;
  holder_name?: string;
  crop: string;
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

export interface Listing {
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

export interface Contract {
  id: string;
  seller_name?: string;
  buyer_name?: string;
  quantity_kg: number;
  price_per_kg: number;
  incoterm: string;
  status: string;
}

export interface Shipment {
  id: string;
  contract_id: string;
  vessel_name?: string;
  container_reference?: string;
  origin_port: string;
  destination_port: string;
  bill_of_lading_number?: string;
  eta_arrival: string;
  current_milestone: string;
}

export interface Holding {
  id: string;
  batch_id: string;
  crop: string;
  harvest_date?: string;
  farm_name?: string;
  grade?: string;
  organic_claim_status?: string;
  quantity_kg: number;
  warehouse_location?: string;
  status: string;
  holder_organization_id?: string;
  created_at?: string;
}

export interface Payment {
  id: string;
  contract_id: string;
  amount_total: number;
  currency: string;
  status: string;
  payment_reference_external?: string;
}

export interface Evidence {
  id: string;
  file_name: string;
  type: string;
  sha256_hash: string;
  linked_entity_type: string;
  linked_entity_id: string;
  review_status: string;
  created_at: string;
}

export interface Offer {
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

export interface AuditEvent {
  id: string;
  occurred_at: string;
  action: string;
  entity_type: string;
  entity_id: string;
  actor_user_id: string;
  new_state_hash?: string;
}

export interface Certificate {
  id: string;
  farm_id: string;
  farmer_organization_id: string;
  certifier_organization_id: string;
  certifier_name?: string;
  standard: string;
  crop_scope: string[];
  valid_from: string;
  valid_to: string;
  status: string;
  issuing_authority?: string;
  accreditation_reference?: string;
}

export interface ProvenancePack {
  batch: Batch;
  completenessPercent: number;
  eudrReadiness: { ready: boolean };
  policyCheckResults: Array<{ rule: string; passed: boolean; warning?: boolean }>;
}

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
    type: string;
    file_name: string;
    sha256_hash: string;
    review_status: string;
    claim_description: string;
    created_at: string;
  }>;
  journey: JourneyEvent[];
  safety: {
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

export interface RecallNotice {
  id: string;
  reference_code: string;
  title: string;
  reason: string;
  instructions: string;
  severity: 'advisory' | 'warning' | 'critical';
  status: 'draft' | 'active' | 'resolved';
  initiated_at: string;
  resolved_at?: string;
  issued_by: string;
  batch_ids: string[];
  affected_lots?: Array<{
    lotId: string;
    lotCode: string;
    sourceEquivalentKg: number;
    recallQuantityKg: number;
    relationshipDepth: number;
  }>;
}

export interface MaterialLot {
  id: string;
  lotCode: string;
  lotType: 'source' | 'production' | 'packaging';
  productName: string;
  quantityKg: number;
  batchId?: string;
  ownerName?: string;
}

export interface TraceLotResult extends MaterialLot {
  relationshipDepth: number;
  allocationConfidence: 'declared' | 'estimated';
  quantityRequiredKg?: number;
  percentOfLot?: number;
  sourceEquivalentKg?: number;
  sourceEquivalentPercent?: number;
  recallQuantityKg?: number;
}

export interface TraceBackResult {
  direction: 'trace-back';
  targetLot: MaterialLot;
  queryQuantityKg: number;
  tracedLots: TraceLotResult[];
  sourceLots: TraceLotResult[];
  exactness: 'declared' | 'estimated';
  warnings: string[];
  assumptions: string[];
}

export interface RecallImpactResult {
  direction: 'trace-forward';
  impactedLots: TraceLotResult[];
  leafLots: TraceLotResult[];
  impactedDistributions: Array<{
    id: string;
    lotId: string;
    recipientName: string;
    quantityKg: number;
    recallQuantityKg: number;
    distributionReference: string;
  }>;
  recipients: Array<{ organizationId: string; name: string; recallQuantityKg: number; distributionCount: number }>;
  totals: {
    impactedLotCount: number;
    leafRecallQuantityKg: number;
    distributedRecallQuantityKg: number;
    recipientCount: number;
  };
  exactness: 'declared' | 'estimated';
  warnings: string[];
  assumptions: string[];
}
