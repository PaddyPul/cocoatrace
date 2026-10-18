import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
import { inDatabaseTransaction } from '../../src/services/databaseTransaction';
import { assertFeeDispatch } from '../../src/modules/feeEnforcement/service';
import { reconcileFees } from '../../src/modules/fees/reconciliation';
import { authenticator } from '../../src/testing/webauthnFixture';
import {
  createActor,
  createSupply,
  createListing,
  createOffer,
  createContract,
  createShipment,
  type FixtureActor,
} from './support/fixtures';
const auth = (a: FixtureActor) => ({ Authorization: `Bearer ${a.token}` });
async function fixture() {
  const seller = await createActor({
    type: 'exporter',
    permissions: ['offer.respond', 'contract.read'],
  });
  const buyer = await createActor({
    type: 'importer',
    permissions: ['contract.read', 'offer.create', 'payment.confirm'],
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
  const contract = await createContract(seller, buyer, supply, listing, offer, terms);
  // Materialize the same reservation state as an accepted offer without
  // invoking the separate fee-policy setup that this fixture exercises directly.
  await query("UPDATE batch_holdings SET status='committed' WHERE id=$1", [supply.holdingId]);
  await query('UPDATE listings SET active=false WHERE id=$1', [listing]);
  await query("UPDATE trade_offers SET status='accepted' WHERE id=$1", [offer]);
  const finance = await createActor({ type: 'exporter', permissions: ['*'] });
  const options = await request(app)
    .post('/auth/mfa/registration/options')
    .set(auth(finance))
    .send({ currentPassword: finance.password });
  expect(options.status, JSON.stringify(options.body)).toBe(200);
  const registered = await request(app)
    .post('/auth/mfa/registration/verify')
    .set(auth(finance))
    .send({
      response: authenticator().registration(options.body.challenge),
      label: 'Refund finance passkey',
    });
  expect(registered.status, JSON.stringify(registered.body)).toBe(200);
  const fee = (
    await query(
      `INSERT INTO platform_fee_invoices(contract_id,fee_payer,payer_organization_id,policy_version,rate_bps,amount_total,currency,currency_minor_units,status,paid_at,verified_by_user_id,platform_receipt_reference) VALUES($1,'seller',$2,'seller-predispatch-v3',200,1,'EUR',2,'paid',NOW(),$3,$4) RETURNING id`,
      [contract, seller.organizationId, finance.userId, crypto.randomUUID()],
    )
  ).rows[0].id;
  await query(
    `INSERT INTO platform_fee_submissions(fee_id,submitted_by_user_id,submitted_by_organization_id,reference,status,reviewed_by_user_id,reviewed_at) VALUES($1,$2,$3,'ORIGINAL-PAID','verified',$4,NOW())`,
    [fee, seller.userId, seller.organizationId, finance.userId],
  );
  const payment = (
    await query(
      `INSERT INTO payment_requests(contract_id,requested_by_organization_id,amount_total,currency,status,payment_method,due_trigger,dispatch_required_amount,security_status,currency_minor_units) VALUES($1,$2,50,'EUR','awaiting_terms','deposit_balance','terms_agreed',10,'not_required',2) RETURNING id`,
      [contract, seller.organizationId],
    )
  ).rows[0].id;
  const shipment = await createShipment(contract, {
    coordinatorOrganizationId: buyer.organizationId,
  });
  await query("UPDATE batch_holdings SET status='committed' WHERE id=$1", [supply.holdingId]);
  await query('UPDATE listings SET active=false WHERE id=$1', [listing]);
  return { seller, buyer, finance, contract, fee, payment, shipment };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
const read = (f: Fixture, a = f.seller) =>
  request(app).get(`/contracts/${f.contract}/fee/refund`).set(auth(a));
async function ask(f: Fixture) {
  const view = await read(f);
  expect(view.status, JSON.stringify(view.body)).toBe(200);
  return {
    reason: 'Trade cancelled before fulfillment; refund the platform fee',
    idempotencyKey: crypto.randomUUID(),
    expectedFingerprint: view.body.expectedFingerprint,
  };
}
const post = (f: Fixture, a: FixtureActor, action: string, body: object) =>
  request(app).post(`/contracts/${f.contract}/fee/refund/${action}`).set(auth(a)).send(body);
beforeEach(async () => {
  await query('TRUNCATE auth_rate_limits');
});
afterAll(async () => pool.end());
describe('full external platform fee refund recovery', () => {
  it('records independent external refund then payer receipt, retaining original paid receipt and redacting reference from the buyer', async () => {
    const f = await fixture();
    const original = (await query('SELECT * FROM platform_fee_invoices WHERE id=$1', [f.fee]))
      .rows[0];
    const input = await ask(f);
    const responses = await Promise.all([
      post(f, f.seller, 'request', input),
      post(f, f.seller, 'request', input),
    ]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    const refund = responses[0].body.refund;
    expect(
      (await query('SELECT id FROM fee_refund_requests WHERE fee_id=$1', [f.fee])).rows,
    ).toHaveLength(1);
    await expect(
      inDatabaseTransaction((client) => assertFeeDispatch(client, f.contract)),
    ).rejects.toMatchObject({ code: 'FEE_REFUND_HOLD' });
    await query("UPDATE sales_contracts SET payment_terms_status='agreed' WHERE id=$1", [
      f.contract,
    ]);
    const installment = (
      await query(
        "INSERT INTO payment_installments(payment_request_id,installment_type,sequence_number,amount_due,due_trigger,status,currency_minor_units) VALUES($1,'full',1,50,'terms_agreed','due',2) RETURNING id",
        [f.payment],
      )
    ).rows[0].id;
    const heldPayment = await request(app)
      .post(`/payment-installments/${installment}/submit`)
      .set(auth(f.buyer))
      .send({ transactionReference: 'NO-GOODS-MONEY-DURING-REFUND' });
    expect(heldPayment.status, JSON.stringify(heldPayment.body)).toBe(409);
    expect(heldPayment.body.code).toBe('FEE_REFUND_HOLD');
    const send = {
      refundId: refund.id,
      expectedRevision: 0,
      reason: 'Bank transfer completed; full fee returned',
      amount: refund.amount,
      currency: 'EUR',
      reference: crypto.randomUUID(),
    };
    expect((await post(f, f.seller, 'send', send)).status).toBe(403);
    const sent = await post(f, f.finance, 'send', send);
    expect(sent.status, JSON.stringify(sent.body)).toBe(200);
    expect(sent.body.refund.status).toBe('sent');
    expect((await read(f, f.buyer)).body.refund.externalReference).toBeUndefined();
    const confirmed = await post(f, f.seller, 'confirm', {
      refundId: refund.id,
      expectedRevision: 1,
      reason: 'Full external refund actually arrived in our account',
    });
    expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200);
    expect(confirmed.body.refund.status).toBe('confirmed');
    expect(
      (await query('SELECT * FROM platform_fee_invoices WHERE id=$1', [f.fee])).rows[0],
    ).toEqual(original);
    expect(confirmed.body.history.map((r: { action: string }) => r.action)).toEqual([
      'requested',
      'sent',
      'confirmed',
    ]);
    const cancellation = await request(app)
      .post(`/contracts/${f.contract}/cancellation`)
      .set(auth(f.buyer))
      .send({ reason: 'Full platform fee refunded; both parties agree to cancel' });
    expect(cancellation.status, JSON.stringify(cancellation.body)).toBe(200);
    const approved = await request(app)
      .post(`/contracts/${f.contract}/cancellation/${cancellation.body.id}/approve`)
      .set(auth(f.seller))
      .send({});
    expect(approved.status, JSON.stringify(approved.body)).toBe(200);
    expect(
      (await query('SELECT status FROM sales_contracts WHERE id=$1', [f.contract])).rows[0].status,
    ).toBe('cancelled');
    expect(
      (await query('SELECT * FROM platform_fee_invoices WHERE id=$1', [f.fee])).rows[0],
    ).toEqual(original);
    const reconciliation = await inDatabaseTransaction((client) => reconcileFees(client));
    expect(reconciliation.issues.filter((issue) => issue.fee_id === f.fee)).toEqual([]);
    expect(
      reconciliation.confirmedRefundTotals.some(
        (row) => row.currency === 'EUR' && Number(row.amount_total) >= 1,
      ),
    ).toBe(true);
    await expect(
      query("UPDATE fee_refund_requests SET reason='Tampered original reason' WHERE id=$1", [
        refund.id,
      ]),
    ).rejects.toThrow();
  });
  it('requires current independent fresh finance, exact amount, stale revision protection and tenant boundaries', async () => {
    const f = await fixture();
    const input = await ask(f);
    const opened = await post(f, f.seller, 'request', input);
    expect(opened.status, JSON.stringify(opened.body)).toBe(200);
    const refund = opened.body.refund;
    const stranger = await createActor({
      type: 'exporter',
      permissions: ['offer.respond', 'contract.read'],
    });
    expect((await read(f, stranger)).status).toBe(404);
    const unverified = await createActor({ type: 'exporter', permissions: ['finance.manage'] });
    const payload = {
      refundId: refund.id,
      expectedRevision: 0,
      amount: refund.amount,
      currency: 'EUR',
      reference: crypto.randomUUID(),
      reason: 'Full fee transfer investigated and returned',
    };
    const denied = await post(f, unverified, 'send', payload);
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('MFA_STEP_UP_REQUIRED');
    expect((await post(f, f.finance, 'send', { ...payload, amount: '0.5' })).status).toBe(400);
    expect(
      (
        await post(f, f.finance, 'reject', {
          refundId: refund.id,
          expectedRevision: 2,
          reason: 'Reviewed refund request cannot be supported',
        })
      ).status,
    ).toBe(409);
    const rejected = await post(f, f.finance, 'reject', {
      refundId: refund.id,
      expectedRevision: 0,
      reason: 'Reviewed refund request cannot be supported',
    });
    expect(rejected.status, JSON.stringify(rejected.body)).toBe(200);
    expect(rejected.body.canRequest).toBe(true);
  });
  it('blocks goods payment, dispatch and stale receipt snapshots rather than refunding an active trade', async () => {
    const f = await fixture();
    const input = await ask(f);
    await query("UPDATE payment_requests SET payment_reference_external='GOODS-SENT' WHERE id=$1", [
      f.payment,
    ]);
    expect((await post(f, f.seller, 'request', input)).status).toBe(409);
    await query('UPDATE payment_requests SET payment_reference_external=NULL WHERE id=$1', [
      f.payment,
    ]);
    await query("UPDATE shipments SET current_milestone='booked' WHERE id=$1", [f.shipment]);
    expect((await post(f, f.seller, 'request', input)).status).toBe(409);
    await query("UPDATE shipments SET current_milestone='planning' WHERE id=$1", [f.shipment]);
    expect(
      (await post(f, f.seller, 'request', { ...input, expectedFingerprint: '0'.repeat(64) }))
        .status,
    ).toBe(409);
  });
  it('rolls back refund request and history if its critical audit fails', async () => {
    const f = await fixture();
    const input = await ask(f);
    const suffix = crypto.randomUUID().replaceAll('-', '');
    const fn = `refund_audit_${suffix}`;
    await query(
      `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_id='${f.fee}'::uuid AND NEW.action='fee.refund.requested' THEN RAISE EXCEPTION 'forced audit failure'; END IF; RETURN NEW; END $$`,
    );
    await query(
      `CREATE TRIGGER ${fn} BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION ${fn}()`,
    );
    try {
      expect((await post(f, f.seller, 'request', input)).status).toBe(500);
      expect(
        (await query('SELECT id FROM fee_refund_requests WHERE fee_id=$1', [f.fee])).rows,
      ).toHaveLength(0);
    } finally {
      await query(`DROP TRIGGER ${fn} ON audit_events`);
      await query(`DROP FUNCTION ${fn}()`);
    }
  });
});
