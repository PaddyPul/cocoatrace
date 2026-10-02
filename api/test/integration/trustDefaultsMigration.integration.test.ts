import crypto from 'node:crypto';
import knex, { Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { up } from '../../src/migrations/021_trust_state_accuracy';
import { requireDisposableTestDatabase } from '../../src/testing/databaseSafety';

let db: Knex;
let supplierId: string;
let reviewerId: string;
let userId: string;

beforeAll(async () => {
  db = knex({ client: 'pg', connection: requireDisposableTestDatabase(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL) });
  supplierId = (await db('organizations').insert({ name: `Trust supplier ${crypto.randomUUID()}`, type: 'exporter', jurisdiction: 'GH', verification_status: 'verified' }).returning('id'))[0].id;
  reviewerId = (await db('organizations').insert({ name: `Trust reviewer ${crypto.randomUUID()}`, type: 'certifier', jurisdiction: 'GH', verification_status: 'verified' }).returning('id'))[0].id;
  userId = (await db('users').insert({ organization_id: reviewerId, email: `trust-${crypto.randomUUID()}@integration.test`, name: 'Independent reviewer', password_hash: 'unused-integration-only' }).returning('id'))[0].id;
});
afterAll(async () => { await db?.destroy(); });

async function farm(verification = 'verified') {
  return (await db('farms').insert({ farmer_organization_id: supplierId, name: `Trust farm ${crypto.randomUUID()}`, region: 'Northern', district: 'Tamale', verification_status: verification }).returning('*'))[0];
}

async function review(entityId: string, entityType: string, key: string, overrides = {}) {
  await db('trust_claim_reviews').insert({ entity_id: entityId, entity_type: entityType, claim_key: key, claim_source: 'independent_inspection', source_reference: 'inspection/test', reviewer_user_id: userId, reviewer_organization_id: reviewerId, review_method: 'document_and_source_review', ...overrides });
}

describe('trust defaults and attributable legacy corrections', () => {
  it('uses conservative defaults for newly created organizations, farms, plots and evidence', async () => {
    const org = (await db('organizations').insert({ name: `Default ${crypto.randomUUID()}`, type: 'exporter', jurisdiction: 'GH' }).returning('*'))[0];
    expect(org.verification_status).toBe('pending');
    const f = (await db('farms').insert({ farmer_organization_id: supplierId, name: 'Default farm', region: 'Northern', district: 'Tamale' }).returning('*'))[0];
    expect(f.verification_status).toBe('self_declared');
    const p = (await db('farm_plots').insert({ farm_id: f.id, plot_code: crypto.randomUUID(), area_hectares: 1 }).returning('*'))[0];
    expect(p.verification_status).toBe('self_declared');
    expect(p.deforestation_risk_status).toBe('unknown');
    expect(p.eudr_cutoff_checked).toBe(false);
    const e = (await db('evidence_items').insert({ uploader_user_id: userId, uploader_organization_id: reviewerId, type: 'certificate_pdf', file_name: 'real.pdf', sha256_hash: 'a'.repeat(64), linked_entity_type: 'farm', linked_entity_id: f.id }).returning('*'))[0];
    expect(e.review_status).toBe('pending');
  });

  it('corrects unsupported positive legacy flags once without changing approved workspace access or deleting records', async () => {
    const f = await farm();
    const p = (await db('farm_plots').insert({ farm_id: f.id, plot_code: crypto.randomUUID(), area_hectares: 1, verification_status: 'verified', deforestation_risk_status: 'clear', eudr_cutoff_checked: true }).returning('*'))[0];
    const e = (await db('evidence_items').insert({ uploader_user_id: userId, uploader_organization_id: reviewerId, type: 'certificate_pdf', file_name: 'historical.pdf', sha256_hash: 'b'.repeat(64), linked_entity_type: 'farm', linked_entity_id: f.id, review_status: 'approved' }).returning('*'))[0];
    await db.transaction(tx => up(tx));
    await db.transaction(tx => up(tx));
    expect((await db('farms').where({ id: f.id }).first()).verification_status).toBe('self_declared');
    expect(await db('farm_plots').where({ id: p.id }).first()).toMatchObject({ verification_status: 'self_declared', deforestation_risk_status: 'unknown', eudr_cutoff_checked: false });
    expect(await db('evidence_items').where({ id: e.id }).first()).toMatchObject({ review_status: 'pending', sha256_hash: 'b'.repeat(64) });
    expect((await db('organizations').where({ id: supplierId }).first()).verification_status).toBe('verified');
    const corrections = await db('trust_state_corrections').whereIn('entity_id', [f.id, p.id, e.id]);
    expect(corrections).toHaveLength(5);
    expect(corrections.find(row => row.entity_id === f.id)).toMatchObject({ previous_value: 'verified', new_value: 'self_declared', migration_name: '021_trust_state_accuracy' });
  });

  it('preserves independently reviewed claims, but expires or revokes unsupported review decisions', async () => {
    const genuine = await farm();
    await review(genuine.id, 'farm', 'verification');
    const expired = await farm();
    await review(expired.id, 'farm', 'verification', { reviewed_at: new Date('2020-01-01'), expires_at: new Date('2021-01-01') });
    const revoked = await farm();
    await review(revoked.id, 'farm', 'verification', { status: 'revoked' });
    const p = (await db('farm_plots').insert({ farm_id: genuine.id, plot_code: crypto.randomUUID(), area_hectares: 1, verification_status: 'verified', deforestation_risk_status: 'clear', eudr_cutoff_checked: true }).returning('*'))[0];
    for (const key of ['verification', 'deforestation_risk', 'eudr_cutoff']) await review(p.id, 'plot', key);
    await db.transaction(tx => up(tx));
    expect((await db('farms').where({ id: genuine.id }).first()).verification_status).toBe('verified');
    expect((await db('farms').where({ id: expired.id }).first()).verification_status).toBe('self_declared');
    expect((await db('farms').where({ id: revoked.id }).first()).verification_status).toBe('self_declared');
    expect(await db('farm_plots').where({ id: p.id }).first()).toMatchObject({ verification_status: 'verified', deforestation_risk_status: 'clear', eudr_cutoff_checked: true });
    expect(await db('trust_state_corrections').whereIn('entity_id', [genuine.id, p.id])).toHaveLength(0);
  });
});
