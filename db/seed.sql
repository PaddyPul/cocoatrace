-- CocoaTrace coherent demo data - Ghana to Netherlands Corridor, 2026
-- Passwords are all: Password123!

-- Organizations
INSERT INTO organizations (id, name, type, jurisdiction, verification_status) VALUES
  ('11111111-1111-1111-1111-111111111001', 'Asante Family Farm',   'farmer',     'GH', 'verified'),
  ('11111111-1111-1111-1111-111111111002', 'Ashanti Growers Cooperative','cooperative','GH', 'verified'),
  ('11111111-1111-1111-1111-111111111003', 'OrganicCert Ghana',    'certifier',  'GH', 'verified'),
  ('11111111-1111-1111-1111-111111111004', 'Akwaaba Cocoa Exports','exporter',   'GH', 'verified'),
  ('11111111-1111-1111-1111-111111111005', 'Northstar Foods B.V.', 'importer',   'NL', 'verified'),
  ('11111111-1111-1111-1111-111111111006', 'MareCargo Logistics',  'logistics',  'GH', 'verified'),
  ('11111111-1111-1111-1111-111111111007', 'Ghana Cocoa Oversight','regulator',  'GH', 'verified'),
  ('11111111-1111-1111-1111-111111111008', 'Platform Admin',       'admin',      'GH', 'verified'),
  ('11111111-1111-1111-1111-111111111009', 'New Buyer Workspace',  'importer',   'NL', 'verified'),
  ('11111111-1111-1111-1111-111111111010', 'New Supplier Workspace','exporter',  'GH', 'verified')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, type=EXCLUDED.type,
  jurisdiction=EXCLUDED.jurisdiction, verification_status=EXCLUDED.verification_status;

-- Roles
INSERT INTO roles (id, name, permissions) VALUES
  ('22222222-2222-2222-2222-222222222001', 'farmer',    ARRAY['farm.read','farm.create','batch.read','batch.create','holding.read','listing.read','listing.create','offer.respond','custody.transfer.request','custody.transfer.accept','payment.read','contract.read']),
  ('22222222-2222-2222-2222-222222222002', 'certifier', ARRAY['certificate.read','certificate.issue','batch.read','batch.attest','farm.read','evidence.read','evidence.upload']),
  ('22222222-2222-2222-2222-222222222003', 'exporter',  ARRAY['batch.read','batch.create','holding.read','holding.create','listing.read','listing.create','offer.respond','contract.read','shipment.read','shipment.request','payment.read','payment.request','evidence.read','evidence.upload','recall.manage','member.invite']),
  ('22222222-2222-2222-2222-222222222004', 'importer',  ARRAY['listing.read','offer.create','contract.read','shipment.read','payment.read','payment.confirm','evidence.read','evidence.upload','provenance.export','batch.read','farm.read','certificate.read']),
  ('22222222-2222-2222-2222-222222222005', 'logistics', ARRAY['shipment.read','shipment.accept','shipment.update','evidence.read','evidence.upload','batch.read','contract.read','farm.read']),
  ('22222222-2222-2222-2222-222222222006', 'regulator', ARRAY['audit.read','farm.read','batch.read','certificate.read','evidence.read','provenance.export','audit.export','recall.manage','recall.manage.all']),
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
  ('33333333-3333-3333-3333-333333333007', '11111111-1111-1111-1111-111111111008', 'admin@cocoatrace.io', '$2a$10$abcdefghijklmnopqrstuOhXyMYaX/8YjwfNIE6V8qEexU4z5Vgka', 'Platform Admin'),
  ('33333333-3333-3333-3333-333333333008', '11111111-1111-1111-1111-111111111004', 'pilot@cocoatrace.io', '$2a$10$abcdefghijklmnopqrstuOhXyMYaX/8YjwfNIE6V8qEexU4z5Vgka', 'Pilot Manager'),
  ('33333333-3333-3333-3333-333333333009', '11111111-1111-1111-1111-111111111009', 'newbuyer@cocoatrace.io', '$2a$10$abcdefghijklmnopqrstuOhXyMYaX/8YjwfNIE6V8qEexU4z5Vgka', 'New Buyer'),
  ('33333333-3333-3333-3333-333333333010', '11111111-1111-1111-1111-111111111010', 'newsupplier@cocoatrace.io', '$2a$10$abcdefghijklmnopqrstuOhXyMYaX/8YjwfNIE6V8qEexU4z5Vgka', 'New Supplier')
ON CONFLICT (id) DO UPDATE SET organization_id=EXCLUDED.organization_id,
  email=EXCLUDED.email, password_hash=EXCLUDED.password_hash, name=EXCLUDED.name;

