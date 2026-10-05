import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import app from '../../src/app';
import { query, pool } from '../../src/db';
type Actor = { organizationId: string; token: string; userId: string };
let seller: Actor, buyer: Actor, outsider: Actor, admin: Actor;
const nativeIt = process.env.COCOATRACE_SUPPLEMENTAL_DATABASE === 'true' ? it.skip : it;
async function actor(type: string, permissions: string[], organizationId?: string): Promise<Actor> {
  const key = crypto.randomUUID();
  const org = organizationId
    ? { id: organizationId }
    : (
        await query(
          "INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,$2,'GH','verified') RETURNING id",
          [`Fee test ${key}`, type],
        )
      ).rows[0];
  const email = `fee-${key}@integration.test`,
    password = 'FeeCollectionTesting123!';
  const user = (
    await query(
      'INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',
      [org.id, email, await bcrypt.hash(password, 4), 'Fee test member'],
    )
  ).rows[0];
  const role = (
    await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id', [
      `fee-${key}`,
      permissions,
    ])
  ).rows[0];
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [user.id, role.id]);
  const login = await request(app).post('/auth/login').send({ email, password });
  expect(login.status).toBe(200);
  return { organizationId: org.id, userId: user.id, token: login.body.accessToken };
}
const post = (path: string, who: Actor, body = {}) =>
  request(app).post(path).set('Authorization', `Bearer ${who.token}`).send(body);
const get = (path: string, who: Actor) =>
  request(app).get(path).set('Authorization', `Bearer ${who.token}`);
async function deal(complete = true, price = 5, acceptDelivery = true) {
  const batch = (
    await query(
      "INSERT INTO harvest_batches(crop,harvest_date,quantity_kg,current_holder_id,source_mode,source_name,source_country) VALUES('peanut',CURRENT_DATE,10,$1,'direct_inventory','Fee test','GH') RETURNING id",
      [seller.organizationId],
    )
  ).rows[0];
  const h = (
    await query(
      'INSERT INTO batch_holdings(batch_id,holder_organization_id,quantity_kg) VALUES($1,$2,10) RETURNING id',
      [batch.id, seller.organizationId],
    )
  ).rows[0];
  const l = (
    await query(
      "INSERT INTO listings(seller_organization_id,holding_id,available_quantity_kg,price_per_kg,currency,incoterm,origin_location,destination_location) VALUES($1,$2,10,$3,'EUR','FOB','Tema','Rotterdam') RETURNING id",
      [seller.organizationId, h.id, price],
    )
  ).rows[0];
  const o = (
    await query(
      "INSERT INTO trade_offers(listing_id,buyer_organization_id,quantity_kg,offered_price_per_kg,currency,valid_until) VALUES($1,$2,4,$3,'EUR',NOW()+INTERVAL '1 day') RETURNING id",
      [l.id, buyer.organizationId, price],
    )
  ).rows[0];
  const accepted = await post(`/offers/${o.id}/accept`, seller);
  expect(accepted.status).toBe(200);
  const { contract, shipment, paymentRequest } = accepted.body;
  if (complete) {
    expect(
      (
        await request(app)
          .patch(`/contracts/${contract.id}/payment-terms`)
          .set('Authorization', `Bearer ${seller.token}`)
          .send({ paymentPlan: 'pay_before_dispatch', paymentEvidenceRequired: false })
      ).status,
    ).toBe(200);
    expect((await post(`/contracts/${contract.id}/payment-terms/confirm`, buyer)).status).toBe(200);
    const installment = (
      await query('SELECT id FROM payment_installments WHERE payment_request_id=$1', [
        paymentRequest.id,
      ])
    ).rows[0];
    expect(
      (
        await post(`/payment-installments/${installment.id}/submit`, buyer, {
          transactionReference: 'GOODS-PAYMENT',
        })
      ).status,
    ).toBe(200);
    expect((await post(`/payment-installments/${installment.id}/confirm`, seller)).status).toBe(
      200,
    );
    expect(
      (await post(`/shipments/${shipment.id}/milestones`, buyer, { milestone: 'delivered' }))
        .status,
    ).toBe(200);
    if (acceptDelivery)
      expect(
        (
          await post(`/contracts/${contract.id}/delivery/accept`, buyer, {
            receivedQuantityKg: 4,
            note: 'Inspected and accepted for fee regression',
          })
        ).status,
      ).toBe(200);
  }
  const f = (await get(`/contracts/${contract.id}/fee`, seller)).body.fee;
  return {
    contractId: contract.id,
    feeId: f.id,
    amount: f.amount_total,
    holdingId: contract.holding_id,
  };
}
const path = (d: Awaited<ReturnType<typeof deal>>, suffix = '') =>
  `/contracts/${d.contractId}/fee${suffix}`;
