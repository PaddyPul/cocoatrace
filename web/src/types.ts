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

export interface Farm {
  id: string;
  name: string;
  country: string;
  region: string;
  district: string;
  farmer_organization_id: string;
  farmer_org_name?: string;
  official_traceability_id?: string;
  verification_status: string;
}

export interface Batch {
  id: string;
  farm_id: string;
  farm_name?: string;
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
}

export interface Listing {
  id: string;
  seller_name?: string;
  seller_organization_id: string;
  batch_id: string;
  farm_region?: string;
  origin_location?: string;
  available_quantity_kg: number;
  price_per_kg: number;
  incoterm: string;
  grade?: string;
  organic_claim_status: string;
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
  quantity_kg: number;
  warehouse_location?: string;
  status: string;
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
  buyer_name?: string;
  quantity_kg: number;
  offered_price_per_kg: number;
  valid_until: string;
  status: string;
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
  standard: string;
  valid_from: string;
  valid_to: string;
  status: string;
}

export interface ProvenancePack {
  batch: Batch;
  completenessPercent: number;
  eudrReadiness: { ready: boolean };
  policyCheckResults: Array<{ rule: string; passed: boolean; warning?: boolean }>;
}