-- User roles
INSERT INTO user_roles (user_id, role_id) VALUES
  ('33333333-3333-3333-3333-333333333001', '22222222-2222-2222-2222-222222222001'),
  ('33333333-3333-3333-3333-333333333002', '22222222-2222-2222-2222-222222222002'),
  ('33333333-3333-3333-3333-333333333003', '22222222-2222-2222-2222-222222222003'),
  ('33333333-3333-3333-3333-333333333004', '22222222-2222-2222-2222-222222222004'),
  ('33333333-3333-3333-3333-333333333005', '22222222-2222-2222-2222-222222222005'),
  ('33333333-3333-3333-3333-333333333006', '22222222-2222-2222-2222-222222222006'),
  ('33333333-3333-3333-3333-333333333007', '22222222-2222-2222-2222-222222222007'),
  ('33333333-3333-3333-3333-333333333008', '22222222-2222-2222-2222-222222222003'),
  ('33333333-3333-3333-3333-333333333009', '22222222-2222-2222-2222-222222222004'),
  ('33333333-3333-3333-3333-333333333010', '22222222-2222-2222-2222-222222222003')
ON CONFLICT DO NOTHING;

-- Existing demo accounts skip first-run onboarding. The isolated buyer and
-- supplier workspaces intentionally start fresh and contain no inherited data.
INSERT INTO user_onboarding (user_id, status, current_step, primary_goal, pilot_mode, completed_at)
SELECT id, 'completed', 4, 'demo_workspace', TRUE, NOW()
FROM users WHERE id IN (
  '33333333-3333-3333-3333-333333333001','33333333-3333-3333-3333-333333333002',
  '33333333-3333-3333-3333-333333333003','33333333-3333-3333-3333-333333333004',
  '33333333-3333-3333-3333-333333333005','33333333-3333-3333-3333-333333333006',
  '33333333-3333-3333-3333-333333333007','33333333-3333-3333-3333-333333333008'
) ON CONFLICT (user_id) DO UPDATE SET status='completed',current_step=4,
  primary_goal='demo_workspace',pilot_mode=TRUE,completed_at=NOW(),updated_at=NOW();

DELETE FROM user_onboarding WHERE user_id IN (
  '33333333-3333-3333-3333-333333333009',
  '33333333-3333-3333-3333-333333333010'
);

-- The two new-customer accounts intentionally have no onboarding row. Signing
-- in shows the complete first-run buyer or supplier experience.

INSERT INTO sourcing_requests (
  id,buyer_organization_id,created_by_user_id,title,commodity,quantity_kg,
  origin_countries,quality_requirements,assurance_requirements,delivery_location,
  incoterm,required_by,offer_deadline,visibility,status
) VALUES (
  '18181818-1818-1818-1818-181818181801',
  '11111111-1111-1111-1111-111111111005',
  '33333333-3333-3333-3333-333333333004',
  'Organic cocoa for Rotterdam · Q4 2026','cocoa',20000,
  ARRAY['GH'],
  '{"fermentation":"fully fermented","moistureMax":7.5,"cropYear":2026}'::jsonb,
  '{"euOrganic":true,"plotGeolocation":true,"eudrDataPack":true}'::jsonb,
  'Rotterdam, Netherlands','CIF','2026-11-15','2026-09-30 17:00:00+00','matched','open'
) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,status=EXCLUDED.status,updated_at=NOW();

-- Farms
INSERT INTO farms (id, farmer_organization_id, cooperative_organization_id, name, country, region, district, community, official_traceability_id, verification_status) VALUES
  ('44444444-4444-4444-4444-444444444001', '11111111-1111-1111-1111-111111111001', '11111111-1111-1111-1111-111111111002', 'Asante Family Farm', 'GH', 'Ashanti', 'Amansie West', 'Kwabre', 'COCOBOD-0423-A', 'verified'),
  ('44444444-4444-4444-4444-444444444002', '11111111-1111-1111-1111-111111111002', NULL, 'Adansi Cooperative Plot', 'GH', 'Ashanti', 'Kwabre East', 'Adansi', 'GCTS-2026-0831-B', 'verified'),
  ('44444444-4444-4444-4444-444444444003', '11111111-1111-1111-1111-111111111002', NULL, 'Beposo Demonstration Plot', 'GH', 'Ashanti', 'Bekwai', 'Beposo', 'GCTS-2026-0917-C', 'verified')
ON CONFLICT (id) DO UPDATE SET farmer_organization_id=EXCLUDED.farmer_organization_id,
  cooperative_organization_id=EXCLUDED.cooperative_organization_id,name=EXCLUDED.name,
  country=EXCLUDED.country,region=EXCLUDED.region,district=EXCLUDED.district,
  community=EXCLUDED.community,official_traceability_id=EXCLUDED.official_traceability_id,
  verification_status=EXCLUDED.verification_status;

