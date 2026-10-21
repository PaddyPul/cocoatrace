export interface ProfileRow {
  id: string;
  batch_id: string;
  slug: string;
  display_name: string;
  brand_name: string | null;
  description: string;
  gtin: string | null;
  lot_code: string;
  hero_image_url: string | null;
  visibility: string;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
export interface PublishedProductRow extends ProfileRow {
  crop: string;
  harvest_date: Date;
  quantity_kg: string;
  moisture_percent: string | null;
  grade: string | null;
  source_mode: string;
  source_name: string | null;
  source_country: string | null;
  source_region: string | null;
  organic_claim_status: string;
  provenance_hash: string | null;
  attestation_id: string | null;
  farm_name: string | null;
  country: string | null;
  region: string | null;
  district: string | null;
  community: string | null;
  official_traceability_id: string | null;
  farm_verification_status: string | null;
  farmer_name: string | null;
  current_holder_name: string;
}
export interface PlotSummaryRow {
  plot_count: number;
  total_area_hectares: number;
  geolocation_complete: boolean | null;
  eudr_cutoff_checked: boolean | null;
  deforestation_risk_clear: boolean | null;
}
export interface CertificateRow {
  standard: string;
  valid_from: Date;
  valid_to: Date;
  status: string;
  accreditation_reference: string | null;
  certifier_name: string;
  attested_at: Date;
  notes: string | null;
}
export interface UpsertProfileInput {
  batchId: string;
  slug: string;
  displayName: string;
  brandName?: string | null;
  description?: string;
  gtin?: string | null;
  lotCode: string;
  heroImageUrl?: string | null;
}
