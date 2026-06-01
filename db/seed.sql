-- CocoaTrace Seed Data - Ghana to Netherlands Corridor
-- Passwords are all: Password123!

-- Organizations
INSERT INTO organizations (id, name, type, jurisdiction, verification_status) VALUES
  ('11111111-1111-1111-1111-111111111001', 'Asante Family Farm',   'farmer',     'GH', 'verified'),
  ('11111111-1111-1111-1111-111111111002', 'Mensah Cooperative',   'cooperative','GH', 'verified'),
  ('11111111-1111-1111-1111-111111111003', 'OrganicCert GH',       'certifier',  'GH', 'verified'),
  ('11111111-1111-1111-1111-111111111004', 'Accra Gold Exports',   'exporter',   'GH', 'verified'),
  ('11111111-1111-1111-1111-111111111005', 'DutchCacao B.V.',      'importer',   'NL', 'verified'),
  ('11111111-1111-1111-1111-111111111006', 'MareCargo Ltd',        'logistics',  'GH', 'verified'),
  ('11111111-1111-1111-1111-111111111007', 'COCOBOD Regulatory',   'regulator',  'GH', 'verified'),
  ('11111111-1111-1111-1111-111111111008', 'Platform Admin',       'admin',      'GH', 'verified')
ON CONFLICT (id) DO NOTHING;

-- Roles
INSERT INTO roles (id, name, permissions) VALUES
  ('22222222-2222-2222-2222-222222222001', 'farmer',    ARRAY['farm.read','farm.create','batch.read','batch.create','holding.read','listing.read','listing.create','offer.respond','custody.transfer.request','payment.read','contract.read']),
  ('22222222-2222-2222-2222-222222222002', 'certifier', ARRAY['certificate.read','certificate.issue','batch.read','batch.attest','farm.read','evidence.read','evidence.upload']),
  ('22222222-2222-2222-2222-222222222003', 'exporter',  ARRAY['batch.read','batch.create','holding.read','holding.create','listing.read','listing.create','offer.respond','contract.read','shipment.read','shipment.request','payment.read','payment.request','evidence.read','evidence.upload']),
  ('22222222-2222-2222-2222-222222222004', 'importer',  ARRAY['listing.read','offer.create','contract.read','shipment.read','payment.read','payment.confirm','evidence.read','evidence.upload','provenance.export']),
  ('22222222-2222-2222-2222-222222222005', 'logistics', ARRAY['shipment.read','shipment.accept','shipment.update','evidence.read','evidence.upload','batch.read','contract.read','farm.read']),
  ('22222222-2222-2222-2222-222222222006', 'regulator', ARRAY['audit.read','farm.read','batch.read','certificate.read','evidence.read','provenance.export','audit.export']),
  ('22222222-2222-2222-2222-222222222007', 'admin',     ARRAY['*'])
ON CONFLICT (id) DO UPDATE SET permissions = EXCLUDED.permissions;

-- Users (password = Password123! -> bcrypt hash)
INSERT INTO users (id, organization_id, email, password_hash, name) VALUES
  ('33333333-3333-3333-3333-333333333001', '11111111-1111-1111-1111-111111111001', 'kwame@farm.gh',       '$2a$10$abcdefghijklmnopqrstuOhXyMYaX/8YjwfNIE6V8qEexU4z5Vgka', 'Kwame Asante'),
  ('33333333-3333-3333-3333-333333333002', '11111111-1111-1111-1111-111111111003', 'akosua@organiccert.gh','$2a$10$abcdefghijklmnopqrstuOhXyMYaX/8YjwfNIE6V8qEexU4z5Vgka', 'Dr. Akosua Mensah'),
  ('33333333-3333-3333-3333-333333333003', '11111111-1111-1111-1111-111111111004', 'ama@accragold.gh',    '$2a$10$abcdefghijklmnopqrstuOhXyMYaX/8YjwfNIE6V8qEexU4z5Vgka', 'Ama Gyasi'),
  ('33333333-3333-3333-3333-333333333004', '11111111-1111-1111-1111-111111111005', 'pieter@dutchcacao.nl','$2a$10$abcdefghijklmnopqrstuOhXyMYaX/8YjwfNIE6V8qEexU4z5Vgka', 'Pieter van Dam'),
  ('33333333-3333-3333-3333-333333333005', '11111111-1111-1111-1111-111111111006', 'kofi@marecargo.gh',   '$2a$10$abcdefghijklmnopqrstuOhXyMYaX/8YjwfNIE6V8qEexU4z5Vgka', 'Kofi Osei'),
  ('33333333-3333-3333-3333-333333333006', '11111111-1111-1111-1111-111111111007', 'ingrid@cocobod.gh',   '$2a$10$abcdefghijklmnopqrstuOhXyMYaX/8YjwfNIE6V8qEexU4z5Vgka', 'Ingrid Boateng'),
  ('33333333-3333-3333-3333-333333333007', '11111111-1111-1111-1111-111111111008', 'admin@cocoatrace.io', '$2a$10$abcdefghijklmnopqrstuOhXyMYaX/8YjwfNIE6V8qEexU4z5Vgka', 'Platform Admin')
ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash;