-- Farm plots
INSERT INTO farm_plots (id, farm_id, plot_code, area_hectares, crops, gps_lat, gps_lng, geolocation_source, verification_status, deforestation_risk_status, eudr_cutoff_checked) VALUES
  ('55555555-5555-5555-5555-555555555001', '44444444-4444-4444-4444-444444444001', 'A1', 2.40, '{cocoa}', 6.7341, -1.6122, 'field_agent', 'verified', 'clear', TRUE),
  ('55555555-5555-5555-5555-555555555002', '44444444-4444-4444-4444-444444444001', 'A2', 1.85, '{cocoa}', 6.7289, -1.6088, 'field_agent', 'verified', 'clear', TRUE),
  ('55555555-5555-5555-5555-555555555003', '44444444-4444-4444-4444-444444444002', 'C1', 2.10, '{cocoa}', NULL, NULL, 'supplier_submitted', 'pending', NULL, FALSE),
  ('55555555-5555-5555-5555-555555555004', '44444444-4444-4444-4444-444444444003', 'I1', 2.80, '{cocoa}', 6.8012, -1.5901, 'field_agent', 'verified', 'clear', TRUE)
ON CONFLICT (id) DO UPDATE SET farm_id=EXCLUDED.farm_id,plot_code=EXCLUDED.plot_code,
  area_hectares=EXCLUDED.area_hectares,crops=EXCLUDED.crops,gps_lat=EXCLUDED.gps_lat,
  gps_lng=EXCLUDED.gps_lng,geolocation_source=EXCLUDED.geolocation_source,
  verification_status=EXCLUDED.verification_status,
  deforestation_risk_status=EXCLUDED.deforestation_risk_status,
  eudr_cutoff_checked=EXCLUDED.eudr_cutoff_checked;

-- Organic certificates
INSERT INTO organic_certificates (id, certifier_organization_id, farmer_organization_id, farm_id, standard, crop_scope, valid_from, valid_to, issuing_authority, accreditation_reference, status) VALUES
  ('66666666-6666-6666-6666-666666666001', '11111111-1111-1111-1111-111111111003', '11111111-1111-1111-1111-111111111001', '44444444-4444-4444-4444-444444444001', 'EU_ORGANIC', '{cocoa}', '2026-01-01', '2027-12-31', 'OrganicCert Ghana', 'OCG-2026-GH-0042', 'active'),
  ('66666666-6666-6666-6666-666666666002', '11111111-1111-1111-1111-111111111003', '11111111-1111-1111-1111-111111111002', '44444444-4444-4444-4444-444444444002', 'EU_ORGANIC', '{cocoa}', '2026-01-01', '2027-12-31', 'OrganicCert Ghana', 'OCG-2026-GH-0083', 'active')
ON CONFLICT (id) DO UPDATE SET farmer_organization_id=EXCLUDED.farmer_organization_id,
  farm_id=EXCLUDED.farm_id,valid_from=EXCLUDED.valid_from,valid_to=EXCLUDED.valid_to,
  issuing_authority=EXCLUDED.issuing_authority,
  accreditation_reference=EXCLUDED.accreditation_reference,status=EXCLUDED.status;

-- Harvest batches
INSERT INTO harvest_batches (id, farm_id, plot_ids, crop, harvest_date, quantity_kg, moisture_percent, grade, organic_claim_status, current_holder_id) VALUES
  ('77777777-7777-7777-7777-777777777001', '44444444-4444-4444-4444-444444444001', ARRAY['55555555-5555-5555-5555-555555555001','55555555-5555-5555-5555-555555555002']::UUID[], 'cocoa', '2026-07-18', 12000.000, 7.1, 'Grade A', 'attested', '11111111-1111-1111-1111-111111111004'),
  ('77777777-7777-7777-7777-777777777002', '44444444-4444-4444-4444-444444444002', ARRAY['55555555-5555-5555-5555-555555555003']::UUID[], 'cocoa', '2026-08-03', 9000.000, 7.3, 'Grade A', 'attested', '11111111-1111-1111-1111-111111111004'),
  ('77777777-7777-7777-7777-777777777003', '44444444-4444-4444-4444-444444444003', ARRAY['55555555-5555-5555-5555-555555555004']::UUID[], 'cocoa', '2026-06-12', 6000.000, 6.9, 'Grade A', 'none', '11111111-1111-1111-1111-111111111005')
