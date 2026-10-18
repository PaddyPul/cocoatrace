import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { config } from '../../src/config/env';
import { pool, query } from '../../src/db';
import { inDatabaseTransaction } from '../../src/services/databaseTransaction';
import {
  assertFeeDispatch,
  assertNoOverdueFees,
  enrollFeePolicy,
} from '../../src/modules/feeEnforcement/service';
import { authenticator } from '../../src/testing/webauthnFixture';
import {
  createActor,
  createSupply,
  createListing,
  createOffer,
  createContract,
  type FixtureActor,
} from './support/fixtures';
const auth = (a: FixtureActor) => ({ Authorization: `Bearer ${a.token}` });
async function fixture(enrolled = true) {
  const seller = await createActor({
    type: 'exporter',
    permissions: ['offer.respond', 'contract.read', 'payment.read'],
  });
  const buyer = await createActor({ type: 'importer', permissions: ['contract.read'] });
  const supply = await createSupply(seller, { quantityKg: 10 });
  const terms = {
    quantityKg: 10,
    pricePerKg: 5,
    currency: 'EUR' as const,
    incoterm: 'FOB' as const,
  };
  const listing = await createListing(seller, supply, {
    ...terms,
    origin: 'Tema',
    destination: 'Accra',
  });
  const offer = await createOffer(buyer, listing, terms);
  const contract = await createContract(seller, buyer, supply, listing, offer, terms);
  const fee = (
    await query(
      `INSERT INTO platform_fee_invoices(contract_id,fee_payer,payer_organization_id,policy_version,rate_bps,amount_total,currency,currency_minor_units) VALUES($1,'seller',$2,$3,200,1,'EUR',2) RETURNING id`,
      [
        contract,
        seller.organizationId,
        enrolled ? 'seller-predispatch-v3' : 'seller-completion-v2',
      ],
    )
  ).rows[0].id as string;
  if (enrolled)
    await query(
      "INSERT INTO fee_collection_terms(fee_id,policy_version) VALUES($1,'seller-predispatch-v3')",
      [fee],
    );
  return { seller, buyer, contract, fee };
}
async function finance() {
  const actor = await createActor({ type: 'exporter', permissions: ['*'] });
  const options = await request(app)
    .post('/auth/mfa/registration/options')
    .set(auth(actor))
    .send({ currentPassword: actor.password });
  expect(options.status, JSON.stringify(options.body)).toBe(200);
  const enrolled = await request(app)
    .post('/auth/mfa/registration/verify')
    .set(auth(actor))
    .send({
      response: authenticator().registration(options.body.challenge),
      label: 'Finance test passkey',
    });
  expect(enrolled.status, JSON.stringify(enrolled.body)).toBe(200);
  return actor;
}
const consent = async (f: Awaited<ReturnType<typeof fixture>>, actor = f.seller) => {
  const view = await request(app)
    .get(`/contracts/${f.contract}/fee/enforcement`)
    .set(auth(f.seller));
  expect(view.status, JSON.stringify(view.body)).toBe(200);
  return request(app).post(`/contracts/${f.contract}/fee/terms`).set(auth(actor)).send({
    policyVersion: 'seller-predispatch-v3',
    accepted: true,
    expectedFingerprint: view.body.expectedFingerprint,
  });
};
const gate = (contract: string) =>
  inDatabaseTransaction((client) => assertFeeDispatch(client, contract));
