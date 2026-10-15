import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool, query } from '../../src/db';
import {
  issueCertificateRecord,
  changeCertificateStatusRecord,
} from '../../src/modules/trust/certification';
import type { TradeActor } from '../../src/modules/trading/transaction';
let owner: string, farm: string;
let issuer: TradeActor, independent: TradeActor;
const organizations: string[] = [];
async function organization(type: string) {
  const id = (
    await query(
      "INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,$2,'GH','verified') RETURNING id",
      ['Duplicate certificate ' + crypto.randomUUID(), type],
    )
  ).rows[0].id;
  organizations.push(id);
  return id;
}
async function reviewer() {
  const organizationId = await organization('certifier');
  const id = (
    await query(
      "INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,'unused','Certificate duplicate test') RETURNING id",
      [organizationId, crypto.randomUUID() + '@integration.test'],
    )
  ).rows[0].id;
  return { id, organizationId };
}
function input(standard: string, changes: Record<string, unknown> = {}) {
  return {
    farmerOrganizationId: owner,
    farmId: farm,
    standard,
    cropScope: ['cocoa'],
    validFrom: '2026-01-01',
    validTo: '2099-12-31',
    issuingAuthority: 'Test issuer',
    accreditationReference: 'Synthetic test',
    ...changes,
  };
}
beforeAll(async () => {
  owner = await organization('farmer');
  issuer = await reviewer();
  independent = await reviewer();
  farm = (
    await query(
      "INSERT INTO farms(farmer_organization_id,name,country,region,district) VALUES($1,'Duplicate scope farm','GH','Northern','Tamale') RETURNING id",
      [owner],
    )
  ).rows[0].id;
});
afterAll(async () => {
  await query('DELETE FROM trust_claim_reviews WHERE reviewer_organization_id=ANY($1::uuid[])', [
    organizations,
  ]);
  await query('DELETE FROM organic_certificates WHERE farm_id=$1', [farm]);
  await pool.end();
});
describe('active certificate duplicate boundaries', () => {
  it('rolls back issuance and review when audit attribution cannot be persisted', async () => {
    const standard = 'AUDIT-ROLLBACK-' + crypto.randomUUID();
    await expect(
      issueCertificateRecord({ ...issuer, id: crypto.randomUUID() }, input(standard)),
    ).rejects.toThrow();
    expect(
      Number(
        (
          await query(
            'SELECT count(*) FROM organic_certificates WHERE farm_id=$1 AND standard=$2',
            [farm, standard],
          )
        ).rows[0].count,
      ),
    ).toBe(0);
    expect(
      Number(
        (
          await query(
            "SELECT count(*) FROM trust_claim_reviews WHERE reviewer_organization_id=$1 AND snapshot_metadata->>'standard'=$2",
            [issuer.organizationId, standard],
          )
        ).rows[0].count,
      ),
    ).toBe(0);
  });

  it('serializes competing issuance and writes only one certificate and its audits', async () => {
    const standard = 'RACE-' + crypto.randomUUID();
    const outcomes = await Promise.allSettled([
      issueCertificateRecord(issuer, input(standard)),
      issueCertificateRecord(issuer, input(standard.toLowerCase(), { cropScope: [' COCOA '] })),
    ]);
    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((o) => o.status === 'rejected')).toHaveLength(1);
    const rows = (
      await query(
        'SELECT id FROM organic_certificates WHERE farm_id=$1 AND lower(standard)=lower($2)',
        [farm, standard],
      )
    ).rows;
    expect(rows).toHaveLength(1);
    expect(
      Number(
        (
          await query(
            "SELECT count(*) FROM audit_events WHERE actor_user_id=$1 AND entity_id=$2 AND action='certificate.issue'",
            [issuer.id, rows[0].id],
          )
        ).rows[0].count,
      ),
    ).toBe(1);
    expect(
      Number(
        (await query('SELECT count(*) FROM trust_claim_reviews WHERE entity_id=$1', [rows[0].id]))
          .rows[0].count,
      ),
    ).toBe(1);
  });
  it('permits independent issuers, standards, disjoint crops and nonoverlapping dates', async () => {
    const standard = 'SCOPES-' + crypto.randomUUID();
    await issueCertificateRecord(issuer, input(standard));
    await expect(issueCertificateRecord(independent, input(standard))).resolves.toBeTruthy();
    await expect(issueCertificateRecord(issuer, input(standard + '-OTHER'))).resolves.toBeTruthy();
    await expect(
      issueCertificateRecord(issuer, input(standard, { cropScope: ['peanut'] })),
    ).resolves.toBeTruthy();
    await expect(
      issueCertificateRecord(
        issuer,
        input(standard, { validFrom: '2025-01-01', validTo: '2025-12-31' }),
      ),
    ).resolves.toBeTruthy();
    await expect(
      issueCertificateRecord(
        issuer,
        input(standard, { validFrom: '2025-01-01', validTo: '2026-01-01' }),
      ),
    ).rejects.toThrow(/already covers/);
  });
  it('permits replacement of suspended or revoked records but refuses contradictory reinstatement', async () => {
    const standard = 'REPLACE-' + crypto.randomUUID();
    const old = await issueCertificateRecord(issuer, input(standard));
    await changeCertificateStatusRecord(issuer, old.id, 'suspend', 'Synthetic review');
    const replacement = await issueCertificateRecord(issuer, input(standard));
    await expect(
      changeCertificateStatusRecord(issuer, old.id, 'reinstate', 'Synthetic review'),
    ).rejects.toThrow(/already covers/);
    expect(
      (await query('SELECT status FROM organic_certificates WHERE id=$1', [old.id])).rows[0].status,
    ).toBe('suspended');
    expect(
      Number(
        (
          await query(
            "SELECT count(*) FROM audit_events WHERE entity_id=$1 AND action='certificate.reinstate'",
            [old.id],
          )
        ).rows[0].count,
      ),
    ).toBe(0);
    await changeCertificateStatusRecord(
      issuer,
      replacement.id,
      'revoke',
      'Synthetic replacement withdrawn',
    );
    await expect(
      changeCertificateStatusRecord(issuer, old.id, 'reinstate', 'Synthetic review complete'),
    ).resolves.toMatchObject({ status: 'active' });
    await expect(
      changeCertificateStatusRecord(issuer, replacement.id, 'reinstate', 'Not permitted'),
    ).rejects.toThrow(/Only suspended/);
  });
  it('serializes reinstatement against a replacement issuance', async () => {
    const standard = 'REINSTATE-RACE-' + crypto.randomUUID();
    const old = await issueCertificateRecord(issuer, input(standard));
    await changeCertificateStatusRecord(issuer, old.id, 'suspend', 'Synthetic review');
    const outcomes = await Promise.allSettled([
      changeCertificateStatusRecord(issuer, old.id, 'reinstate', 'Reviewed'),
      issueCertificateRecord(issuer, input(standard)),
    ]);
    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
    expect(
      Number(
        (
          await query(
            "SELECT count(*) FROM organic_certificates WHERE farm_id=$1 AND standard=$2 AND status='active'",
            [farm, standard],
          )
        ).rows[0].count,
      ),
    ).toBe(1);
  });
});