ON CONFLICT (id) DO UPDATE SET farm_id=EXCLUDED.farm_id,plot_ids=EXCLUDED.plot_ids,
  harvest_date=EXCLUDED.harvest_date,quantity_kg=EXCLUDED.quantity_kg,
  moisture_percent=EXCLUDED.moisture_percent,grade=EXCLUDED.grade,
  organic_claim_status=EXCLUDED.organic_claim_status,current_holder_id=EXCLUDED.current_holder_id;

-- Attestations
INSERT INTO batch_attestations (id, batch_id, certificate_id, certifier_user_id, certifier_organization_id, attested_at, provenance_hash, notes) VALUES
  ('88888888-8888-8888-8888-888888888001', '77777777-7777-7777-7777-777777777001', '66666666-6666-6666-6666-666666666001', '33333333-3333-3333-3333-333333333002', '11111111-1111-1111-1111-111111111003', '2026-07-21 10:00:00+00', 'sha256:ready2026', 'EU Organic scope and harvest record reviewed'),
  ('88888888-8888-8888-8888-888888888002', '77777777-7777-7777-7777-777777777002', '66666666-6666-6666-6666-666666666002', '33333333-3333-3333-3333-333333333002', '11111111-1111-1111-1111-111111111003', '2026-08-06 09:00:00+00', 'sha256:action2026', 'Organic scope verified; plot geolocation remains incomplete')
ON CONFLICT (id) DO UPDATE SET batch_id=EXCLUDED.batch_id,certificate_id=EXCLUDED.certificate_id,
  attested_at=EXCLUDED.attested_at,provenance_hash=EXCLUDED.provenance_hash,notes=EXCLUDED.notes;

UPDATE harvest_batches SET attestation_id='88888888-8888-8888-8888-888888888001', provenance_hash='sha256:ready2026' WHERE id='77777777-7777-7777-7777-777777777001';
UPDATE harvest_batches SET attestation_id='88888888-8888-8888-8888-888888888002', provenance_hash='sha256:action2026' WHERE id='77777777-7777-7777-7777-777777777002';
UPDATE harvest_batches SET attestation_id=NULL, provenance_hash='sha256:incident2026' WHERE id='77777777-7777-7777-7777-777777777003';

-- Holdings
INSERT INTO batch_holdings (id, batch_id, holder_organization_id, quantity_kg, warehouse_location, status) VALUES
  ('99999999-9999-9999-9999-999999999001', '77777777-7777-7777-7777-777777777001', '11111111-1111-1111-1111-111111111004', 4000.000, 'AKC-WH1, Tema', 'available'),
  ('99999999-9999-9999-9999-999999999002', '77777777-7777-7777-7777-777777777001', '11111111-1111-1111-1111-111111111004', 8000.000, 'AKC-WH1, Tema', 'committed'),
  ('99999999-9999-9999-9999-999999999003', '77777777-7777-7777-7777-777777777002', '11111111-1111-1111-1111-111111111004', 9000.000, 'AKC-WH2, Tema', 'available'),
  ('99999999-9999-9999-9999-999999999004', '77777777-7777-7777-7777-777777777003', '11111111-1111-1111-1111-111111111005', 6000.000, 'NSF-PROC1, Rotterdam', 'consumed')
ON CONFLICT (id) DO UPDATE SET batch_id=EXCLUDED.batch_id,
  holder_organization_id=EXCLUDED.holder_organization_id,quantity_kg=EXCLUDED.quantity_kg,
  warehouse_location=EXCLUDED.warehouse_location,status=EXCLUDED.status;

-- Listing
INSERT INTO listings (id, seller_organization_id, holding_id, available_quantity_kg, price_per_kg, currency, incoterm, origin_location, destination_location, active) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001', '11111111-1111-1111-1111-111111111004', '99999999-9999-9999-9999-999999999002', 8000.000, 8.40, 'EUR', 'CIF', 'Tema, Ghana', 'Rotterdam, Netherlands', FALSE),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002', '11111111-1111-1111-1111-111111111004', '99999999-9999-9999-9999-999999999001', 4000.000, 8.55, 'EUR', 'CIF', 'Tema, Ghana', 'Rotterdam, Netherlands', TRUE),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003', '11111111-1111-1111-1111-111111111004', '99999999-9999-9999-9999-999999999003', 9000.000, 8.20, 'EUR', 'FOB', 'Tema, Ghana', 'Rotterdam, Netherlands', TRUE)
ON CONFLICT (id) DO UPDATE SET holding_id=EXCLUDED.holding_id,
  available_quantity_kg=EXCLUDED.available_quantity_kg,price_per_kg=EXCLUDED.price_per_kg,
  currency=EXCLUDED.currency,incoterm=EXCLUDED.incoterm,
  origin_location=EXCLUDED.origin_location,destination_location=EXCLUDED.destination_location,
  active=EXCLUDED.active;

