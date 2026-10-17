import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { config } from '../../src/config/env';
import { evidenceStorage } from '../../src/services/evidenceStorage';
import { pool, query } from '../../src/db';
import { authenticator } from '../../src/testing/webauthnFixture';
import { createActor, createSupply, type FixtureActor } from './support/fixtures';
const auth = (a: FixtureActor) => ({ Authorization: `Bearer ${a.token}` });
async function reviewer() {
  const actor = await createActor({ type: 'exporter', permissions: ['*'] });
  const options = await request(app)
    .post('/auth/mfa/registration/options')
    .set(auth(actor))
    .send({ currentPassword: actor.password });
  expect(options.status).toBe(200);
  expect(
    (
      await request(app)
        .post('/auth/mfa/registration/verify')
        .set(auth(actor))
        .send({
          response: authenticator().registration(options.body.challenge),
          label: 'Document review key',
        })
    ).status,
  ).toBe(200);
  return actor;
}
async function evidence(a: FixtureActor, batchId: string) {
  return (
    await query(
      `INSERT INTO evidence_items(uploader_user_id,uploader_organization_id,type,file_name,sha256_hash,linked_entity_type,linked_entity_id,review_status,validation_status,malware_scan_status) VALUES($1,$2,'other','Review evidence.pdf',$3,'batch',$4,'pending','validated','clean') RETURNING id`,
      [a.userId, a.organizationId, crypto.randomBytes(32).toString('hex'), batchId],
    )
  ).rows[0].id as string;
}
const detail = (a: FixtureActor, id: string) =>
  request(app).get(`/evidence/${id}/review`).set(auth(a));
const decision = (a: FixtureActor, id: string, expectedFingerprint: string, status = 'rejected') =>
  request(app).post(`/evidence/${id}/review`).set(auth(a)).send({
    decision: status,
    expectedFingerprint,
    reason: 'Independent document examination completed',
  });
