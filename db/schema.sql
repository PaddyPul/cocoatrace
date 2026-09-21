-- CocoaTrace Schema
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('farmer','cooperative','certifier','exporter','importer','logistics','bank','regulator','auditor','admin')),
  jurisdiction CHAR(2) NOT NULL DEFAULT 'GH',
  legal_registration_number TEXT,
  verification_status TEXT NOT NULL DEFAULT 'verified',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Roles
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  permissions TEXT[] NOT NULL DEFAULT '{}'
);

-- User roles
CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES users(id),
  role_id UUID NOT NULL REFERENCES roles(id),
  PRIMARY KEY (user_id, role_id)
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

-- Persistent first-run state. Onboarding is user-specific because people in
-- the same organization can have different jobs and first missions.
CREATE TABLE IF NOT EXISTS user_onboarding (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed')),
  current_step INTEGER NOT NULL DEFAULT 0 CHECK (current_step BETWEEN 0 AND 4),
  primary_goal TEXT,
  pilot_mode BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deliberately small, explicit feedback capture for design-partner pilots.
-- No clickstream, device fingerprint, or hidden behavioral tracking.
CREATE TABLE IF NOT EXISTS pilot_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  page TEXT NOT NULL,
  task TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Single-use account invitations make pilots testable with real, attributable
-- users without sharing demo passwords or exposing account creation publicly.
CREATE TABLE IF NOT EXISTS user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  email TEXT NOT NULL,
  role_id UUID NOT NULL REFERENCES roles(id),
  token_hash TEXT NOT NULL UNIQUE,
  invited_by_user_id UUID NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_invitations_org_created
  ON user_invitations (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pilot_feedback_org_created
  ON pilot_feedback (organization_id, created_at DESC);

-- Farms
CREATE TABLE IF NOT EXISTS farms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_organization_id UUID NOT NULL REFERENCES organizations(id),
  cooperative_organization_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  country CHAR(2) NOT NULL DEFAULT 'GH',
  region TEXT NOT NULL,
  district TEXT NOT NULL,
  community TEXT,
  official_traceability_id TEXT,
  verification_status TEXT NOT NULL DEFAULT 'verified',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Farm plots
CREATE TABLE IF NOT EXISTS farm_plots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  plot_code TEXT NOT NULL,
  area_hectares NUMERIC(10,4) NOT NULL,
  crops TEXT[] NOT NULL DEFAULT '{cocoa}',
  gps_lat NUMERIC(10,7),
  gps_lng NUMERIC(10,7),
  geolocation_source TEXT NOT NULL DEFAULT 'field_agent',
  verification_status TEXT NOT NULL DEFAULT 'verified',
  deforestation_risk_status TEXT DEFAULT 'clear',
  eudr_cutoff_checked BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(farm_id, plot_code)
);

-- Organic certificates
CREATE TABLE IF NOT EXISTS organic_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certifier_organization_id UUID NOT NULL REFERENCES organizations(id),
  farmer_organization_id UUID NOT NULL REFERENCES organizations(id),
  farm_id UUID NOT NULL REFERENCES farms(id),
  standard TEXT NOT NULL DEFAULT 'EU_ORGANIC',
  crop_scope TEXT[] NOT NULL DEFAULT '{cocoa}',
  valid_from DATE NOT NULL,
  valid_to DATE NOT NULL,
  issuing_authority TEXT NOT NULL,
  accreditation_reference TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Harvest batches
CREATE TABLE IF NOT EXISTS harvest_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  plot_ids UUID[] NOT NULL DEFAULT '{}',
  crop TEXT NOT NULL DEFAULT 'cocoa',
  harvest_date DATE NOT NULL,
  quantity_kg NUMERIC(12,3) NOT NULL CHECK (quantity_kg > 0),
  moisture_percent NUMERIC(5,2),
  grade TEXT,
  organic_claim_status TEXT NOT NULL DEFAULT 'none',
  attestation_id UUID,
  current_holder_id UUID NOT NULL REFERENCES organizations(id),
  provenance_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Quantity-aware lot genealogy. Harvest batches become source lots; processing
-- and packaging create production/packaging lots linked by explicit allocations.
CREATE TABLE IF NOT EXISTS material_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_code TEXT NOT NULL UNIQUE,
  lot_type TEXT NOT NULL CHECK (lot_type IN ('source','production','packaging')),
  batch_id UUID UNIQUE REFERENCES harvest_batches(id),
  product_name TEXT NOT NULL,
  quantity_kg NUMERIC(14,3) NOT NULL CHECK (quantity_kg > 0),
  owner_organization_id UUID NOT NULL REFERENCES organizations(id),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','consumed','distributed','held','recalled')),
  produced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((lot_type = 'source' AND batch_id IS NOT NULL) OR lot_type <> 'source')
);