-- Offer
INSERT INTO trade_offers (id, listing_id, buyer_organization_id, quantity_kg, offered_price_per_kg, currency, valid_until, status) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001', '11111111-1111-1111-1111-111111111005', 8000.000, 8.40, 'EUR', '2026-09-30 17:00:00+00', 'accepted')
ON CONFLICT (id) DO UPDATE SET listing_id=EXCLUDED.listing_id,
  buyer_organization_id=EXCLUDED.buyer_organization_id,quantity_kg=EXCLUDED.quantity_kg,
  offered_price_per_kg=EXCLUDED.offered_price_per_kg,currency=EXCLUDED.currency,
  valid_until=EXCLUDED.valid_until,status=EXCLUDED.status;

-- Contract
INSERT INTO sales_contracts (id, listing_id, offer_id, seller_organization_id, buyer_organization_id, holding_id, quantity_kg, price_per_kg, currency, incoterm, status) VALUES
  ('cccccccc-cccc-cccc-cccc-ccccccccc001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001', '11111111-1111-1111-1111-111111111004', '11111111-1111-1111-1111-111111111005', '99999999-9999-9999-9999-999999999002', 8000.000, 8.40, 'EUR', 'CIF', 'in_transit')
ON CONFLICT (id) DO UPDATE SET holding_id=EXCLUDED.holding_id,quantity_kg=EXCLUDED.quantity_kg,
  price_per_kg=EXCLUDED.price_per_kg,currency=EXCLUDED.currency,
  incoterm=EXCLUDED.incoterm,status=EXCLUDED.status;

-- Shipment
INSERT INTO shipments (id, contract_id, logistics_organization_id, container_reference, vessel_name, bill_of_lading_number, origin_port, destination_port, eta_arrival, current_milestone) VALUES
  ('dddddddd-dddd-dddd-dddd-ddddddddd001', 'cccccccc-cccc-cccc-cccc-ccccccccc001', '11111111-1111-1111-1111-111111111006', 'MSKU2609421', 'MV Atlantic Bridge', 'MCL-2026-0942', 'Tema Port, Ghana', 'Port of Rotterdam, Netherlands', '2026-10-02', 'departed')
ON CONFLICT (id) DO UPDATE SET logistics_organization_id=EXCLUDED.logistics_organization_id,
  container_reference=EXCLUDED.container_reference,vessel_name=EXCLUDED.vessel_name,
  bill_of_lading_number=EXCLUDED.bill_of_lading_number,origin_port=EXCLUDED.origin_port,
  destination_port=EXCLUDED.destination_port,eta_arrival=EXCLUDED.eta_arrival,
  current_milestone=EXCLUDED.current_milestone,delivered_at=NULL;

-- Milestones
DELETE FROM shipment_milestones WHERE shipment_id='dddddddd-dddd-dddd-dddd-ddddddddd001';
INSERT INTO shipment_milestones (shipment_id, milestone, recorded_by_user_id, recorded_at, location, notes) VALUES
  ('dddddddd-dddd-dddd-dddd-ddddddddd001', 'accepted',      '33333333-3333-3333-3333-333333333005', '2026-09-12 09:00:00+00', 'Tema, Ghana',   'Carrier accepted the shipment'),
  ('dddddddd-dddd-dddd-dddd-ddddddddd001', 'picked_up',     '33333333-3333-3333-3333-333333333005', '2026-09-14 07:30:00+00', 'AKC-WH1, Tema', 'Sealed cargo collected'),
  ('dddddddd-dddd-dddd-dddd-ddddddddd001', 'port_received', '33333333-3333-3333-3333-333333333005', '2026-09-16 14:00:00+00', 'Tema Port',      'Container received at terminal'),
  ('dddddddd-dddd-dddd-dddd-ddddddddd001', 'departed',      '33333333-3333-3333-3333-333333333005', '2026-09-18 06:00:00+00', 'Tema Port',      'Vessel departed for Rotterdam');

-- Payment request
INSERT INTO payment_requests (id, contract_id, requested_by_organization_id, amount_total, currency, status) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeee001', 'cccccccc-cccc-cccc-cccc-ccccccccc001', '11111111-1111-1111-1111-111111111004', 67200.00, 'EUR', 'requested')
ON CONFLICT (id) DO UPDATE SET amount_total=EXCLUDED.amount_total,currency=EXCLUDED.currency,
  status=EXCLUDED.status,payment_reference_external=NULL,settled_at=NULL;

-- Stable chronology keeps the demo believable even after a later reset.
UPDATE sourcing_requests SET created_at='2026-09-04 09:00:00+00',updated_at='2026-09-04 09:00:00+00'
  WHERE id='18181818-1818-1818-1818-181818181801';
