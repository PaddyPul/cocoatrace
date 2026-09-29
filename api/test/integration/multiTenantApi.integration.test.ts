import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';

type Tenant = {
  email: string;
  password: string;
  organizationId: string;
  token: string;
  farmId: string;
  certificateId: string;
  batchId: string;
  profileId: string;
  contractId: string;
  shipmentId: string;
  evidenceId: string;
  contractEvidenceId: string;
};

const tenantA: Tenant = {
  email: 'tenant-a@integration.test', password: 'TenantAPassword123!',
  organizationId: '', token: '', farmId: '', certificateId: '', batchId: '', profileId: '', contractId: '', shipmentId: '', evidenceId: '', contractEvidenceId: '',
};

const tenantB: Tenant = {
  email: 'tenant-b@integration.test', password: 'TenantBPassword123!',
  organizationId: '', token: '', farmId: '', certificateId: '', batchId: '', profileId: '', contractId: '', shipmentId: '', evidenceId: '', contractEvidenceId: '',
};

let networkToken = '';
const uploadedPaths: string[] = [];

async function createTenant(tenant: Tenant, name: string, organizationType: 'exporter' | 'importer'): Promise<void> {
  const organization = await query(
    `INSERT INTO organizations (name, type, jurisdiction, verification_status)
     VALUES ($1, $2, 'GH', 'pending') RETURNING id`,
    [name, organizationType],
  );
  tenant.organizationId = organization.rows[0].id;

  const passwordHash = await bcrypt.hash(tenant.password, 4);
  const user = await query(
    `INSERT INTO users (organization_id, email, password_hash, name)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [tenant.organizationId, tenant.email, passwordHash, `${name} User`],
  );
  const role = await query(
    `INSERT INTO roles (name, permissions)
     VALUES ($1, ARRAY['farm.read','farm.create','certificate.read','certificate.issue','batch.read','batch.create','batch.attest','contract.read','evidence.read','evidence.upload','provenance.export','audit.read','audit.export'])
     ON CONFLICT (name) DO UPDATE SET permissions = EXCLUDED.permissions
     RETURNING id`,
    [`integration-farmer-${tenant.email}`],
  );
  await query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [user.rows[0].id, role.rows[0].id]);

  const login = await request(app).post('/auth/login').send({ email: tenant.email, password: tenant.password });
  expect(login.status).toBe(200);
  tenant.token = login.body.accessToken;
}

async function createSupplyFixture(tenant: Tenant, suffix: string): Promise<void> {
  const certificate = await query(
    `INSERT INTO organic_certificates
      (certifier_organization_id,farmer_organization_id,farm_id,standard,crop_scope,valid_from,valid_to,issuing_authority,accreditation_reference)
     VALUES ($1,$1,$2,'EU_ORGANIC',ARRAY['cocoa'],'2026-01-01','2027-01-01','Integration Authority',$3)
     RETURNING id`,
    [tenant.organizationId, tenant.farmId, `CERT-${suffix}`],
  );
  tenant.certificateId = certificate.rows[0].id;

  const batch = await query(
    `INSERT INTO harvest_batches
      (farm_id,crop,harvest_date,quantity_kg,current_holder_id,organic_claim_status)
     VALUES ($1,'cocoa','2026-09-01',1000,$2,'pending_attestation') RETURNING id`,
    [tenant.farmId, tenant.organizationId],
  );
  tenant.batchId = batch.rows[0].id;
  await query(
    `INSERT INTO material_lots
      (lot_code,lot_type,batch_id,product_name,quantity_kg,owner_organization_id,status,produced_at)
     VALUES ($1,'source',$2,'cocoa',1000,$3,'available','2026-09-01')`,
    [`SOURCE-${suffix}`, tenant.batchId, tenant.organizationId],
  );
  const holding = await query(
    `INSERT INTO batch_holdings (batch_id,holder_organization_id,quantity_kg,status)
     VALUES ($1,$2,1000,'available') RETURNING id`,
    [tenant.batchId, tenant.organizationId],
  );
  const counterparty = await query(
    `INSERT INTO organizations (name,type,jurisdiction,verification_status)
     VALUES ($1,'importer','NL','verified') RETURNING id`,
    [`Counterparty ${suffix}`],
  );
  const listing = await query(
    `INSERT INTO listings
      (seller_organization_id,holding_id,available_quantity_kg,price_per_kg,currency,incoterm,origin_location,destination_location)
     VALUES ($1,$2,1000,5,'EUR','FOB','Tema','Rotterdam') RETURNING id`,
    [tenant.organizationId, holding.rows[0].id],
  );
  const offer = await query(
    `INSERT INTO trade_offers
      (listing_id,buyer_organization_id,quantity_kg,offered_price_per_kg,currency,valid_until,status)
     VALUES ($1,$2,500,5,'EUR',NOW()+INTERVAL '7 days','accepted') RETURNING id`,
    [listing.rows[0].id, counterparty.rows[0].id],
  );
  const contract = await query(
    `INSERT INTO sales_contracts
      (listing_id,offer_id,seller_organization_id,buyer_organization_id,holding_id,quantity_kg,price_per_kg,currency,incoterm)
     VALUES ($1,$2,$3,$4,$5,500,5,'EUR','FOB') RETURNING id`,
    [listing.rows[0].id, offer.rows[0].id, tenant.organizationId, counterparty.rows[0].id, holding.rows[0].id],
  );
  tenant.contractId = contract.rows[0].id;
  const shipment = await query(
    `INSERT INTO shipments (contract_id,transport_coordinator_organization_id)
     VALUES ($1,$2) RETURNING id`,
    [tenant.contractId, tenant.organizationId],
  );
  tenant.shipmentId = shipment.rows[0].id;
  const profile = await query(
    `INSERT INTO product_profiles (batch_id,slug,display_name,lot_code)
     VALUES ($1,$2,$3,$4) RETURNING id`,
    [tenant.batchId, `integration-${suffix.toLowerCase()}`, `Product ${suffix}`, `LOT-${suffix}`],
  );
  tenant.profileId = profile.rows[0].id;
}

async function uploadEvidence(
  tenant: Tenant,
  linkedEntityType: 'batch' | 'certificate' | 'contract' | 'farm' | 'product_profile' | 'shipment',
  linkedEntityId: string,
  type = 'weighing_ticket',
) {
  return request(app)
    .post('/evidence')
    .set('Authorization', `Bearer ${tenant.token}`)
    .field('type', type)
    .field('linkedEntityType', linkedEntityType)
    .field('linkedEntityId', linkedEntityId)
    .field('claimDescription', 'Integration authorization proof')
    .attach('file', Buffer.from(`proof-${tenant.email}-${linkedEntityId}`), { filename: `${type}.pdf`, contentType: 'application/pdf' });
}

async function createFarm(tenant: Tenant, name: string): Promise<string> {
  const response = await request(app)
    .post('/farms')
    .set('Authorization', `Bearer ${tenant.token}`)
    .send({ name, country: 'GH', region: 'Northern', district: 'Tamale' });

  expect(response.status).toBe(201);
  return response.body.id;
}

beforeAll(async () => {
  await createTenant(tenantA, 'Independent Tenant A', 'exporter');
  await createTenant(tenantB, 'Independent Tenant B', 'importer');
  tenantA.farmId = await createFarm(tenantA, 'Tenant A Farm');
  tenantB.farmId = await createFarm(tenantB, 'Tenant B Farm');
  await createSupplyFixture(tenantA, 'A');
  await createSupplyFixture(tenantB, 'B');

  const evidenceA = await uploadEvidence(tenantA, 'batch', tenantA.batchId);
  const evidenceB = await uploadEvidence(tenantB, 'batch', tenantB.batchId);
  const contractEvidenceA = await uploadEvidence(tenantA, 'contract', tenantA.contractId, 'commercial_invoice');
  const contractEvidenceB = await uploadEvidence(tenantB, 'contract', tenantB.contractId, 'commercial_invoice');
  expect(evidenceA.status).toBe(201);
  expect(evidenceB.status).toBe(201);
  expect(contractEvidenceA.status).toBe(201);
  expect(contractEvidenceB.status).toBe(201);
  expect(evidenceA.body).not.toHaveProperty('storage_path');
  expect(evidenceB.body).not.toHaveProperty('storage_path');
  tenantA.evidenceId = evidenceA.body.id;
  tenantB.evidenceId = evidenceB.body.id;
  tenantA.contractEvidenceId = contractEvidenceA.body.id;
  tenantB.contractEvidenceId = contractEvidenceB.body.id;

  const stored = await query('SELECT storage_path FROM evidence_items WHERE id=ANY($1::uuid[])', [[tenantA.evidenceId, tenantB.evidenceId, tenantA.contractEvidenceId, tenantB.contractEvidenceId]]);
  uploadedPaths.push(...stored.rows.map((row) => row.storage_path));

  const networkOrg = await query(
    `INSERT INTO organizations (name,type,jurisdiction,verification_status)
     VALUES ('Integration Regulator','regulator','GH','verified') RETURNING id`,
  );
  const passwordHash = await bcrypt.hash('NetworkPassword123!', 4);
  const networkUser = await query(
    `INSERT INTO users (organization_id,email,password_hash,name)
     VALUES ($1,'network@integration.test',$2,'Network Reviewer') RETURNING id`,
    [networkOrg.rows[0].id, passwordHash],
  );
  const networkRole = await query(
    `INSERT INTO roles (name,permissions)
     VALUES ('integration-network-reader',ARRAY['farm.read','farm.read.all','certificate.read','certificate.read.all','batch.read','batch.read.all']) RETURNING id`,
  );
  await query('INSERT INTO user_roles (user_id,role_id) VALUES ($1,$2)', [networkUser.rows[0].id, networkRole.rows[0].id]);
  const networkLogin = await request(app).post('/auth/login').send({ email: 'network@integration.test', password: 'NetworkPassword123!' });
  expect(networkLogin.status).toBe(200);
  networkToken = networkLogin.body.accessToken;
});

afterAll(async () => {
  await Promise.all(uploadedPaths.map((filePath) => fs.promises.unlink(filePath).catch(() => undefined)));
  await pool.end();
});

describe('real PostgreSQL multi-tenant API boundary', () => {
  it.each([
    [tenantA, 'Tenant A Farm', 'Tenant B Farm'],
    [tenantB, 'Tenant B Farm', 'Tenant A Farm'],
  ])('only lists farms owned by the authenticated organization', async (tenant, ownFarm, otherFarm) => {
    const response = await request(app).get('/farms').set('Authorization', `Bearer ${tenant.token}`);
    expect(response.status).toBe(200);
    expect(response.body.map((farm: { name: string }) => farm.name)).toContain(ownFarm);
    expect(response.body.map((farm: { name: string }) => farm.name)).not.toContain(otherFarm);
  });

  it.each([[tenantA, tenantB], [tenantB, tenantA]])(
    'denies direct access to another organization\'s farm',
    async (actor, otherTenant) => {
      const response = await request(app)
        .get(`/farms/${otherTenant.farmId}`)
        .set('Authorization', `Bearer ${actor.token}`);
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Access denied' });
    },
  );

  it('persists organization attribution and audit records in PostgreSQL', async () => {
    const farms = await query(
      'SELECT name, farmer_organization_id FROM farms WHERE id = ANY($1::uuid[]) ORDER BY name',
      [[tenantA.farmId, tenantB.farmId]],
    );
    expect(farms.rows).toEqual([
      { name: 'Tenant A Farm', farmer_organization_id: tenantA.organizationId },
      { name: 'Tenant B Farm', farmer_organization_id: tenantB.organizationId },
    ]);

    const audits = await query(
      `SELECT actor_organization_id, entity_id FROM audit_events
       WHERE action = 'farm.create' AND entity_id = ANY($1::uuid[])`,
      [[tenantA.farmId, tenantB.farmId]],
    );
    expect(audits.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ actor_organization_id: tenantA.organizationId, entity_id: tenantA.farmId }),
      expect.objectContaining({ actor_organization_id: tenantB.organizationId, entity_id: tenantB.farmId }),
    ]));
  });

  it('allows explicit network permissions without treating ordinary reads as global', async () => {
    const response = await request(app).get('/farms').set('Authorization', `Bearer ${networkToken}`);
    expect(response.status).toBe(200);
    expect(response.body.map((farm: { id: string }) => farm.id)).toEqual(expect.arrayContaining([tenantA.farmId, tenantB.farmId]));

    const certificates = await request(app).get('/certificates').set('Authorization', `Bearer ${networkToken}`);
    expect(certificates.status).toBe(200);
    expect(certificates.body.map((certificate: { id: string }) => certificate.id))
      .toEqual(expect.arrayContaining([tenantA.certificateId, tenantB.certificateId]));
  });

  it.each([[tenantA, tenantB], [tenantB, tenantA]])(
    'scopes batches, trace lots, audit records and readiness to relationships',
    async (actor, otherTenant) => {
      const batches = await request(app).get('/batches').set('Authorization', `Bearer ${actor.token}`);
      expect(batches.status).toBe(200);
      expect(batches.body.map((batch: { id: string }) => batch.id)).toContain(actor.batchId);
      expect(batches.body.map((batch: { id: string }) => batch.id)).not.toContain(otherTenant.batchId);

      const ownBatch = await request(app).get(`/batches/${actor.batchId}`).set('Authorization', `Bearer ${actor.token}`);
      expect(ownBatch.status).toBe(200);
      expect(JSON.stringify(ownBatch.body.evidence)).not.toContain('storage_path');

      const foreignBatch = await request(app).get(`/batches/${otherTenant.batchId}`).set('Authorization', `Bearer ${actor.token}`);
      expect(foreignBatch.status).toBe(403);

      const lots = await request(app).get('/traceability/lots').set('Authorization', `Bearer ${actor.token}`);
      expect(lots.status).toBe(200);
      expect(lots.body.map((lot: { batchId: string }) => lot.batchId)).toContain(actor.batchId);
      expect(lots.body.map((lot: { batchId: string }) => lot.batchId)).not.toContain(otherTenant.batchId);

      const auditEvents = await request(app).get('/audit/events').set('Authorization', `Bearer ${actor.token}`);
      expect(auditEvents.status).toBe(200);
      expect(auditEvents.body.every((event: { actor_organization_id: string }) => event.actor_organization_id === actor.organizationId)).toBe(true);

      const auditExport = await request(app).get('/audit/export').set('Authorization', `Bearer ${actor.token}`);
      expect(auditExport.status).toBe(200);
      expect(auditExport.body.every((event: { actor_organization_id: string }) => event.actor_organization_id === actor.organizationId)).toBe(true);

      const readiness = await request(app).get('/readiness').set('Authorization', `Bearer ${actor.token}`);
      expect(readiness.status).toBe(200);
      expect(readiness.body.scope).toBe('your organization');
      expect(readiness.body.facts.batchesTotal).toBe(1);
    },
  );

  it.each([[tenantA, tenantB], [tenantB, tenantA]])(
    'does not expose another tenant certificate through ordinary certificate.read',
    async (actor, otherTenant) => {
      const list = await request(app).get('/certificates').set('Authorization', `Bearer ${actor.token}`);
      expect(list.status).toBe(200);
      expect(list.body.map((certificate: { id: string }) => certificate.id)).not.toContain(otherTenant.certificateId);
      const direct = await request(app).get(`/certificates/${otherTenant.certificateId}`).set('Authorization', `Bearer ${actor.token}`);
      expect(direct.status).toBe(403);
    },
  );

  it('rejects certificates whose supplied farmer organization does not own the farm', async () => {
    const response = await request(app)
      .post('/certificates')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        farmerOrganizationId: tenantA.organizationId,
        farmId: tenantB.farmId,
        standard: 'EU_ORGANIC', cropScope: ['cocoa'], validFrom: '2026-01-01', validTo: '2027-01-01',
        issuingAuthority: 'Integration Authority', accreditationReference: 'INVALID-CROSS-TENANT',
      });
    expect(response.status).toBe(400);
  });

  it('rejects attestation when certificate subject or crop scope does not match the batch', async () => {
    const wrongSubject = await query(
      `INSERT INTO organic_certificates
        (certifier_organization_id,farmer_organization_id,farm_id,standard,crop_scope,valid_from,valid_to,issuing_authority,accreditation_reference)
       VALUES ($1,$2,$3,'EU_ORGANIC',ARRAY['cocoa'],'2026-01-01','2027-01-01','Integration Authority','WRONG-SUBJECT')
       RETURNING id`,
      [tenantA.organizationId, tenantB.organizationId, tenantA.farmId],
    );
    const subjectResponse = await request(app)
      .post(`/batches/${tenantA.batchId}/attest`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ certificateId: wrongSubject.rows[0].id });
    expect(subjectResponse.status).toBe(400);

    const wrongCrop = await query(
      `INSERT INTO organic_certificates
        (certifier_organization_id,farmer_organization_id,farm_id,standard,crop_scope,valid_from,valid_to,issuing_authority,accreditation_reference)
       VALUES ($1,$1,$2,'EU_ORGANIC',ARRAY['shea'],'2026-01-01','2027-01-01','Integration Authority','WRONG-CROP')
       RETURNING id`,
      [tenantA.organizationId, tenantA.farmId],
    );
    const cropResponse = await request(app)
      .post(`/batches/${tenantA.batchId}/attest`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ certificateId: wrongCrop.rows[0].id });
    expect(cropResponse.status).toBe(400);
  });

  it.each([[tenantA, tenantB], [tenantB, tenantA]])(
    'hides foreign draft product profiles and direct batch profile lookup',
    async (actor, otherTenant) => {
      const list = await request(app).get('/product-profiles').set('Authorization', `Bearer ${actor.token}`);
      expect(list.status).toBe(200);
      expect(list.body.map((profile: { id: string }) => profile.id)).not.toContain(otherTenant.profileId);
      const direct = await request(app).get(`/product-profiles/batch/${otherTenant.batchId}`).set('Authorization', `Bearer ${actor.token}`);
      expect(direct.status).toBe(403);
    },
  );

  it('blocks foreign provenance and contract splicing while preserving the related contract path', async () => {
    const foreignBatch = await request(app)
      .get(`/provenance/batches/${tenantB.batchId}`)
      .set('Authorization', `Bearer ${tenantA.token}`);
    expect(foreignBatch.status).toBe(403);

    const spliced = await request(app)
      .get(`/provenance/batches/${tenantA.batchId}?contractId=${tenantB.contractId}`)
      .set('Authorization', `Bearer ${tenantA.token}`);
    expect(spliced.status).toBe(403);

    const related = await request(app)
      .get(`/provenance/batches/${tenantA.batchId}?contractId=${tenantA.contractId}`)
      .set('Authorization', `Bearer ${tenantA.token}`);
    expect(related.status).toBe(200);
    expect(related.body.contract.id).toBe(tenantA.contractId);
    expect(JSON.stringify(related.body)).not.toContain('storage_path');

    const exportSplice = await request(app)
      .get(`/provenance/batches/${tenantA.batchId}/export?format=json&contractId=${tenantB.contractId}`)
      .set('Authorization', `Bearer ${tenantA.token}`);
    expect(exportSplice.status).toBe(403);
  });

  it('authorizes evidence by linked resource and never returns internal storage paths', async () => {
    const own = await request(app)
      .get(`/evidence?entityType=batch&entityId=${tenantA.batchId}`)
      .set('Authorization', `Bearer ${tenantA.token}`);
    expect(own.status).toBe(200);
    expect(own.body.map((item: { id: string }) => item.id)).toContain(tenantA.evidenceId);
    expect(JSON.stringify(own.body)).not.toContain('storage_path');

    const foreign = await request(app)
      .get(`/evidence?entityType=batch&entityId=${tenantB.batchId}`)
      .set('Authorization', `Bearer ${tenantA.token}`);
    expect(foreign.status).toBe(403);

    const foreignDownload = await request(app)
      .get(`/evidence/${tenantB.evidenceId}/download`)
      .set('Authorization', `Bearer ${tenantA.token}`);
    expect(foreignDownload.status).toBe(403);

    const contractDownload = await request(app)
      .get(`/evidence/${tenantB.contractEvidenceId}/download`)
      .set('Authorization', `Bearer ${tenantA.token}`);
    expect(contractDownload.status).toBe(403);

    const foreignContractList = await request(app)
      .get(`/evidence?entityType=contract&entityId=${tenantB.contractId}`)
      .set('Authorization', `Bearer ${tenantA.token}`);
    expect(foreignContractList.status).toBe(403);

    const foreignContract = await request(app)
      .get(`/contracts/${tenantB.contractId}`)
      .set('Authorization', `Bearer ${tenantA.token}`);
    expect(foreignContract.status).toBe(404);

    const ownContract = await request(app)
      .get(`/contracts/${tenantA.contractId}`)
      .set('Authorization', `Bearer ${tenantA.token}`);
    expect(ownContract.status).toBe(200);
    expect(ownContract.body.documents.map((document: { id: string }) => document.id)).toContain(tenantA.contractEvidenceId);
    expect(JSON.stringify(ownContract.body.documents)).not.toContain('storage_path');
  });

  it('rejects evidence attachment and listing across every supported foreign resource family', async () => {
    const before = await query('SELECT COUNT(*)::int AS count FROM evidence_items');
    const uploadsDirectory = path.dirname(uploadedPaths[0]);
    const filesBefore = (await fs.promises.readdir(uploadsDirectory)).sort();
    const foreignResources = [
      ['farm', tenantB.farmId],
      ['certificate', tenantB.certificateId],
      ['batch', tenantB.batchId],
      ['product_profile', tenantB.profileId],
      ['contract', tenantB.contractId],
      ['shipment', tenantB.shipmentId],
    ] as const;
    for (const [entityType, entityId] of foreignResources) {
      const list = await request(app)
        .get(`/evidence?entityType=${entityType}&entityId=${entityId}`)
        .set('Authorization', `Bearer ${tenantA.token}`);
      expect(list.status).toBe(403);
      const upload = await uploadEvidence(tenantA, entityType, entityId);
      expect(upload.status).toBe(403);
    }
    const after = await query('SELECT COUNT(*)::int AS count FROM evidence_items');
    expect(after.rows[0].count).toBe(before.rows[0].count);
    expect((await fs.promises.readdir(uploadsDirectory)).sort()).toEqual(filesBefore);
  });

  it('does not expose a real stored object through an unauthenticated static route', async () => {
    expect(uploadedPaths[0]).toBeTruthy();
    const response = await request(app).get(`/uploads/${path.basename(uploadedPaths[0])}`);
    expect(response.status).toBe(404);
  });
});