CREATE TABLE IF NOT EXISTS transformation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL CHECK (event_type IN ('blend','process','package','repack')),
  facility_organization_id UUID NOT NULL REFERENCES organizations(id),
  occurred_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- allocated_input_kg is the amount of the source lot assigned to this exact
-- destination lot. This removes ambiguity from many-input/many-output events.
CREATE TABLE IF NOT EXISTS lot_genealogy_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transformation_event_id UUID NOT NULL REFERENCES transformation_events(id) ON DELETE CASCADE,
  source_lot_id UUID NOT NULL REFERENCES material_lots(id),
  destination_lot_id UUID NOT NULL REFERENCES material_lots(id),
  allocated_input_kg NUMERIC(14,3) NOT NULL CHECK (allocated_input_kg > 0),
  allocation_method TEXT NOT NULL DEFAULT 'declared' CHECK (allocation_method IN ('declared','proportional')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(transformation_event_id, source_lot_id, destination_lot_id),
  CHECK (source_lot_id <> destination_lot_id)
);

-- Batch attestations
CREATE TABLE IF NOT EXISTS batch_attestations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES harvest_batches(id),
  certificate_id UUID NOT NULL REFERENCES organic_certificates(id),
  certifier_user_id UUID NOT NULL REFERENCES users(id),
  certifier_organization_id UUID NOT NULL REFERENCES organizations(id),
  attested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  provenance_hash TEXT NOT NULL,
  notes TEXT
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_attestation') THEN
    ALTER TABLE harvest_batches ADD CONSTRAINT fk_attestation
      FOREIGN KEY (attestation_id) REFERENCES batch_attestations(id) DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

-- Batch holdings
CREATE TABLE IF NOT EXISTS batch_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES harvest_batches(id),
  holder_organization_id UUID NOT NULL REFERENCES organizations(id),
  quantity_kg NUMERIC(12,3) NOT NULL CHECK (quantity_kg > 0),
  warehouse_location TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Custody transfers
CREATE TABLE IF NOT EXISTS custody_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id UUID NOT NULL REFERENCES batch_holdings(id),
  from_organization_id UUID NOT NULL REFERENCES organizations(id),
  to_organization_id UUID NOT NULL REFERENCES organizations(id),
  quantity_kg NUMERIC(12,3) NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

-- Listings
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_organization_id UUID NOT NULL REFERENCES organizations(id),
  holding_id UUID NOT NULL REFERENCES batch_holdings(id),
  available_quantity_kg NUMERIC(12,3) NOT NULL,
  price_per_kg NUMERIC(10,4) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  incoterm TEXT NOT NULL DEFAULT 'CIF',
  origin_location TEXT NOT NULL,
  destination_location TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trade offers
CREATE TABLE IF NOT EXISTS trade_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id),
  buyer_organization_id UUID NOT NULL REFERENCES organizations(id),
  quantity_kg NUMERIC(12,3) NOT NULL,
  offered_price_per_kg NUMERIC(10,4) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  valid_until TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sales contracts
CREATE TABLE IF NOT EXISTS sales_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id),
  offer_id UUID NOT NULL REFERENCES trade_offers(id),
  seller_organization_id UUID NOT NULL REFERENCES organizations(id),
  buyer_organization_id UUID NOT NULL REFERENCES organizations(id),
  holding_id UUID NOT NULL REFERENCES batch_holdings(id),
  quantity_kg NUMERIC(12,3) NOT NULL,
  price_per_kg NUMERIC(10,4) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  incoterm TEXT NOT NULL DEFAULT 'CIF',
  status TEXT NOT NULL DEFAULT 'accepted',
  eudr_due_diligence_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shipments
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES sales_contracts(id),
  logistics_organization_id UUID REFERENCES organizations(id),
  container_reference TEXT,
  vessel_name TEXT,
  bill_of_lading_number TEXT,
  origin_port TEXT NOT NULL DEFAULT 'Tema Port, Ghana',
  destination_port TEXT NOT NULL DEFAULT 'Port of Rotterdam, Netherlands',
  eta_arrival DATE,
  current_milestone TEXT NOT NULL DEFAULT 'requested',
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shipment milestones
CREATE TABLE IF NOT EXISTS shipment_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id),
  milestone TEXT NOT NULL,
  recorded_by_user_id UUID NOT NULL REFERENCES users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  location TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS lot_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID NOT NULL REFERENCES material_lots(id),
  shipment_id UUID REFERENCES shipments(id),
  recipient_organization_id UUID NOT NULL REFERENCES organizations(id),
  quantity_kg NUMERIC(14,3) NOT NULL CHECK (quantity_kg > 0),
  distribution_reference TEXT NOT NULL UNIQUE,
  dispatched_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payment requests