UPDATE listings SET created_at=CASE id
  WHEN 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001' THEN '2026-08-25 09:00:00+00'::timestamptz
  WHEN 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002' THEN '2026-09-05 09:00:00+00'::timestamptz
  ELSE '2026-09-06 09:00:00+00'::timestamptz END
  WHERE id IN ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003');
UPDATE trade_offers SET created_at='2026-09-08 14:30:00+00'
  WHERE id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001';
UPDATE sales_contracts SET created_at='2026-09-10 10:00:00+00'
  WHERE id='cccccccc-cccc-cccc-cccc-ccccccccc001';
UPDATE shipments SET created_at='2026-09-12 08:00:00+00'
  WHERE id='dddddddd-dddd-dddd-dddd-ddddddddd001';
UPDATE payment_requests SET created_at='2026-09-10 11:00:00+00'
  WHERE id='eeeeeeee-eeee-eeee-eeee-eeeeeeeee001';

-- Sample evidence
INSERT INTO evidence_items (id, uploader_user_id, uploader_organization_id, type, file_name, sha256_hash, storage_path, review_status, linked_entity_type, linked_entity_id, claim_description) VALUES
  ('ffffffff-ffff-ffff-ffff-fffffffffff1', '33333333-3333-3333-3333-333333333002', '11111111-1111-1111-1111-111111111003', 'certificate_pdf', 'OCG-2026-GH-0042.pdf', 'sha256:certready2026', 'evidence/2026/cert-ready.pdf', 'approved', 'batch', '77777777-7777-7777-7777-777777777001', 'Valid EU Organic certificate'),
  ('ffffffff-ffff-ffff-ffff-fffffffffff2', '33333333-3333-3333-3333-333333333003', '11111111-1111-1111-1111-111111111004', 'weighing_ticket', 'AKC-WT-20260718.pdf', 'sha256:weightready2026', 'evidence/2026/weight-ready.pdf', 'approved', 'batch', '77777777-7777-7777-7777-777777777001', 'Warehouse intake and weighing ticket'),
  ('ffffffff-ffff-ffff-ffff-fffffffffff3', '33333333-3333-3333-3333-333333333005', '11111111-1111-1111-1111-111111111006', 'bill_of_lading', 'MCL-2026-0942.pdf', 'sha256:bol2026', 'evidence/2026/bol-0942.pdf', 'approved', 'shipment', 'dddddddd-dddd-dddd-dddd-ddddddddd001', 'Bill of lading for the contracted lot')
ON CONFLICT (id) DO UPDATE SET file_name=EXCLUDED.file_name,sha256_hash=EXCLUDED.sha256_hash,
  storage_path=EXCLUDED.storage_path,review_status=EXCLUDED.review_status,
  linked_entity_type=EXCLUDED.linked_entity_type,linked_entity_id=EXCLUDED.linked_entity_id,
  claim_description=EXCLUDED.claim_description;

