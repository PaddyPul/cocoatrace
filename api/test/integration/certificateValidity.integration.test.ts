import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';

let farmer: string, certifier: string, reviewer: string, token: string;
const password = 'CertificateValidityTest123!';
beforeAll(async () => {
  async function organization(type: string) {
    return (
      await query(
        "INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,$2,'GH','verified') RETURNING id",
        [`Validity ${crypto.randomUUID()}`, type],
      )
    ).rows[0].id;
  }
  farmer = await organization('exporter');
  certifier = await organization('certifier');
  const email = `validity-${crypto.randomUUID()}@integration.test`;
  reviewer = (
    await query(
      'INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',
      [certifier, email, await bcrypt.hash(password, 4), 'Validity reviewer'],
    )
  ).rows[0].id;
  const role = (
    await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id', [
      `validity-${crypto.randomUUID()}`,
      ['batch.attest'],
    ])
  ).rows[0].id;
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [reviewer, role]);
  const login = await request(app).post('/auth/login').send({ email, password });
  expect(login.status, JSON.stringify(login.body)).toBe(200);
  token = login.body.accessToken;
});
afterAll(async () => {
  await pool.end();
});

async function fixture(harvestOffset: number) {
  const farm = (
    await query(
      "INSERT INTO farms(farmer_organization_id,name,region,district) VALUES($1,'Validity Farm','Northern','Tamale') RETURNING id",
      [farmer],
    )
  ).rows[0].id;
  const batch = (
    await query(
      "INSERT INTO harvest_batches(farm_id,crop,harvest_date,quantity_kg,current_holder_id) VALUES($1,'cocoa',CURRENT_DATE+$2::int,10,$3) RETURNING id",
      [farm, harvestOffset, farmer],
    )
  ).rows[0].id;
  // The current day is the inclusive final validity date; both boundaries are non-future harvests.
  const certificate = (
    await query(
      "INSERT INTO organic_certificates(certifier_organization_id,farmer_organization_id,farm_id,standard,crop_scope,valid_from,valid_to,issuing_authority,accreditation_reference) VALUES($1,$2,$3,'EU_ORGANIC',ARRAY['cocoa'],CURRENT_DATE-2,CURRENT_DATE,'Independent authority',$4) RETURNING id",
      [certifier, farmer, farm, `VALID-${crypto.randomUUID()}`],
    )
  ).rows[0].id;
  return { farm, batch, certificate };
}
const attest = (f: Awaited<ReturnType<typeof fixture>>) =>
  request(app)
    .post(`/batches/${f.batch}/attest`)
    .set('Authorization', `Bearer ${token}`)
    .send({ certificateId: f.certificate, notes: 'Reviewed certificate scope and harvest date' });
async function state(batch: string) {
  return (
    await query(
      `SELECT attestation_id,organic_claim_status,provenance_hash,
    (SELECT COUNT(*)::int FROM batch_attestations WHERE batch_id=b.id) AS attestations,
    (SELECT COUNT(*)::int FROM trust_claim_reviews WHERE entity_type='batch' AND entity_id=b.id) AS reviews,
    (SELECT COUNT(*)::int FROM audit_events WHERE entity_id=b.id) AS audits
    FROM harvest_batches b WHERE id=$1`,
      [batch],
    )
  ).rows[0];
}

describe('certificate subject, crop and inclusive harvest validity at attestation', () => {
  it.each([-3, 1])(
    'rejects harvest day offset %i outside the certificate window without any write',
    async (offset) => {
      const f = await fixture(offset),
        before = await state(f.batch);
      const result = await attest(f);
      expect(result.status, JSON.stringify(result.body)).toBe(400);
      expect(result.body).toMatchObject({
        code: 'VALIDATION_ERROR',
        error: 'Harvest date outside certificate validity window',
      });
      expect(await state(f.batch)).toEqual(before);
      expect(before).toMatchObject({
        attestation_id: null,
        organic_claim_status: 'none',
        attestations: 0,
        reviews: 0,
        audits: 0,
      });
    },
  );
  it.each([-2, 0])(
    'accepts inclusive harvest boundary day offset %i with exactly one attributable review',
    async (offset) => {
      const f = await fixture(offset),
        result = await attest(f);
      expect(result.status, JSON.stringify(result.body)).toBe(201);
      expect(result.body.attestation).toMatchObject({
        batch_id: f.batch,
        certificate_id: f.certificate,
        certifier_user_id: reviewer,
        certifier_organization_id: certifier,
      });
      expect(await state(f.batch)).toMatchObject({
        attestation_id: result.body.attestation.id,
        organic_claim_status: 'attested',
        attestations: 1,
        reviews: 1,
        audits: 2,
      });
      const review = (
        await query(
          "SELECT reviewer_user_id,reviewer_organization_id,source_reference,review_method FROM trust_claim_reviews WHERE entity_type='batch' AND entity_id=$1",
          [f.batch],
        )
      ).rows;
      expect(review).toEqual([
        {
          reviewer_user_id: reviewer,
          reviewer_organization_id: certifier,
          source_reference: f.certificate,
          review_method: 'certificate_attestation',
        },
      ]);
      const duplicate = await attest(f);
      expect(duplicate.status).toBe(409);
      expect(duplicate.body).toMatchObject({ code: 'CONFLICT', error: 'Batch already attested' });
      expect(await state(f.batch)).toMatchObject({ attestations: 1, reviews: 1, audits: 2 });
    },
  );
  it.each([
    ['farm', 'Certificate does not cover this farm'],
    ['owner', 'Certificate farmer organization does not match the farm owner'],
    ['crop', 'Certificate does not cover this crop'],
  ])('rejects mismatched %s without review, audit or claim changes', async (mismatch, error) => {
    const f = await fixture(-1);
    if (mismatch === 'farm') {
      const other = (
        await query(
          "INSERT INTO farms(farmer_organization_id,name,region,district) VALUES($1,'Other Farm','Northern','Tamale') RETURNING id",
          [farmer],
        )
      ).rows[0].id;
      await query('UPDATE organic_certificates SET farm_id=$1 WHERE id=$2', [other, f.certificate]);
    } else if (mismatch === 'owner') {
      await query('UPDATE organic_certificates SET farmer_organization_id=$1 WHERE id=$2', [
        certifier,
        f.certificate,
      ]);
    } else {
      await query("UPDATE organic_certificates SET crop_scope=ARRAY['peanut'] WHERE id=$1", [
        f.certificate,
      ]);
    }
    const before = await state(f.batch),
      result = await attest(f);
    expect(result.status, JSON.stringify(result.body)).toBe(400);
    expect(result.body).toMatchObject({ code: 'VALIDATION_ERROR', error });
    expect(await state(f.batch)).toEqual(before);
  });
});