async function submit(d: Awaited<ReturnType<typeof deal>>, reference = 'PAYER-BANK-TRANSFER') {
  const r = await post(path(d, '/submit'), seller, { reference });
  expect(r.status).toBe(200);
  return r.body;
}
const verify = (
  d: Awaited<ReturnType<typeof deal>>,
  submissionId: string,
  receipt = crypto.randomUUID(),
) =>
  post(path(d, `/submissions/${submissionId}/review`), admin, {
    decision: 'verify',
    amount: d.amount,
    currency: 'EUR',
    receiptReference: receipt,
  });
beforeAll(async () => {
  const common = [
    'contract.read',
    'payment.read',
    'offer.respond',
    'offer.create',
    'payment.request',
    'payment.confirm',
    'shipment.update',
  ];
  seller = await actor('exporter', common);
  buyer = await actor('importer', common);
  outsider = await actor('importer', common);
  admin = await actor('auditor', ['finance.manage']);
});
afterAll(async () => {
  await pool.end();
});
describe('commercial fee statements and controlled collection', () => {
  it('creates an exact decimal fee snapshot and makes it due only on completed trade', async () => {
    const d = await deal(false, 0.125),
      r = await get(path(d), seller);
    expect(r.status).toBe(200);
    expect(r.body.fee).toMatchObject({
      amount_total: '0.01',
      status: 'estimated',
      payer_organization_id: seller.organizationId,
      policy_version: 'seller-completion-v1',
      tax_status: 'not_configured',
    });
    expect(r.body.documentType).toBe('commercial_fee_statement');
    expect(r.body.taxNotice).toContain('not a tax invoice');
    expect((await post(path(d, '/submit'), seller, { reference: 'NOT-YET-DUE' })).status).toBe(409);
    const complete = await deal();
    expect((await get(path(complete), seller)).body.fee).toMatchObject({
      status: 'invoiced',
      contract_status: 'settled',
    });
    expect((await get(path(complete), seller)).body.fee.due_at).toBeTruthy();
  });
  it('zero fees never require payment and stale fee quotes cannot be accepted', async () => {
    const zero = await deal(true, 0.01);
    expect(zero.amount).toBe('0.00');
    expect((await post(path(zero, '/submit'), seller, { reference: 'NO-FEE-DUE' })).status).toBe(
      409,
    );
    const pending = await deal(false);
    const offer = (
      await query('SELECT offer_id FROM sales_contracts WHERE id=$1', [pending.contractId])
    ).rows[0];
    // A fresh offer on the unsold continuation tests quote validation before inventory changes.
    const listing = (
      await query(
        'SELECT id FROM listings WHERE seller_organization_id=$1 AND active ORDER BY created_at DESC LIMIT 1',
        [seller.organizationId],
      )
    ).rows[0];
    const o = (
      await query(
        "INSERT INTO trade_offers(listing_id,buyer_organization_id,quantity_kg,offered_price_per_kg,currency,valid_until) VALUES($1,$2,1,5,'EUR',NOW()+INTERVAL '1 day') RETURNING id",
        [listing.id, buyer.organizationId],
      )
    ).rows[0];
    const quotes = await get('/offers', seller);
    const quote = quotes.body.find((row: { id: string }) => row.id === o.id);
    expect(
      (
        await post(`/offers/${o.id}/accept`, seller, {
          feeRateBps: quote.platform_fee_rate_bps === 0 ? 1 : 0,
        })
      ).status,
    ).toBe(409);
    expect(
      (await query('SELECT status FROM trade_offers WHERE id=$1', [o.id])).rows[0].status,
    ).toBe('pending');
    expect(offer.offer_id).toBeTruthy();
  });
  it('scopes statements and exports, hides payer references from buyer, and denies unrelated actors', async () => {
    const d = await deal();
    await submit(d, 'PRIVATE-PAYER-REFERENCE');
    expect((await get(path(d), buyer)).body.submissions).toEqual([]);
    expect((await get(path(d, '/statement'), buyer)).body.submissions).toEqual([]);
    expect((await get(path(d), outsider)).status).toBe(404);
    expect((await get(path(d, '/statement'), outsider)).status).toBe(404);
    expect(
      (await post(path(d, '/submit'), buyer, { reference: 'BUYER-CANNOT-PAY-SELLER-FEE' })).status,
    ).toBe(403);
    expect(
      (await get('/platform-fees', outsider)).body.some((f: { id: string }) => f.id === d.feeId),
    ).toBe(false);
    expect((await get('/platform-fees/reconciliation', seller)).status).toBe(403);
    expect((await request(app).get(path(d))).status).toBe(401);
  });
  it('submission does not pay the fee; rejects mismatch and verifies receipt once', async () => {
    const d = await deal(),
      s = await submit(d);
    expect((await get(path(d), seller)).body.fee.status).toBe('invoiced');
    expect((await submit(d)).id).toBe(s.id);
    expect((await post(path(d, '/submit'), seller, { reference: 'OTHER-REFERENCE' })).status).toBe(
      409,
    );
    expect(
      (
        await post(path(d, `/submissions/${s.id}/review`), seller, {
          decision: 'verify',
          amount: d.amount,
          currency: 'EUR',
          receiptReference: 'SELF-RECEIPT',
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await post(path(d, `/submissions/${s.id}/review`), admin, {
          decision: 'verify',
          amount: '999.99',
          currency: 'EUR',
          receiptReference: 'WRONG-AMOUNT',
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await post(path(d, `/submissions/${s.id}/review`), admin, {
          decision: 'verify',
          amount: d.amount,
          currency: 'USD',
          receiptReference: 'WRONG-CURRENCY',
        })
      ).status,
    ).toBe(409);
    const receipt = crypto.randomUUID();
    expect((await verify(d, s.id, receipt)).status).toBe(200);
    expect((await verify(d, s.id, receipt)).status).toBe(200);
    expect((await get(path(d), seller)).body.fee.status).toBe('paid');
    expect(
      (
        await query(
          "SELECT COUNT(*)::int n FROM audit_events WHERE entity_id=$1 AND action='fee.payment.verify'",
          [d.feeId],
        )
      ).rows[0].n,
    ).toBe(1);
    expect(
      (await query('SELECT holder_organization_id FROM batch_holdings WHERE id=$1', [d.holdingId]))
        .rows[0].holder_organization_id,
    ).toBe(buyer.organizationId);
  });
  it('retains legacy paid status without claiming its receipt was verified', async () => {
    const d = await deal();
    await query(
      "UPDATE platform_fee_invoices SET status='paid',paid_at=NOW(),payment_reference_external='LEGACY-REFERENCE' WHERE id=$1",
      [d.feeId],
    );
    const view = await get(path(d), seller);
    expect(view.body.fee.status).toBe('paid');
    expect(view.body.fee.receipt_verified).toBe(false);
    const report = await get('/platform-fees/reconciliation', admin);
    expect(report.body.issues).toContainEqual({
      code: 'FEE_PAID_WITHOUT_VERIFIED_RECEIPT',
      fee_id: d.feeId,
      contract_id: d.contractId,
    });
  });
  it('retains rejected history, permits resubmission and never revives a reviewed submission', async () => {
    const d = await deal(),
      s = await submit(d);
    const rejection = await post(path(d, `/submissions/${s.id}/review`), admin, {
      decision: 'reject',
      reason: 'Receipt not found on the platform bank account',
    });
    expect(rejection.status).toBe(200);
    expect((await verify(d, s.id)).status).toBe(409);
    const next = await submit(d, 'CORRECTED-REFERENCE');
    expect(next.id).not.toBe(s.id);
    expect((await verify(d, next.id)).status).toBe(200);
    expect((await get(path(d), seller)).body.submissions).toHaveLength(2);
  });
  it('write-off requires a reason and closes fee without changing settled trade or custody', async () => {
    const d = await deal();
    expect((await post(path(d, '/write-off'), admin, { reason: 'short' })).status).toBe(400);
    expect(
      (await post(path(d, '/write-off'), seller, { reason: 'A supplier cannot waive its own fee' }))
        .status,
    ).toBe(403);
    const reason = 'Platform-approved pilot commercial waiver';
    expect((await post(path(d, '/write-off'), admin, { reason })).status).toBe(200);
    expect((await post(path(d, '/write-off'), admin, { reason })).status).toBe(200);
    expect((await get(path(d), seller)).body.fee.status).toBe('written_off');
    expect(
      (await query('SELECT status FROM sales_contracts WHERE id=$1', [d.contractId])).rows[0]
        .status,
    ).toBe('settled');
    expect(
      (
        await query(
          "SELECT COUNT(*)::int n FROM audit_events WHERE entity_id=$1 AND action='fee.write_off'",
          [d.feeId],
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it('cannot write off a pending receipt or collect a voided cancellation fee', async () => {
    const d = await deal();
    await submit(d);
    expect(
      (
        await post(path(d, '/write-off'), admin, {
          reason: 'Must review incoming payment before waiver',
        })
      ).status,
    ).toBe(409);
    const cancelled = await deal(false);
    const r = await post(`/contracts/${cancelled.contractId}/cancellation`, seller, {
      reason: 'Both parties agree not to begin this trade',
    });
    expect(r.status).toBe(200);
    expect(
      (await post(`/contracts/${cancelled.contractId}/cancellation/${r.body.id}/approve`, buyer))
        .status,
    ).toBe(200);
    expect(
      (await post(path(cancelled, '/submit'), seller, { reference: 'VOID-FEE-REFERENCE' })).status,
    ).toBe(409);
  });
  it('read-only payer members cannot submit and malformed identifiers and receipt amounts fail', async () => {
    const d = await deal(),
      reader = await actor('exporter', ['contract.read'], seller.organizationId);
    expect((await get(path(d), reader)).status).toBe(200);
    expect(
      (await post(path(d, '/submit'), reader, { reference: 'READONLY-REFERENCE' })).status,
    ).toBe(403);
    expect((await get('/contracts/not-a-uuid/fee', seller)).status).toBe(400);
    const s = await submit(d);
    expect(
      (
        await post(path(d, `/submissions/${s.id}/review`), admin, {
          decision: 'verify',
          amount: '1e2',
          currency: 'EUR',
          receiptReference: 'NOT-DECIMAL',
        })
      ).status,
    ).toBe(400);
  });
  it('reconciliation reports currency-separated totals and identifies amount drift without repairing it', async () => {
    const d = await deal();
    await query('UPDATE platform_fee_invoices SET amount_total=amount_total+1 WHERE id=$1', [
      d.feeId,
    ]);
    const report = await get('/platform-fees/reconciliation', admin);
    expect(report.status).toBe(200);
    expect(report.body.issues).toContainEqual({
      code: 'FEE_AMOUNT_OR_CURRENCY_MISMATCH',
      fee_id: d.feeId,
      contract_id: d.contractId,
    });
    expect(
      report.body.totals.every(
        (t: { currency: string; amount_total: unknown }) =>
          t.currency.length === 3 && typeof t.amount_total === 'string',
      ),
    ).toBe(true);
    expect(
      (await query('SELECT amount_total FROM platform_fee_invoices WHERE id=$1', [d.feeId])).rows[0]
        .amount_total,
    ).toBe('1.20');
    expect((await post(path(d, '/submit'), seller, { reference: 'DRIFT-MUST-BLOCK' })).status).toBe(
      409,
    );
  });
  it('failure of the fee-due audit rolls custody settlement and fee accrual back together', async () => {
    const d = await deal(true, 5, false),
      trigger = `fee_due_${crypto.randomUUID().replaceAll('-', '')}`;
    await query(
      `CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_id='${d.feeId}'::uuid AND NEW.action='fee.statement.due' THEN RAISE EXCEPTION 'fee due audit failure';END IF;RETURN NEW;END;$$;CREATE TRIGGER ${trigger} BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION ${trigger}()`,
    );
    try {
      expect(
        (
          await post(`/contracts/${d.contractId}/delivery/accept`, buyer, {
            receivedQuantityKg: 4,
            note: 'Fee issue rollback regression',
          })
        ).status,
      ).toBe(500);
      expect((await get(path(d), seller)).body.fee.status).toBe('estimated');
      expect(
        (await query('SELECT status FROM sales_contracts WHERE id=$1', [d.contractId])).rows[0]
          .status,
      ).not.toBe('settled');
      expect(
        (await query('SELECT status FROM batch_holdings WHERE id=$1', [d.holdingId])).rows[0]
          .status,
      ).toBe('committed');
      expect(
        (
          await query('SELECT COUNT(*)::int n FROM delivery_acceptances WHERE contract_id=$1', [
            d.contractId,
          ])
        ).rows[0].n,
      ).toBe(0);
    } finally {
      await query(`DROP TRIGGER ${trigger} ON audit_events;DROP FUNCTION ${trigger}()`);
    }
  });
  it('critical audit failure rolls fee verification and submission state back', async () => {
    const d = await deal(),
      s = await submit(d);
    const trigger = `fee_audit_${crypto.randomUUID().replaceAll('-', '')}`;
    await query(
      `CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_id='${d.feeId}'::uuid AND NEW.action='fee.payment.verify' THEN RAISE EXCEPTION 'fee regression audit failure';END IF;RETURN NEW;END;$$;CREATE TRIGGER ${trigger} BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION ${trigger}()`,
    );
    try {
      expect((await verify(d, s.id)).status).toBe(500);
      expect((await get(path(d), seller)).body.fee.status).toBe('invoiced');
      expect((await get(path(d), seller)).body.submissions[0].status).toBe('submitted');
    } finally {
      await query(`DROP TRIGGER ${trigger} ON audit_events;DROP FUNCTION ${trigger}()`);
    }
  });
  nativeIt('serializes concurrent receipt verification into one audit', async () => {
    const d = await deal(),
      s = await submit(d),
      receipt = crypto.randomUUID();
    const responses = await Promise.all([verify(d, s.id, receipt), verify(d, s.id, receipt)]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    expect(
      (
        await query(
          "SELECT COUNT(*)::int n FROM audit_events WHERE entity_id=$1 AND action='fee.payment.verify'",
          [d.feeId],
        )
      ).rows[0].n,
    ).toBe(1);
  });
  nativeIt('one bank receipt cannot pay two fee statements during a race', async () => {
    const a = await deal(),
      b = await deal(),
      sa = await submit(a),
      sb = await submit(b),
      receipt = crypto.randomUUID();
    const responses = await Promise.all([
      verify(a, sa.id, receipt),
      verify(b, sb.id, receipt.toUpperCase()),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      (
        await query(
          "SELECT COUNT(*)::int n FROM platform_fee_invoices WHERE id=ANY($1::uuid[]) AND status='paid'",
          [[a.feeId, b.feeId]],
        )
      ).rows[0].n,
    ).toBe(1);
  });
});