-- Audit events
DELETE FROM audit_events WHERE entity_id IN (
  '77777777-7777-7777-7777-777777777001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001','cccccccc-cccc-cccc-cccc-ccccccccc001',
  'dddddddd-dddd-dddd-dddd-ddddddddd001'
);
INSERT INTO audit_events (actor_user_id, actor_organization_id, action, entity_type, entity_id, new_state_hash, occurred_at) VALUES
  ('33333333-3333-3333-3333-333333333001', '11111111-1111-1111-1111-111111111001', 'batch.create', 'harvest_batch', '77777777-7777-7777-7777-777777777001', 'sha256:batch-ready-2026', '2026-07-18 08:00:00+00'),
  ('33333333-3333-3333-3333-333333333002', '11111111-1111-1111-1111-111111111003', 'batch.attest', 'harvest_batch', '77777777-7777-7777-7777-777777777001', 'sha256:ready2026', '2026-07-21 10:00:00+00'),
  ('33333333-3333-3333-3333-333333333003', '11111111-1111-1111-1111-111111111004', 'listing.create', 'listing', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001', 'sha256:listing-ready-2026', '2026-08-25 09:00:00+00'),
  ('33333333-3333-3333-3333-333333333004', '11111111-1111-1111-1111-111111111005', 'offer.create', 'trade_offer', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001', 'sha256:offer-ready-2026', '2026-09-08 14:30:00+00'),
  ('33333333-3333-3333-3333-333333333003', '11111111-1111-1111-1111-111111111004', 'contract.create', 'sales_contract', 'cccccccc-cccc-cccc-cccc-ccccccccc001', 'sha256:contract-ready-2026', '2026-09-10 10:00:00+00'),
  ('33333333-3333-3333-3333-333333333005', '11111111-1111-1111-1111-111111111006', 'shipment.departed', 'shipment', 'dddddddd-dddd-dddd-dddd-ddddddddd001', 'sha256:shipment-ready-2026', '2026-09-18 06:00:00+00');

-- Public QR product profiles
INSERT INTO product_profiles (id, batch_id, slug, display_name, brand_name, description, lot_code, visibility, published_at) VALUES
  ('12121212-1212-1212-1212-121212121201', '77777777-7777-7777-7777-777777777001', 'akwaaba-cocoa-2026-ready', 'Akwaaba Cocoa · Export Lot 042', 'Akwaaba Cocoa Exports', 'A buyer-facing export lot connecting verified origin, current organic evidence, custody and shipment status.', 'GH-2026-0042', 'published', '2026-09-12 09:00:00+00'),
  ('12121212-1212-1212-1212-121212121202', '77777777-7777-7777-7777-777777777003', 'cocoatrace-demo-incident-2026', 'Demonstration Incident · Lot 0917', 'Northstar Foods B.V.', 'An isolated demonstration record showing how an already-distributed lot changes to a warning after a quality incident. It is not available for trade.', 'GH-2026-0917', 'published', '2026-09-02 09:00:00+00')
ON CONFLICT (id) DO UPDATE SET
  batch_id = EXCLUDED.batch_id,
  slug = EXCLUDED.slug,
  display_name = EXCLUDED.display_name,
  brand_name = EXCLUDED.brand_name,
  description = EXCLUDED.description,
  lot_code = EXCLUDED.lot_code,
  visibility = EXCLUDED.visibility,
  published_at = EXCLUDED.published_at,
  updated_at = NOW();

-- Deliberately marked as demo data. This makes the recall experience testable
-- without implying that any real product or organization has a safety issue.
INSERT INTO recall_notices (id, reference_code, title, reason, instructions, severity, status, initiated_by_user_id, initiated_by_organization_id, initiated_at) VALUES
  ('13131313-1313-1313-1313-131313131301', 'DEMO-INCIDENT-2026-001', 'Demonstration quality recall', 'Demo only: retained-sample testing identified moisture-related spoilage after distribution.', 'Do not use or distribute the affected demonstration lots. Quarantine stock and contact the recorded supplier.', 'warning', 'active', '33333333-3333-3333-3333-333333333006', '11111111-1111-1111-1111-111111111007', '2026-09-20 10:00:00+00')
ON CONFLICT (id) DO UPDATE SET
  reference_code = EXCLUDED.reference_code,
  title = EXCLUDED.title,
  reason = EXCLUDED.reason,
  instructions = EXCLUDED.instructions,
  severity = EXCLUDED.severity,
  status = EXCLUDED.status;

DELETE FROM recall_affected_batches WHERE recall_id='13131313-1313-1313-1313-131313131301';
INSERT INTO recall_affected_batches (recall_id, batch_id) VALUES
  ('13131313-1313-1313-1313-131313131301', '77777777-7777-7777-7777-777777777003');

-- Quantity-aware genealogy demonstration. The declared edge quantity is the
-- exact source input assigned to a particular output lot.
INSERT INTO material_lots (id, lot_code, lot_type, batch_id, product_name, quantity_kg, owner_organization_id, status, produced_at) VALUES
  ('14141414-1414-1414-1414-141414141401', 'GH-2026-0042', 'source', '77777777-7777-7777-7777-777777777001', 'Cocoa beans', 12000, '11111111-1111-1111-1111-111111111004', 'available', '2026-07-18 08:00:00+00'),
  ('14141414-1414-1414-1414-141414141402', 'GH-2026-0917', 'source', '77777777-7777-7777-7777-777777777003', 'Cocoa beans', 6000, '11111111-1111-1111-1111-111111111005', 'recalled', '2026-06-12 08:00:00+00'),
  ('14141414-1414-1414-1414-141414141403', 'NL-LIQUOR-2026-0820', 'production', NULL, 'Cocoa liquor', 4000, '11111111-1111-1111-1111-111111111005', 'consumed', '2026-08-20 09:00:00+00'),
  ('14141414-1414-1414-1414-141414141404', 'NL-BUTTER-2026-0821', 'production', NULL, 'Cocoa butter', 1200, '11111111-1111-1111-1111-111111111005', 'available', '2026-08-21 09:00:00+00'),
  ('14141414-1414-1414-1414-141414141405', 'NL-CHOCO-2026-A', 'packaging', NULL, 'Dark chocolate 70%', 1800, '11111111-1111-1111-1111-111111111005', 'recalled', '2026-08-25 11:00:00+00'),
  ('14141414-1414-1414-1414-141414141406', 'NL-CHOCO-2026-B', 'packaging', NULL, 'Dark chocolate 70%', 1700, '11111111-1111-1111-1111-111111111005', 'recalled', '2026-08-25 14:00:00+00')
ON CONFLICT (id) DO UPDATE SET lot_code=EXCLUDED.lot_code,batch_id=EXCLUDED.batch_id,
  product_name=EXCLUDED.product_name,quantity_kg=EXCLUDED.quantity_kg,
  owner_organization_id=EXCLUDED.owner_organization_id,status=EXCLUDED.status,
  produced_at=EXCLUDED.produced_at;

INSERT INTO transformation_events (id, event_code, event_type, facility_organization_id, occurred_at, notes) VALUES
  ('15151515-1515-1515-1515-151515151501', 'BLEND-RTM-2026-0820', 'blend', '11111111-1111-1111-1111-111111111005', '2026-08-20 09:00:00+00', 'Declared source allocation for cocoa liquor'),
  ('15151515-1515-1515-1515-151515151502', 'PRESS-RTM-2026-0821', 'process', '11111111-1111-1111-1111-111111111005', '2026-08-21 09:00:00+00', 'Cocoa butter press run'),
  ('15151515-1515-1515-1515-151515151503', 'PACK-RTM-2026-0825', 'package', '11111111-1111-1111-1111-111111111005', '2026-08-25 10:00:00+00', 'Two finished packaging lots')
ON CONFLICT (id) DO UPDATE SET event_code=EXCLUDED.event_code,event_type=EXCLUDED.event_type,
  facility_organization_id=EXCLUDED.facility_organization_id,
  occurred_at=EXCLUDED.occurred_at,notes=EXCLUDED.notes;

INSERT INTO lot_genealogy_edges (id, transformation_event_id, source_lot_id, destination_lot_id, allocated_input_kg, allocation_method) VALUES
  ('16161616-1616-1616-1616-161616161601', '15151515-1515-1515-1515-151515151501', '14141414-1414-1414-1414-141414141402', '14141414-1414-1414-1414-141414141403', 4000, 'declared'),
  ('16161616-1616-1616-1616-161616161602', '15151515-1515-1515-1515-151515151502', '14141414-1414-1414-1414-141414141402', '14141414-1414-1414-1414-141414141404', 1500, 'declared'),
  ('16161616-1616-1616-1616-161616161603', '15151515-1515-1515-1515-151515151503', '14141414-1414-1414-1414-141414141403', '14141414-1414-1414-1414-141414141405', 2000, 'declared'),
  ('16161616-1616-1616-1616-161616161604', '15151515-1515-1515-1515-151515151503', '14141414-1414-1414-1414-141414141403', '14141414-1414-1414-1414-141414141406', 1900, 'declared')
ON CONFLICT (id) DO UPDATE SET allocated_input_kg=EXCLUDED.allocated_input_kg, allocation_method=EXCLUDED.allocation_method;

DELETE FROM lot_genealogy_edges WHERE id='16161616-1616-1616-1616-161616161605';

INSERT INTO lot_distributions (id, lot_id, shipment_id, recipient_organization_id, quantity_kg, distribution_reference, dispatched_at) VALUES
  ('17171717-1717-1717-1717-171717171701', '14141414-1414-1414-1414-141414141405', NULL, '11111111-1111-1111-1111-111111111005', 1800, 'DEMO-DIST-NL-2026-001', '2026-09-02 10:00:00+00'),
  ('17171717-1717-1717-1717-171717171702', '14141414-1414-1414-1414-141414141406', NULL, '11111111-1111-1111-1111-111111111005', 1700, 'DEMO-DIST-NL-2026-002', '2026-09-03 10:00:00+00')
ON CONFLICT (id) DO UPDATE SET quantity_kg=EXCLUDED.quantity_kg,
  distribution_reference=EXCLUDED.distribution_reference,dispatched_at=EXCLUDED.dispatched_at;

DELETE FROM recall_affected_lots WHERE recall_id='13131313-1313-1313-1313-131313131301';
INSERT INTO recall_affected_lots (recall_id, lot_id, source_equivalent_kg, recall_quantity_kg, relationship_depth) VALUES
  ('13131313-1313-1313-1313-131313131301', '14141414-1414-1414-1414-141414141402', 6000, 6000, 0),
  ('13131313-1313-1313-1313-131313131301', '14141414-1414-1414-1414-141414141405', 1800, 1800, 2),
  ('13131313-1313-1313-1313-131313131301', '14141414-1414-1414-1414-141414141406', 1700, 1700, 2);
