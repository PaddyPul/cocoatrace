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

ALTER TABLE harvest_batches ADD CONSTRAINT fk_attestation
  FOREIGN KEY (attestation_id) REFERENCES batch_attestations(id) DEFERRABLE INITIALLY DEFERRED;

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