beforeEach(async () => {
  await query('TRUNCATE auth_rate_limits');
});
afterAll(async () => pool.end());
describe('independent document review and explicit evidence versions', () => {
  it('denies ordinary queue access and self review, records immutable rejection with atomic audit and retry', async () => {
    const owner = await createActor({
      type: 'exporter',
      permissions: ['evidence.read', 'evidence.upload'],
    });
    const supply = await createSupply(owner, { quantityKg: 10 });
    const id = await evidence(owner, supply.batchId);
    const admin = await reviewer();
    expect((await request(app).get('/evidence/review/page').set(auth(owner))).status).toBe(403);
    const outsider = await createActor({
      type: 'importer',
      permissions: ['evidence.read', 'evidence.read.all'],
    });
    expect((await detail(outsider, id)).status).toBe(404);
    const reviewed = await detail(admin, id);
    expect(reviewed.status, JSON.stringify(reviewed.body)).toBe(200);
    expect(JSON.stringify(reviewed.body)).not.toContain('storage_key');
    const own = await evidence(admin, supply.batchId);
    expect((await decision(admin, own, (await detail(admin, own)).body.fingerprint)).status).toBe(
      403,
    );
    const results = await Promise.all([
      decision(admin, id, reviewed.body.fingerprint),
      decision(admin, id, reviewed.body.fingerprint),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(results.filter((r) => r.body.changed)).toHaveLength(1);
    expect(
      (await query('SELECT id FROM evidence_review_decisions WHERE evidence_id=$1', [id])).rows,
    ).toHaveLength(1);
    expect(
      (
        await query(
          "SELECT id FROM audit_events WHERE action='evidence.review.decided' AND entity_id=$1",
          [id],
        )
      ).rows,
    ).toHaveLength(1);
    await expect(
      query(
        "UPDATE evidence_review_decisions SET reason='Changed decision reason' WHERE evidence_id=$1",
        [id],
      ),
    ).rejects.toThrow();
    expect((await decision(admin, id, reviewed.body.fingerprint, 'approved')).status).toBe(409);
  });
  it('requires actual available proof for approval and rolls back decisions on audit failure', async () => {
    const owner = await createActor({
      type: 'exporter',
      permissions: ['evidence.read', 'evidence.upload'],
    });
    const supply = await createSupply(owner, { quantityKg: 10 });
    const id = await evidence(owner, supply.batchId);
    const admin = await reviewer();
    const before = await detail(admin, id);
    expect((await decision(admin, id, before.body.fingerprint, 'approved')).status).toBe(409);
    const trigger = `review_audit_${crypto.randomBytes(6).toString('hex')}`;
    await query(
      `CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_id='${id}'::uuid AND NEW.action='evidence.review.decided' THEN RAISE EXCEPTION 'forced review audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER ${trigger} BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION ${trigger}()`,
    );
    try {
      expect((await decision(admin, id, before.body.fingerprint)).status).toBe(500);
      expect(
        (await query('SELECT review_status FROM evidence_items WHERE id=$1', [id])).rows[0]
          .review_status,
      ).toBe('pending');
      expect(
        (await query('SELECT id FROM evidence_review_decisions WHERE evidence_id=$1', [id])).rows,
      ).toEqual([]);
    } finally {
      await query(`DROP TRIGGER ${trigger} ON audit_events; DROP FUNCTION ${trigger}()`);
    }
  });
  it('approves current stored proof without public claims, rejects deleted proof and stale snapshots', async () => {
    const owner = await createActor({
      type: 'exporter',
      permissions: ['evidence.read', 'evidence.upload'],
    });
    const supply = await createSupply(owner, { quantityKg: 10 });
    const id = await evidence(owner, supply.batchId);
    const admin = await reviewer();
    await query("UPDATE evidence_items SET review_status='submitted' WHERE id=$1", [id]);
    const queue = await request(app)
      .get('/evidence/review/page')
      .query({ status: 'pending', id })
      .set(auth(admin));
    expect(queue.status, JSON.stringify(queue.body)).toBe(200);
    expect(queue.body.items.map((row: { id: string }) => row.id)).toEqual([id]);
    const key = `evidence/${config.environment}/${crypto.randomUUID()}`;
    const bytes = Buffer.from('%PDF-1.4 review proof');
    await evidenceStorage().put(key, bytes, 'application/pdf');
    await query(
      'UPDATE evidence_items SET storage_key=$2,storage_provider=$3,file_size_bytes=$4,sha256_hash=$5 WHERE id=$1',
      [
        id,
        key,
        evidenceStorage().provider,
        bytes.length,
        crypto.createHash('sha256').update(bytes).digest('hex'),
      ],
    );
    try {
      const before = await detail(admin, id);
      const saved = await decision(admin, id, before.body.fingerprint, 'approved');
      expect(saved.status, JSON.stringify(saved.body)).toBe(200);
      expect(saved.body.evidence.review_status).toBe('approved');
      expect(
        (
          await query(
            "SELECT id FROM trust_claim_reviews WHERE entity_type='evidence' AND entity_id=$1",
            [id],
          )
        ).rows,
      ).toEqual([]);
      expect((await decision(admin, id, before.body.fingerprint)).status).toBe(409);
      const current = await detail(admin, id);
      await evidenceStorage().delete(key);
      expect((await decision(admin, id, current.body.fingerprint, 'approved')).status).toBe(409);
    } finally {
      await evidenceStorage().delete(key);
    }
  });
  it('links new pending owner upload, preserves prior bytes and approval, prevents cycles and cross-owner replacement', async () => {
    const owner = await createActor({
      type: 'exporter',
      permissions: ['evidence.read', 'evidence.upload'],
    });
    const supply = await createSupply(owner, { quantityKg: 10 });
    const old = await evidence(owner, supply.batchId);
    const next = await evidence(owner, supply.batchId);
    await query("UPDATE evidence_items SET review_status='submitted' WHERE id=$1", [next]);
    const original = (await query('SELECT sha256_hash FROM evidence_items WHERE id=$1', [old]))
      .rows[0].sha256_hash;
    const before = await detail(owner, old);
    const save = () =>
      request(app)
        .post(`/evidence/${old}/replacement`)
        .set(auth(owner))
        .send({ replacementEvidenceId: next, expectedFingerprint: before.body.fingerprint });
    const results = await Promise.all([save(), save()]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(results.filter((r) => r.body.changed)).toHaveLength(1);
    expect(
      (
        await query(
          'SELECT sha256_hash,superseded_by_evidence_id FROM evidence_items WHERE id=$1',
          [old],
        )
      ).rows[0],
    ).toMatchObject({ sha256_hash: original, superseded_by_evidence_id: next });
    expect((await detail(owner, next)).body.evidence.review_status).toBe('pending');
    expect(
      (
        await request(app)
          .post(`/evidence/${next}/replacement`)
          .set(auth(owner))
          .send({
            replacementEvidenceId: old,
            expectedFingerprint: (await detail(owner, next)).body.fingerprint,
          })
      ).status,
    ).toBe(409);
    const stranger = await createActor({
      type: 'importer',
      permissions: ['evidence.read', 'evidence.upload'],
    });
    const foreign = await evidence(stranger, supply.batchId);
    expect(
      (
        await request(app)
          .post(`/evidence/${next}/replacement`)
          .set(auth(owner))
          .send({
            replacementEvidenceId: foreign,
            expectedFingerprint: (await detail(owner, next)).body.fingerprint,
          })
      ).status,
    ).toBe(403);
  });
  it('rolls back replacement lineage if atomic audit fails and respects revoked upload authority', async () => {
    const owner = await createActor({
      type: 'exporter',
      permissions: ['evidence.read', 'evidence.upload'],
    });
    const supply = await createSupply(owner, { quantityKg: 10 });
    const old = await evidence(owner, supply.batchId);
    const next = await evidence(owner, supply.batchId);
    const before = await detail(owner, old);
    const save = () =>
      request(app)
        .post(`/evidence/${old}/replacement`)
        .set(auth(owner))
        .send({ replacementEvidenceId: next, expectedFingerprint: before.body.fingerprint });
    const trigger = `version_audit_${crypto.randomBytes(6).toString('hex')}`;
    await query(
      `CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_id='${old}'::uuid AND NEW.action='evidence.version.replaced' THEN RAISE EXCEPTION 'forced version audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER ${trigger} BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION ${trigger}()`,
    );
    try {
      expect((await save()).status).toBe(500);
      expect(
        (
          await query(
            'SELECT superseded_by_evidence_id,review_revision FROM evidence_items WHERE id=$1',
            [old],
          )
        ).rows[0],
      ).toMatchObject({ superseded_by_evidence_id: null, review_revision: 0 });
      expect(
        (await query('SELECT replaces_evidence_id FROM evidence_items WHERE id=$1', [next])).rows[0]
          .replaces_evidence_id,
      ).toBeNull();
    } finally {
      await query(`DROP TRIGGER ${trigger} ON audit_events; DROP FUNCTION ${trigger}()`);
    }
    await query("UPDATE roles SET permissions=ARRAY['evidence.read']::text[] WHERE id=$1", [
      owner.roleId,
    ]);
    expect((await save()).status).toBe(403);
  });
});