CREATE TABLE IF NOT EXISTS payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES sales_contracts(id),
  requested_by_organization_id UUID NOT NULL REFERENCES organizations(id),
  amount_total NUMERIC(14,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'requested',
  payment_reference_external TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

-- Evidence items
CREATE TABLE IF NOT EXISTS evidence_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_user_id UUID NOT NULL REFERENCES users(id),
  uploader_organization_id UUID NOT NULL REFERENCES organizations(id),
  type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  sha256_hash TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'approved',
  linked_entity_type TEXT NOT NULL,
  linked_entity_id UUID NOT NULL,
  claim_description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Public product identities. A stable slug is encoded in the QR code so the
-- destination can change over time without reprinting packaging.
CREATE TABLE IF NOT EXISTS product_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL UNIQUE REFERENCES harvest_batches(id),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  display_name TEXT NOT NULL,
  brand_name TEXT,
  description TEXT NOT NULL DEFAULT '',
  gtin TEXT,
  lot_code TEXT NOT NULL UNIQUE,
  hero_image_url TEXT,
  visibility TEXT NOT NULL DEFAULT 'draft' CHECK (visibility IN ('draft','published','archived')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A recall is intentionally separate from a profile: one notice can affect
-- several source batches/lots and a batch can be involved in multiple notices.
CREATE TABLE IF NOT EXISTS recall_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  reason TEXT NOT NULL,
  instructions TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('advisory','warning','critical')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','resolved')),
  initiated_by_user_id UUID NOT NULL REFERENCES users(id),
  initiated_by_organization_id UUID NOT NULL REFERENCES organizations(id),
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recall_affected_batches (
  recall_id UUID NOT NULL REFERENCES recall_notices(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES harvest_batches(id),
  PRIMARY KEY (recall_id, batch_id)
);

CREATE TABLE IF NOT EXISTS recall_affected_lots (
  recall_id UUID NOT NULL REFERENCES recall_notices(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES material_lots(id),
  source_equivalent_kg NUMERIC(14,3) NOT NULL CHECK (source_equivalent_kg >= 0),
  recall_quantity_kg NUMERIC(14,3) NOT NULL CHECK (recall_quantity_kg > 0),
  relationship_depth INTEGER NOT NULL DEFAULT 0 CHECK (relationship_depth >= 0),
  CHECK (source_equivalent_kg <= recall_quantity_kg),
  PRIMARY KEY (recall_id, lot_id)
);

-- Privacy-minimal scan telemetry. No IP address or device fingerprint is kept.
CREATE TABLE IF NOT EXISTS product_profile_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_profile_id UUID NOT NULL REFERENCES product_profiles(id) ON DELETE CASCADE,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  referrer_host TEXT
);

-- Audit events
CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL,
  actor_organization_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  previous_state_hash TEXT,
  new_state_hash TEXT NOT NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_farms_farmer ON farms(farmer_organization_id);
CREATE INDEX IF NOT EXISTS idx_plots_farm ON farm_plots(farm_id);
CREATE INDEX IF NOT EXISTS idx_certs_farm ON organic_certificates(farm_id);
CREATE INDEX IF NOT EXISTS idx_batches_holder ON harvest_batches(current_holder_id);
CREATE INDEX IF NOT EXISTS idx_holdings_holder ON batch_holdings(holder_organization_id);
CREATE INDEX IF NOT EXISTS idx_contracts_seller ON sales_contracts(seller_organization_id);
CREATE INDEX IF NOT EXISTS idx_contracts_buyer ON sales_contracts(buyer_organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_events(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_evidence_entity ON evidence_items(linked_entity_type, linked_entity_id);
CREATE INDEX IF NOT EXISTS idx_product_profiles_slug ON product_profiles(slug);
CREATE INDEX IF NOT EXISTS idx_recall_status ON recall_notices(status);
CREATE INDEX IF NOT EXISTS idx_recall_batches_batch ON recall_affected_batches(batch_id);
CREATE INDEX IF NOT EXISTS idx_profile_scans_profile_time ON product_profile_scans(product_profile_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_material_lots_batch ON material_lots(batch_id);
CREATE INDEX IF NOT EXISTS idx_genealogy_source ON lot_genealogy_edges(source_lot_id);
CREATE INDEX IF NOT EXISTS idx_genealogy_destination ON lot_genealogy_edges(destination_lot_id);
CREATE INDEX IF NOT EXISTS idx_lot_distributions_lot ON lot_distributions(lot_id);
CREATE INDEX IF NOT EXISTS idx_recall_lots_lot ON recall_affected_lots(lot_id);