beforeEach(async () => {
  await query('TRUNCATE auth_rate_limits');
});
afterAll(async () => pool.end());
describe('versioned platform fee collection enforcement', () => {
  it('leaves historical trades unchanged, requires payer consent and verified receipts for newly enrolled dispatch', async () => {
    const legacy = await fixture(false);
    await expect(gate(legacy.contract)).resolves.toBeUndefined();
    const f = await fixture();
    await expect(gate(f.contract)).rejects.toMatchObject({ code: 'FEE_TERMS_REQUIRED' });
    expect((await consent(f, f.buyer)).status).toBe(403);
    const stale = await request(app)
      .post(`/contracts/${f.contract}/fee/terms`)
      .set(auth(f.seller))
      .send({
        policyVersion: 'seller-predispatch-v3',
        accepted: true,
        expectedFingerprint: '0'.repeat(64),
      });
    expect(stale.status, JSON.stringify(stale.body)).toBe(409);

    const simultaneous = await Promise.all([consent(f), consent(f)]);
    expect(simultaneous.map((r) => r.status)).toEqual([200, 200]);
    expect(
      (
        await query(
          "SELECT id FROM audit_events WHERE entity_id=$1 AND action='fee.terms.accept'",
          [f.fee],
        )
      ).rows,
    ).toHaveLength(1);
    await expect(gate(f.contract)).rejects.toMatchObject({ code: 'FEE_PAYMENT_REQUIRED' });
    const submitted = await request(app)
      .post(`/contracts/${f.contract}/fee/submit`)
      .set(auth(f.seller))
      .send({ reference: 'External-reference-only' });
    expect(submitted.status, JSON.stringify(submitted.body)).toBe(200);
    await expect(gate(f.contract)).rejects.toMatchObject({ code: 'FEE_PAYMENT_REQUIRED' });
    const admin = await finance();
    const reviewed = await request(app)
      .post(`/contracts/${f.contract}/fee/submissions/${submitted.body.id}/review`)
      .set(auth(admin))
      .send({
        decision: 'verify',
        amount: '1.00',
        currency: 'EUR',
        receiptReference: `BANK-${crypto.randomUUID()}`,
      });
    expect(reviewed.status, JSON.stringify(reviewed.body)).toBe(200);
    await expect(gate(f.contract)).resolves.toBeUndefined();
  });
  it('grants bounded independent finance credit, rejects stale revisions and revokes the dispatch exception', async () => {
    const f = await fixture();
    expect((await consent(f)).status).toBe(200);
    const admin = await finance();
    const url = `/contracts/${f.contract}/fee/credit`;
    const input = {
      reason: 'Counterparty approved for short credit',
      expectedRevision: 0,
      creditUntil: new Date(Date.now() + 86400000).toISOString(),
    };
    const unverifiedFinance = await createActor({
      type: 'exporter',
      permissions: ['finance.manage'],
    });
    const unverified = await request(app).post(url).set(auth(unverifiedFinance)).send(input);
    expect(unverified.status, JSON.stringify(unverified.body)).toBe(403);
    expect(unverified.body.code).toBe('MFA_STEP_UP_REQUIRED');
    const granted = await request(app).post(url).set(auth(admin)).send(input);
    expect(granted.status, JSON.stringify(granted.body)).toBe(200);
    await expect(gate(f.contract)).resolves.toBeUndefined();
    expect((await request(app).post(url).set(auth(admin)).send(input)).status).toBe(409);
    expect(
      (
        await request(app)
          .post(url)
          .set(auth(admin))
          .send({ ...input, expectedRevision: 1, creditUntil: null })
      ).status,
    ).toBe(200);
    await expect(gate(f.contract)).rejects.toMatchObject({ code: 'FEE_PAYMENT_REQUIRED' });
    await query("UPDATE platform_fee_invoices SET due_at=NOW()-INTERVAL '8 days' WHERE id=$1", [
      f.fee,
    ]);
    await expect(
      inDatabaseTransaction((c) => assertNoOverdueFees(c, [f.seller.organizationId])),
    ).rejects.toMatchObject({ code: 'FEE_OVERDUE_RESTRICTION' });
    await expect(
      inDatabaseTransaction((c) => assertNoOverdueFees(c, [f.buyer.organizationId])),
    ).resolves.toBeUndefined();
    const waived = await request(app)
      .post(`/contracts/${f.contract}/fee/write-off`)
      .set(auth(admin))
      .send({ reason: 'Approved pilot goodwill waiver after credit review' });
    expect(waived.status, JSON.stringify(waived.body)).toBe(200);
    await expect(gate(f.contract)).resolves.toBeUndefined();
    const view = await request(app)
      .get(`/contracts/${f.contract}/fee/enforcement`)
      .set(auth(f.seller));
    expect(view.body.status).toBe('written_off');
    expect(view.body.receipt_verified).toBe(false);
  });
  it('voids an unpaid consented fee on bilateral cancellation while preserving its accepted terms', async () => {
    const seller = await createActor({
      type: 'exporter',
      permissions: ['offer.respond', 'contract.read'],
    });
    const buyer = await createActor({
      type: 'importer',
      permissions: ['offer.create', 'contract.read'],
    });
    const supply = await createSupply(seller, { quantityKg: 10 });
    const terms = {
      quantityKg: 10,
      pricePerKg: 5,
      currency: 'EUR' as const,
      incoterm: 'FOB' as const,
    };
    const listing = await createListing(seller, supply, {
      ...terms,
      origin: 'Tema',
      destination: 'Accra',
    });
    const offer = await createOffer(buyer, listing, terms);
    const accepted = await request(app).post(`/offers/${offer}/accept`).set(auth(seller)).send({});
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);
    const contract = accepted.body.contract.id as string;
    await inDatabaseTransaction((c) =>
      enrollFeePolicy(c, { id: seller.userId, organizationId: seller.organizationId }, contract),
    );
    const view = await request(app).get(`/contracts/${contract}/fee/enforcement`).set(auth(seller));
    const response = await request(app)
      .post(`/contracts/${contract}/fee/terms`)
      .set(auth(seller))
      .send({
        policyVersion: 'seller-predispatch-v3',
        accepted: true,
        expectedFingerprint: view.body.expectedFingerprint,
      });
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const cancel = await request(app)
      .post(`/contracts/${contract}/cancellation`)
      .set(auth(buyer))
      .send({ reason: 'Buyer no longer requires this undispatched supply' });
    expect(cancel.status, JSON.stringify(cancel.body)).toBe(200);
    const approval = await request(app)
      .post(`/contracts/${contract}/cancellation/${cancel.body.id}/approve`)
      .set(auth(seller))
      .send({});
    expect(approval.status, JSON.stringify(approval.body)).toBe(200);
    const fee = (
      await query(
        'SELECT f.status,t.terms_accepted_at FROM platform_fee_invoices f JOIN fee_collection_terms t ON t.fee_id=f.id WHERE f.contract_id=$1',
        [contract],
      )
    ).rows[0];
    expect(fee.status).toBe('void');
    expect(fee.terms_accepted_at).not.toBeNull();
  });
  it('enforces the actual milestone HTTP boundary even with a goods-payment exception and preserves arrivals', async () => {
    const seller = await createActor({
      type: 'exporter',
      permissions: ['offer.respond', 'contract.read', 'shipment.update'],
    });
    const buyer = await createActor({
      type: 'importer',
      permissions: ['offer.create', 'contract.read', 'shipment.update'],
    });
    const supply = await createSupply(seller, { quantityKg: 10 });
    const terms = {
      quantityKg: 10,
      pricePerKg: 5,
      currency: 'EUR' as const,
      incoterm: 'FOB' as const,
    };
    const listing = await createListing(seller, supply, {
      ...terms,
      origin: 'Tema',
      destination: 'Accra',
    });
    const offer = await createOffer(buyer, listing, terms);
    const previous = config.testLegacyFeePolicy;
    let accepted;
    try {
      Reflect.set(config, 'testLegacyFeePolicy', false);
      accepted = await request(app).post(`/offers/${offer}/accept`).set(auth(seller)).send({});
    } finally {
      Reflect.set(config, 'testLegacyFeePolicy', previous);
    }
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);
    const contract = accepted.body.contract.id as string,
      shipment = accepted.body.shipment.id as string;
    expect(
      (
        await query('SELECT policy_version FROM platform_fee_invoices WHERE contract_id=$1', [
          contract,
        ])
      ).rows[0].policy_version,
    ).toBe('seller-predispatch-v3');
    expect(
      (
        await query(
          'SELECT t.fee_id FROM fee_collection_terms t JOIN platform_fee_invoices f ON f.id=t.fee_id WHERE f.contract_id=$1',
          [contract],
        )
      ).rows,
    ).toHaveLength(1);
    const progress = () =>
      request(app)
        .post(`/shipments/${shipment}/milestones`)
        .set(auth(seller))
        .send({
          milestone: 'loaded',
          exceptionalDispatch: {
            reason: 'Seller accepts goods payment timing risk',
            acknowledgePaymentRisk: true,
          },
        });
    const blocked = await progress();
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('FEE_TERMS_REQUIRED');
    const view = await request(app).get(`/contracts/${contract}/fee/enforcement`).set(auth(seller));
    expect(
      (
        await request(app).post(`/contracts/${contract}/fee/terms`).set(auth(seller)).send({
          policyVersion: 'seller-predispatch-v3',
          accepted: true,
          expectedFingerprint: view.body.expectedFingerprint,
        })
      ).status,
    ).toBe(200);
    const unpaid = await progress();
    expect(unpaid.status).toBe(409);
    expect(unpaid.body.code).toBe('FEE_PAYMENT_REQUIRED');
    const admin = await finance();
    expect(
      (
        await request(app)
          .post(`/contracts/${contract}/fee/credit`)
          .set(auth(admin))
          .send({
            reason: 'Reviewed short credit for this trade only',
            expectedRevision: 0,
            creditUntil: new Date(Date.now() + 86400000).toISOString(),
          })
      ).status,
    ).toBe(200);
    const loaded = await progress();
    expect(loaded.status, JSON.stringify(loaded.body)).toBe(200);
    await query(
      "UPDATE fee_collection_terms SET credit_until=NOW()-INTERVAL '1 second' WHERE fee_id=(SELECT id FROM platform_fee_invoices WHERE contract_id=$1)",
      [contract],
    );
    const arrived = await request(app)
      .post(`/shipments/${shipment}/milestones`)
      .set(auth(buyer))
      .send({ milestone: 'arrived' });
    expect(arrived.status, JSON.stringify(arrived.body)).toBe(200);
    const second = await createOffer(buyer, listing, terms);
    await query(
      "UPDATE platform_fee_invoices SET due_at=NOW()-INTERVAL '8 days' WHERE contract_id=$1",
      [contract],
    );
    const restricted = await request(app)
      .post(`/offers/${second}/accept`)
      .set(auth(seller))
      .send({});
    expect(restricted.status, JSON.stringify(restricted.body)).toBe(409);
    expect(restricted.body.code).toBe('FEE_OVERDUE_RESTRICTION');
  });
  it('rolls back consent and invoice issuance when its critical audit cannot be recorded', async () => {
    const f = await fixture();
    const trigger = `fee_fail_${crypto.randomBytes(5).toString('hex')}`;
    await query(
      `CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_id='${f.fee}'::uuid AND NEW.action='fee.terms.accept' THEN RAISE EXCEPTION 'forced audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER ${trigger} BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION ${trigger}()`,
    );
    try {
      expect((await consent(f)).status).toBe(500);
      expect(
        (await query('SELECT terms_accepted_at FROM fee_collection_terms WHERE fee_id=$1', [f.fee]))
          .rows[0].terms_accepted_at,
      ).toBeNull();
      expect(
        (await query('SELECT status FROM platform_fee_invoices WHERE id=$1', [f.fee])).rows[0]
          .status,
      ).toBe('estimated');
    } finally {
      await query(`DROP TRIGGER ${trigger} ON audit_events; DROP FUNCTION ${trigger}()`);
    }
  });
});