-- User roles
INSERT INTO user_roles (user_id, role_id) VALUES
  ('33333333-3333-3333-3333-333333333001', '22222222-2222-2222-2222-222222222001'),
  ('33333333-3333-3333-3333-333333333002', '22222222-2222-2222-2222-222222222002'),
  ('33333333-3333-3333-3333-333333333003', '22222222-2222-2222-2222-222222222003'),
  ('33333333-3333-3333-3333-333333333004', '22222222-2222-2222-2222-222222222004'),
  ('33333333-3333-3333-3333-333333333005', '22222222-2222-2222-2222-222222222005'),
  ('33333333-3333-3333-3333-333333333006', '22222222-2222-2222-2222-222222222006'),
  ('33333333-3333-3333-3333-333333333007', '22222222-2222-2222-2222-222222222007')
ON CONFLICT DO NOTHING;

-- Farms
INSERT INTO farms (id, farmer_organization_id, cooperative_organization_id, name, country, region, district, community, official_traceability_id, verification_status) VALUES
  ('44444444-4444-4444-4444-444444444001', '11111111-1111-1111-1111-111111111001', '11111111-1111-1111-1111-111111111002', 'Asante Family Farm', 'GH', 'Ashanti', 'Amansie West', 'Kwabre', 'COCOBOD-0423-A', 'verified'),
  ('44444444-4444-4444-4444-444444444002', '11111111-1111-1111-1111-111111111002', NULL, 'Mensah North Plot', 'GH', 'Ashanti', 'Kwabre East', 'Adansi', 'COCOBOD-0831-B', 'verified')
ON CONFLICT (id) DO NOTHING;

-- Farm plots
INSERT INTO farm_plots (id, farm_id, plot_code, area_hectares, crops, gps_lat, gps_lng, geolocation_source, verification_status, deforestation_risk_status, eudr_cutoff_checked) VALUES
  ('55555555-5555-5555-5555-555555555001', '44444444-4444-4444-4444-444444444001', 'P1', 1.82, '{cocoa}', 6.7341, -1.6122, 'field_agent', 'verified', 'clear', TRUE),
  ('55555555-5555-5555-5555-555555555002', '44444444-4444-4444-4444-444444444001', 'P2', 1.40, '{cocoa}', 6.7289, -1.6088, 'field_agent', 'verified', 'clear', TRUE),
  ('55555555-5555-5555-5555-555555555003', '44444444-4444-4444-4444-444444444001', 'P3', 1.00, '{cocoa}', NULL, NULL, 'farmer_submitted', 'pending', NULL, FALSE),
  ('55555555-5555-5555-5555-555555555004', '44444444-4444-4444-4444-444444444002', 'P1', 2.80, '{cocoa}', 6.8012, -1.5901, 'field_agent', 'verified', 'clear', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Organic certificates
INSERT INTO organic_certificates (id, certifier_organization_id, farmer_organization_id, farm_id, standard, crop_scope, valid_from, valid_to, issuing_authority, accreditation_reference, status) VALUES
  ('66666666-6666-6666-6666-666666666001', '11111111-1111-1111-1111-111111111003', '11111111-1111-1111-1111-111111111001', '44444444-4444-4444-4444-444444444001', 'EU_ORGANIC', '{cocoa}', '2024-03-01', '2025-02-28', 'Accredited Certifiers International', 'ACI-2024-GH-0007', 'active'),
  ('66666666-6666-6666-6666-666666666002', '11111111-1111-1111-1111-111111111003', '11111111-1111-1111-1111-111111111002', '44444444-4444-4444-4444-444444444002', 'EU_ORGANIC', '{cocoa}', '2024-01-15', '2025-01-14', 'Accredited Certifiers International', 'ACI-2024-GH-0007', 'active')
ON CONFLICT (id) DO NOTHING;

-- Harvest batches
INSERT INTO harvest_batches (id, farm_id, plot_ids, crop, harvest_date, quantity_kg, moisture_percent, grade, organic_claim_status, current_holder_id) VALUES
  ('77777777-7777-7777-7777-777777777001', '44444444-4444-4444-4444-444444444001', ARRAY['55555555-5555-5555-5555-555555555002']::UUID[], 'cocoa', '2024-10-12', 18200.000, 7.2, 'Grade A', 'attested', '11111111-1111-1111-1111-111111111004'),
  ('77777777-7777-7777-7777-777777777002', '44444444-4444-4444-4444-444444444002', ARRAY['55555555-5555-5555-5555-555555555004']::UUID[], 'cocoa', '2024-09-28', 14600.000, 6.8, 'Grade A', 'attested', '11111111-1111-1111-1111-111111111004'),
  ('77777777-7777-7777-7777-777777777003', '44444444-4444-4444-4444-444444444001', ARRAY['55555555-5555-5555-5555-555555555001','55555555-5555-5555-5555-555555555003']::UUID[], 'cocoa', '2024-09-15', 10000.000, 8.1, 'Grade B', 'pending_attestation', '11111111-1111-1111-1111-111111111004')
ON CONFLICT (id) DO NOTHING;

-- Attestations
INSERT INTO batch_attestations (id, batch_id, certificate_id, certifier_user_id, certifier_organization_id, attested_at, provenance_hash, notes) VALUES
  ('88888888-8888-8888-8888-888888888001', '77777777-7777-7777-7777-777777777001', '66666666-6666-6666-6666-666666666001', '33333333-3333-3333-3333-333333333002', '11111111-1111-1111-1111-111111111003', '2024-10-14 10:23:00+00', 'sha256:c7d1e4f2a8b19d3c7e5f0a2b4d6e8f0a2b4d6e8f0a2b4d6e8f0a2b4d6e8f0a2', 'EU Organic GH-2024-0847'),
  ('88888888-8888-8888-8888-888888888002', '77777777-7777-7777-7777-777777777002', '66666666-6666-6666-6666-666666666002', '33333333-3333-3333-3333-333333333002', '11111111-1111-1111-1111-111111111003', '2024-10-02 09:15:00+00', 'sha256:9f2ab4c1e3d7f8a0b2c4e6f8a0b2c4e6f8a0b2c4e6f8a0b2c4e6f8a0b2c4e6f', 'EU Organic GH-2024-0831')
ON CONFLICT (id) DO NOTHING;

UPDATE harvest_batches SET attestation_id='88888888-8888-8888-8888-888888888001', provenance_hash='sha256:c7d1e4f2' WHERE id='77777777-7777-7777-7777-777777777001';
UPDATE harvest_batches SET attestation_id='88888888-8888-8888-8888-888888888002', provenance_hash='sha256:9f2ab4c1' WHERE id='77777777-7777-7777-7777-777777777002';
UPDATE harvest_batches SET current_holder_id='11111111-1111-1111-1111-111111111001' WHERE id='77777777-7777-7777-7777-777777777003';

-- Holdings
INSERT INTO batch_holdings (id, batch_id, holder_organization_id, quantity_kg, warehouse_location, status) VALUES
  ('99999999-9999-9999-9999-999999999001', '77777777-7777-7777-7777-777777777001', '11111111-1111-1111-1111-111111111004', 10200.000, 'AGC-WH2, Accra', 'available'),
  ('99999999-9999-9999-9999-999999999002', '77777777-7777-7777-7777-777777777001', '11111111-1111-1111-1111-111111111004', 8000.000,  'AGC-WH2, Accra', 'committed'),
  ('99999999-9999-9999-9999-999999999003', '77777777-7777-7777-7777-777777777002', '11111111-1111-1111-1111-111111111004', 14600.000, 'AGC-WH1, Accra', 'available'),
  ('99999999-9999-9999-9999-999999999004', '77777777-7777-7777-7777-777777777003', '11111111-1111-1111-1111-111111111004', 10000.000, 'AGC-WH3, Accra', 'available')
ON CONFLICT (id) DO NOTHING;

UPDATE batch_holdings SET holder_organization_id='11111111-1111-1111-1111-111111111001' WHERE id='99999999-9999-9999-9999-999999999004';

-- Listing
INSERT INTO listings (id, seller_organization_id, holding_id, available_quantity_kg, price_per_kg, currency, incoterm, origin_location, destination_location, active) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001', '11111111-1111-1111-1111-111111111004', '99999999-9999-9999-9999-999999999001', 10200.000, 12.30, 'EUR', 'CIF', 'Tema, Ghana', 'Rotterdam, Netherlands', TRUE),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002', '11111111-1111-1111-1111-111111111004', '99999999-9999-9999-9999-999999999003', 14600.000, 12.00, 'EUR', 'FOB', 'Tema, Ghana', 'Rotterdam, Netherlands', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Offer
INSERT INTO trade_offers (id, listing_id, buyer_organization_id, quantity_kg, offered_price_per_kg, currency, valid_until, status) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001', '11111111-1111-1111-1111-111111111005', 8000.000, 12.30, 'EUR', '2024-10-25 00:00:00+00', 'accepted')
ON CONFLICT (id) DO NOTHING;

-- Contract
INSERT INTO sales_contracts (id, listing_id, offer_id, seller_organization_id, buyer_organization_id, holding_id, quantity_kg, price_per_kg, currency, incoterm, status) VALUES
  ('cccccccc-cccc-cccc-cccc-ccccccccc001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001', '11111111-1111-1111-1111-111111111004', '11111111-1111-1111-1111-111111111005', '99999999-9999-9999-9999-999999999002', 8000.000, 12.30, 'EUR', 'CIF', 'in_transit')
ON CONFLICT (id) DO NOTHING;

-- Shipment
INSERT INTO shipments (id, contract_id, logistics_organization_id, container_reference, vessel_name, bill_of_lading_number, origin_port, destination_port, eta_arrival, current_milestone) VALUES
  ('dddddddd-dddd-dddd-dddd-ddddddddd001', 'cccccccc-cccc-cccc-cccc-ccccccccc001', '11111111-1111-1111-1111-111111111006', 'MSKU8234512', 'MV Cape Harmony', 'MCL-2024-8234', 'Tema Port, Ghana', 'Port of Rotterdam, Netherlands', '2024-11-28', 'departed')
ON CONFLICT (id) DO NOTHING;

-- Milestones
INSERT INTO shipment_milestones (shipment_id, milestone, recorded_by_user_id, recorded_at, location, notes) VALUES
  ('dddddddd-dddd-dddd-dddd-ddddddddd001', 'accepted',      '33333333-3333-3333-3333-333333333005', '2024-10-28 08:00:00+00', 'Accra, Ghana',   'Shipment accepted'),
  ('dddddddd-dddd-dddd-dddd-ddddddddd001', 'picked_up',     '33333333-3333-3333-3333-333333333005', '2024-10-30 07:30:00+00', 'AGC-WH2, Accra', 'Cargo collected'),
  ('dddddddd-dddd-dddd-dddd-ddddddddd001', 'port_received', '33333333-3333-3333-3333-333333333005', '2024-11-01 14:00:00+00', 'Tema Port',      'At terminal'),
  ('dddddddd-dddd-dddd-dddd-ddddddddd001', 'loaded',        '33333333-3333-3333-3333-333333333005', '2024-11-03 16:00:00+00', 'Tema Port',      'Container loaded'),
  ('dddddddd-dddd-dddd-dddd-ddddddddd001', 'departed',      '33333333-3333-3333-3333-333333333005', '2024-11-04 06:00:00+00', 'Tema Port',      'Vessel departed');

-- Payment request
INSERT INTO payment_requests (id, contract_id, requested_by_organization_id, amount_total, currency, status) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeee001', 'cccccccc-cccc-cccc-cccc-ccccccccc001', '11111111-1111-1111-1111-111111111004', 98400.00, 'EUR', 'requested')
ON CONFLICT (id) DO NOTHING;

-- Sample evidence
INSERT INTO evidence_items (id, uploader_user_id, uploader_organization_id, type, file_name, sha256_hash, storage_path, review_status, linked_entity_type, linked_entity_id, claim_description) VALUES
  ('ffffffff-ffff-ffff-ffff-fffffffffff1', '33333333-3333-3333-3333-333333333002', '11111111-1111-1111-1111-111111111003', 'certificate_pdf', 'OC-GH-2248.pdf', 'sha256:c7d1e4f2a8b1', 'evidence/cert-001.pdf', 'approved', 'batch', '77777777-7777-7777-7777-777777777001', 'EU Organic certificate'),
  ('ffffffff-ffff-ffff-ffff-fffffffffff2', '33333333-3333-3333-3333-333333333003', '11111111-1111-1111-1111-111111111004', 'weighing_ticket', 'AGC-WT-20241012.pdf', 'sha256:4b1c7e3d9a2f', 'evidence/wt-001.pdf', 'approved', 'batch', '77777777-7777-7777-7777-777777777001', 'Weighing ticket on harvest'),
  ('ffffffff-ffff-ffff-ffff-fffffffffff3', '33333333-3333-3333-3333-333333333005', '11111111-1111-1111-1111-111111111006', 'bill_of_lading', 'MCL-2024-8234.pdf', 'sha256:2f9ab4c1e3d7', 'evidence/bol-001.pdf', 'approved', 'shipment', 'dddddddd-dddd-dddd-dddd-ddddddddd001', 'Bill of lading')
ON CONFLICT (id) DO NOTHING;

-- Audit events
INSERT INTO audit_events (actor_user_id, actor_organization_id, action, entity_type, entity_id, new_state_hash, occurred_at) VALUES
  ('33333333-3333-3333-3333-333333333001', '11111111-1111-1111-1111-111111111001', 'batch.create', 'harvest_batch', '77777777-7777-7777-7777-777777777001', 'sha256:batch_create_001', '2024-10-12 08:00:00+00'),
  ('33333333-3333-3333-3333-333333333002', '11111111-1111-1111-1111-111111111003', 'batch.attest', 'harvest_batch', '77777777-7777-7777-7777-777777777001', 'sha256:c7d1e4f2a8b1', '2024-10-14 10:23:00+00'),
  ('33333333-3333-3333-3333-333333333003', '11111111-1111-1111-1111-111111111004', 'listing.create', 'listing', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001', 'sha256:listing_001', '2024-10-20 09:00:00+00'),
  ('33333333-3333-3333-3333-333333333004', '11111111-1111-1111-1111-111111111005', 'offer.create', 'trade_offer', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001', 'sha256:offer_001', '2024-10-21 14:30:00+00'),
  ('33333333-3333-3333-3333-333333333003', '11111111-1111-1111-1111-111111111004', 'contract.create', 'sales_contract', 'cccccccc-cccc-cccc-cccc-ccccccccc001', 'sha256:contract_001', '2024-10-22 10:00:00+00'),
  ('33333333-3333-3333-3333-333333333005', '11111111-1111-1111-1111-111111111006', 'shipment.accept', 'shipment', 'dddddddd-dddd-dddd-dddd-ddddddddd001', 'sha256:shipment_001', '2024-10-28 08:00:00+00');
