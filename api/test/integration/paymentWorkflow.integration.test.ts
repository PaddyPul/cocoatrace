import * as audit from '../../src/services/audit';
import { automaticallyPresentDocuments } from '../../src/modules/payments/documentsAndSecurity';
import { expectIdenticalNotFound } from './support/errorAssertions';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
import { evidenceStorage } from '../../src/services/evidenceStorage';
import type { PaymentPlan } from '../../src/services/paymentProtection';

type Actor = { organizationId: string; token: string; userId: string };
let seller: Actor, buyer: Actor, outsider: Actor;
const keys: string[] = [];
const nativeIt = process.env.COCOATRACE_SUPPLEMENTAL_DATABASE === 'true' ? it.skip : it;

async function actor(type: 'exporter' | 'importer'): Promise<Actor> {
  const suffix = crypto.randomUUID();
  const org = (await query("INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,$2,'GH','verified') RETURNING id", [`Payment ${suffix}`, type])).rows[0];
  const email = `pay-${suffix}@integration.test`, password = 'PaymentRegression123!';
  const user = (await query('INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id', [org.id, email, await bcrypt.hash(password, 4), 'Payment regression'])).rows[0];
  const role = (await query("INSERT INTO roles(name,permissions) VALUES($1,ARRAY['*']) RETURNING id", [`pay-${suffix}`])).rows[0];
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [user.id, role.id]);
  const login = await request(app).post('/auth/login').send({ email, password });
  expect(login.status).toBe(200);
  return { organizationId: org.id, userId: user.id, token: login.body.accessToken };
}
const post = (path: string, principal: Actor, body = {}) => request(app).post(path).set('Authorization', `Bearer ${principal.token}`).send(body);
const get = (path: string, principal: Actor) => request(app).get(path).set('Authorization', `Bearer ${principal.token}`);

async function deal(plan: PaymentPlan, proof = false, incoterm = 'FOB', confirm = true) {
  const batch = (await query("INSERT INTO harvest_batches(crop,harvest_date,quantity_kg,current_holder_id,source_mode,source_name,source_country) VALUES('peanut',CURRENT_DATE,10,$1,'direct_inventory','Payment regression','GH') RETURNING id", [seller.organizationId])).rows[0];
  const holding = (await query('INSERT INTO batch_holdings(batch_id,holder_organization_id,quantity_kg) VALUES($1,$2,10) RETURNING id', [batch.id, seller.organizationId])).rows[0];
  const listing = (await query("INSERT INTO listings(seller_organization_id,holding_id,available_quantity_kg,price_per_kg,currency,incoterm,origin_location,destination_location) VALUES($1,$2,10,5,'EUR',$3,'Tema','Rotterdam') RETURNING id", [seller.organizationId, holding.id, incoterm])).rows[0];
  const offer = (await query("INSERT INTO trade_offers(listing_id,buyer_organization_id,quantity_kg,offered_price_per_kg,currency,valid_until) VALUES($1,$2,4,5,'EUR',NOW()+INTERVAL '1 day') RETURNING id", [listing.id, buyer.organizationId])).rows[0];
  const accepted = await post(`/offers/${offer.id}/accept`, seller);
  expect(accepted.status).toBe(200);
  const { contract, shipment, paymentRequest } = accepted.body;
  const payment = paymentRequest || (await query('SELECT * FROM payment_requests WHERE contract_id=$1', [contract.id])).rows[0];
  expect((await request(app).patch(`/contracts/${contract.id}/payment-terms`).set('Authorization', `Bearer ${seller.token}`).send( { paymentPlan: plan, depositPercentage: 20, creditDays: 0, paymentEvidenceRequired: proof })).status).toBe(200);
  if (confirm) expect((await post(`/contracts/${contract.id}/payment-terms/confirm`, buyer)).status).toBe(200);
  // Transport metadata is a fixture; progress mutations use the real API.
  await query("UPDATE shipments SET transport_document_reference='REGRESSION-CONSIGNMENT' WHERE id=$1", [shipment.id]);
  return { contractId: contract.id, shipmentId: shipment.id, paymentId: payment.id, holdingId: contract.holding_id };
}
async function state(d: Awaited<ReturnType<typeof deal>>) { return (await get(`/payment-requests/${d.paymentId}`, buyer)).body; }
async function progress(d: Awaited<ReturnType<typeof deal>>, milestone: string) { return post(`/shipments/${d.shipmentId}/milestones`, ['delivered','departed'].includes(milestone) ? buyer : seller, { milestone }); }
async function pay(d: Awaited<ReturnType<typeof deal>>, installment: string, evidenceId?: string) {
  expect((await post(`/payment-installments/${installment}/submit`, buyer, { transactionReference: `PAY-${installment}`, evidenceId })).status).toBe(200);
  expect((await post(`/payment-installments/${installment}/confirm`, seller)).status).toBe(200);
}
async function evidence(contractId: string, type: string, owner = seller, scan = 'clean') {
  const id = crypto.randomUUID(), key = `evidence/test/${id}`, content = Buffer.from('%PDF-1.4\nPayment regression fixture\n%%EOF');
  await evidenceStorage().put(key, content, 'application/pdf'); keys.push(key);
  await query(`INSERT INTO evidence_items(id,type,file_name,file_size_bytes,mime_type,sha256_hash,uploader_user_id,uploader_organization_id,
    linked_entity_type,linked_entity_id,storage_key,storage_provider,validation_status,malware_scan_status)
    VALUES($1,$2,$3,$4,'application/pdf',$5,$6,$7,'contract',$8,$9,$10,'validated',$11)`,
    [id, type, `${type}.pdf`, content.length, crypto.createHash('sha256').update(content).digest('hex'), owner.userId, owner.organizationId, contractId, key, evidenceStorage().provider, scan]);
  return id;
}
async function documents(d: Awaited<ReturnType<typeof deal>>) {
  const transport = await evidence(d.contractId, 'transport_document');
  await evidence(d.contractId, 'commercial_invoice'); await evidence(d.contractId, 'packing_list');
  return transport;
}
async function assertCompleted(d: Awaited<ReturnType<typeof deal>>) {
  const contract = (await query('SELECT * FROM sales_contracts WHERE id=$1', [d.contractId])).rows[0];
  expect(contract.status).toBe('settled');
  const holding = (await query('SELECT * FROM batch_holdings WHERE id=$1', [d.holdingId])).rows[0];
  expect(holding.holder_organization_id).toBe(buyer.organizationId); expect(Number(holding.quantity_kg)).toBe(4);
  expect((await query("SELECT COUNT(*)::int n FROM custody_transfers WHERE holding_id=$1 AND status='accepted'", [d.holdingId])).rows[0].n).toBe(1);
  expect((await query("SELECT COUNT(*)::int n FROM platform_fee_invoices WHERE contract_id=$1 AND status='invoiced'", [d.contractId])).rows[0].n).toBe(1);
}
beforeAll(async () => { seller = await actor('exporter'); buyer = await actor('importer'); outsider = await actor('importer'); });
afterAll(async () => { for (const key of keys) await evidenceStorage().delete(key); await pool.end(); });

describe('payment plans, protected documents and atomic retries', () => {
  it.each<PaymentPlan>(['pay_before_dispatch', 'deposit_balance', 'bank_secured', 'documentary_collection', 'pay_after_delivery'])('completes %s with its dispatch and document-release rules', async plan => {
    const d = await deal(plan), transport = await documents(d);
    let p = await state(d);
    expect((await get(`/evidence/${transport}/download`, buyer)).status).toBe(plan === 'pay_after_delivery' ? 200 : 423);
    const cashGate = ['pay_before_dispatch', 'deposit_balance'].includes(plan);
    if (cashGate || plan === 'bank_secured') expect((await progress(d, 'loaded')).status).toBe(409);
    if (cashGate) {
      const first = p.installments[0];
      expect((await post(`/payment-installments/${first.id}/submit`, buyer, { transactionReference: `PAY-${first.id}` })).status).toBe(200);
      expect((await progress(d, 'loaded')).status).toBe(409);
      expect((await post(`/payment-installments/${first.id}/confirm`, seller)).status).toBe(200);
    }
    if (plan === 'bank_secured') {
      expect((await post(`/payment-requests/${d.paymentId}/security`, buyer, { provider: 'External bank', reference: 'LC-123' })).status).toBe(200);
      expect((await progress(d, 'loaded')).status).toBe(409);
      expect((await post(`/payment-requests/${d.paymentId}/security/confirm`, seller)).status).toBe(200);
    }
    expect((await progress(d, 'loaded')).status).toBe(200);
    if (['deposit_balance', 'bank_secured', 'documentary_collection'].includes(plan)) {
      expect((await post(`/payment-requests/${d.paymentId}/submit-documents`, seller)).status).toBe(200);
      p = await state(d);
      expect((await get(`/evidence/${transport}/download`, buyer)).status).toBe(plan === 'bank_secured' ? 200 : 423);
      await pay(d, p.installments.find((i: any) => i.status === 'due').id);
    }
    if (plan !== 'pay_after_delivery') expect((await get(`/evidence/${transport}/download`, buyer)).status).toBe(200);
    expect((await progress(d, 'delivered')).status).toBe(200);
    if (plan === 'pay_after_delivery') {
      expect((await query('SELECT status FROM sales_contracts WHERE id=$1', [d.contractId])).rows[0].status).toBe('delivered');
      p = await state(d); await pay(d, p.installments[0].id);
    }
    expect((await post(`/contracts/${d.contractId}/delivery/accept`, buyer, {receivedQuantityKg:4,note:'Inspected the full quantity and condition'})).status).toBe(200);
    await assertCompleted(d);
    p = await state(d);
    for (const installment of p.installments) expect((await post(`/payment-installments/${installment.id}/confirm`, seller)).status).toBe(200);
    await assertCompleted(d);
  });

  it('blocks physical pickup and handover as well as loaded/departed before verified cash', async () => {
    const d = await deal('pay_before_dispatch');
    for (const milestone of ['picked_up','handed_over','loaded','departed']) {
      const result = await progress(d,milestone); expect(result.status).toBe(409); expect(result.body.code).toBe('PAYMENT_DISPATCH_GATE');
    }
    expect((await state(d)).current_milestone).toBe('planning');
  });

  it('requires contract-specific buyer proof and rechecks scan safety before receipt', async () => {
    const d = await deal('pay_before_dispatch', true), id = (await state(d)).installments[0].id;
    expect((await post(`/payment-installments/${id}/submit`, buyer, { transactionReference: 'PROOF-PAYMENT' })).body.code).toBe('PAYMENT_EVIDENCE_REQUIRED');
    const wrongOwner = await evidence(d.contractId, 'payment_proof', seller);
    expect((await post(`/payment-installments/${id}/submit`, buyer, { transactionReference: 'PROOF-PAYMENT', evidenceId: wrongOwner })).status).toBe(400);
    const another = await deal('pay_before_dispatch', true), wrongContract = await evidence(another.contractId, 'payment_proof', buyer);
    expect((await post(`/payment-installments/${id}/submit`, buyer, { transactionReference: 'PROOF-PAYMENT', evidenceId: wrongContract })).status).toBe(400);
    const proof = await evidence(d.contractId, 'payment_proof', buyer);
    expect((await post(`/payment-installments/${id}/submit`, buyer, { transactionReference: 'PROOF-PAYMENT', evidenceId: proof })).status).toBe(200);
    await query("UPDATE evidence_items SET malware_scan_status='infected' WHERE id=$1", [proof]);
    expect((await post(`/payment-installments/${id}/confirm`, seller)).status).toBe(409);
    expect(Number((await state(d)).amount_confirmed)).toBe(0);
    await query("UPDATE evidence_items SET malware_scan_status='clean' WHERE id=$1", [proof]);
    expect((await post(`/payment-installments/${id}/confirm`, seller)).status).toBe(200);
    expect((await get(`/evidence/${proof}/download`, seller)).status).toBe(200);
  });

  it('rejects unsafe or missing shipping documents and requires CIF insurance', async () => {
    const d = await deal('documentary_collection', false, 'CIF');
    expect((await post(`/payment-requests/${d.paymentId}/submit-documents`, seller)).status).toBe(400);
    expect((await progress(d, 'loaded')).status).toBe(200);
    await documents(d);
    const insurance = await evidence(d.contractId, 'insurance_certificate', seller, 'scan_failed');
    expect((await post(`/payment-requests/${d.paymentId}/submit-documents`, seller)).status).toBe(400);
    await query("UPDATE evidence_items SET malware_scan_status='clean' WHERE id=$1", [insurance]);
    expect((await post(`/payment-requests/${d.paymentId}/submit-documents`, seller)).status).toBe(200);
    expect((await post(`/payment-requests/${d.paymentId}/submit-documents`, seller)).status).toBe(200);
    expect((await query("SELECT COUNT(*)::int n FROM audit_events WHERE entity_id=$1 AND action='payment.documents.present'", [d.paymentId])).rows[0].n).toBe(1);
  });

  it('keeps reference retries and rejection/resubmission history distinct', async () => {
    const d = await deal('pay_before_dispatch'), id = (await state(d)).installments[0].id;
    const submit = (ref: string) => post(`/payment-installments/${id}/submit`, buyer, { transactionReference: ref });
    expect((await submit('FIRST-REFERENCE')).status).toBe(200); expect((await submit('FIRST-REFERENCE')).status).toBe(200);
    expect((await submit('DIFFERENT-REFERENCE')).status).toBe(409);
    expect((await post(`/payment-installments/${id}/reject`, seller, { reason: 'Funds not received' })).status).toBe(200);
    expect((await post(`/payment-installments/${id}/reject`, seller, { reason: 'Funds not received' })).status).toBe(200);
    expect((await submit('SECOND-REFERENCE')).status).toBe(200);
    expect((await post(`/payment-installments/${id}/confirm`, seller)).status).toBe(200);
    const events = await query("SELECT action,metadata FROM audit_events WHERE entity_id=$1 ORDER BY occurred_at", [id]);
    expect(events.rows.map(e => e.action)).toEqual(['payment.submit', 'payment.receipt.reject', 'payment.submit', 'payment.receipt.verify']);
    expect(events.rows[1].metadata.reference).toBe('FIRST-REFERENCE');
    expect(events.rows[3].metadata.reference).toBe('SECOND-REFERENCE');
  });

  it('keeps shipment-linked transport documents behind the contract release gate', async () => {
    const d = await deal('pay_before_dispatch');
    const document = await evidence(d.contractId, 'transport_document');
    await query("UPDATE evidence_items SET linked_entity_type='shipment',linked_entity_id=$1 WHERE id=$2", [d.shipmentId, document]);
    expect((await get(`/evidence/${document}/download`, buyer)).status).toBe(423);
    expect((await get(`/evidence/${document}/download`, seller)).status).toBe(200);
    await pay(d, (await state(d)).installments[0].id);
    expect((await get(`/evidence/${document}/download`, buyer)).status).toBe(200);
  });

  it('makes legacy payment-request retries safe before and after confirmation', async () => {
    const d = await deal('pay_before_dispatch'), path = `/payment-requests/${d.paymentId}/pay`;
    const body = { transactionReference: 'LEGACY-RETRY' };
    expect((await post(path,buyer,body)).status).toBe(200);
    expect((await post(path,buyer,body)).status).toBe(200);
    expect((await post(`/payment-installments/${(await state(d)).installments[0].id}/confirm`,seller)).status).toBe(200);
    expect((await post(path,buyer,body)).status).toBe(200);
    expect(Number((await state(d)).amount_confirmed)).toBe(20);
  });

  it('cannot reuse one proof or transaction reference for deposit and balance', async () => {
    const d = await deal('deposit_balance',true), proof = await evidence(d.contractId,'payment_proof',buyer);
    await pay(d,(await state(d)).installments[0].id,proof);
    expect((await progress(d,'loaded')).status).toBe(200); await documents(d);
    expect((await post(`/payment-requests/${d.paymentId}/submit-documents`,seller)).status).toBe(200);
    const p = await state(d), balance = p.installments[1];
    expect((await post(`/payment-installments/${balance.id}/submit`,buyer,{transactionReference:'BALANCE-PAYMENT',evidenceId:proof})).status).toBe(409);
    const second = await evidence(d.contractId,'payment_proof',buyer);
    expect((await post(`/payment-installments/${balance.id}/submit`,buyer,{transactionReference:p.installments[0].payment_reference_external,evidenceId:second})).status).toBe(409);
    await pay(d,balance.id,second); expect(Number((await state(d)).amount_confirmed)).toBe(20);
  });

  it('cannot satisfy required documents or proof with missing stored bytes', async () => {
    const d = await deal('documentary_collection'); expect((await progress(d,'loaded')).status).toBe(200);
    const transport = await documents(d);
    const item = (await query('SELECT storage_key FROM evidence_items WHERE id=$1',[transport])).rows[0];
    await evidenceStorage().delete(item.storage_key);
    expect((await post(`/payment-requests/${d.paymentId}/submit-documents`,seller)).status).toBe(400);
    const proofDeal = await deal('pay_before_dispatch',true), proof = await evidence(proofDeal.contractId,'payment_proof',buyer);
    const proofKey = (await query('SELECT storage_key FROM evidence_items WHERE id=$1',[proof])).rows[0].storage_key;
    await evidenceStorage().delete(proofKey);
    expect((await post(`/payment-installments/${(await state(proofDeal)).installments[0].id}/submit`,buyer,{transactionReference:'MISSING-BYTES',evidenceId:proof})).status).toBe(400);
  });

  it('does not let buyers overwrite seller-accepted bank security', async () => {
    const d = await deal('bank_secured'), path = `/payment-requests/${d.paymentId}/security`;
    const input = { provider: 'External bank', reference: 'LC-ACCEPTED' };
    expect((await post(path, buyer, input)).status).toBe(200);
    expect((await post(`${path}/confirm`, seller)).status).toBe(200);
    expect((await post(path, buyer, input)).status).toBe(200);
    expect((await post(`${path}/confirm`, seller)).status).toBe(200);
    expect((await post(path, buyer, { ...input, reference: 'LC-OVERWRITE' })).status).toBe(409);
    expect((await state(d)).security_status).toBe('verified');
  });

  it('enforces buyer/seller roles and hides other tenants during retries', async () => {
    const d = await deal('pay_before_dispatch'), id = (await state(d)).installments[0].id;
    expect((await post(`/payment-installments/${id}/submit`, seller, { transactionReference: 'WRONG-PARTY' })).status).toBe(404);
    expect((await post(`/payment-installments/${id}/confirm`, buyer)).status).toBe(404);
    expect((await post(`/payment-installments/${id}/submit`, outsider, { transactionReference: 'OTHER-TENANT' })).status).toBe(404);
    const foreign = await get(`/payment-requests/${d.paymentId}`, outsider);
    const absent = await get(`/payment-requests/${crypto.randomUUID()}`, outsider);
    expect(foreign.status).toBe(404); expectIdenticalNotFound(foreign, absent);
    expect(foreign.headers['cache-control']).toBe('no-store');
  });

  it('contract and payment reads disclose only current parties, with matching absent denials and bounded UUID input', async () => {
    const d = await deal('pay_before_dispatch');
    for (const resource of [`/contracts/${d.contractId}`, `/payment-requests/${d.paymentId}`]) {
      for (const principal of [buyer,seller]) {
        const allowed=await get(resource,principal);
        expect(allowed.status,JSON.stringify(allowed.body)).toBe(200);
        expect(allowed.headers['cache-control']).toBe('no-store');
      }
      const denied=await get(resource,outsider);
      const absent=await get(resource.replace(/[^/]+$/,crypto.randomUUID()),outsider);
      expect(denied.status).toBe(404); expect(absent.status).toBe(404); expectIdenticalNotFound(denied, absent);
      expect(denied.headers['cache-control']).toBe('no-store');
      expect((await get(resource.replace(/[^/]+$/,'invalid-id'),outsider)).status).toBe(400);
    }
  });

  it('wildcard permissions never substitute for the required payment party or mutate state on denied retries', async () => {
    const d = await deal('bank_secured');
    const before = (await query('SELECT * FROM payment_requests WHERE id=$1', [d.paymentId])).rows[0];
    const actions = [
      { path: `/payment-requests/${d.paymentId}/security`, denied: [seller, outsider], body: {provider:'External bank',reference:'PARTY-BOUNDARY'} },
      { path: `/payment-requests/${d.paymentId}/security/confirm`, denied: [buyer, outsider], body: {} },
      { path: `/payment-requests/${d.paymentId}/submit-documents`, denied: [buyer, outsider], body: {} },
      { path: `/payment-requests/${d.paymentId}/remind`, denied: [buyer, outsider], body: {} },
    ];
    for (const action of actions) for (const principal of action.denied) {
      const denied = await post(action.path, principal, action.body);
      expect(denied.status, JSON.stringify(denied.body)).toBe(404);
      expect(denied.headers['cache-control']).toBe('no-store');
    }
    expect((await query('SELECT * FROM payment_requests WHERE id=$1', [d.paymentId])).rows[0]).toEqual(before);
    expect((await query("SELECT COUNT(*)::int n FROM audit_events WHERE entity_id=$1 AND action IN ('payment.security.submit','payment.security.verify','payment.documents.present','payment.reminder.create')", [d.paymentId])).rows[0].n).toBe(0);
    expect((await post(`/payment-requests/${d.paymentId}/security`,buyer,{provider:'External bank',reference:'PARTY-BOUNDARY'})).status).toBe(200);
    expect((await post(`/payment-requests/${d.paymentId}/security/confirm`,seller)).status).toBe(200);
  });

  nativeIt('serializes simultaneous identical submissions and confirmations without duplicate audits', async () => {
    const d = await deal('pay_before_dispatch'), id = (await state(d)).installments[0].id;
    const submitted = await Promise.all([1, 2].map(() => post(`/payment-installments/${id}/submit`, buyer, { transactionReference: 'CONCURRENT-PAYMENT' })));
    expect(submitted.map(r => r.status)).toEqual([200, 200]);
    const confirmed = await Promise.all([1, 2].map(() => post(`/payment-installments/${id}/confirm`, seller)));
    expect(confirmed.map(r => r.status)).toEqual([200, 200]);
    expect((await query("SELECT COUNT(*)::int n FROM audit_events WHERE entity_id=$1 AND action='payment.receipt.verify'", [id])).rows[0].n).toBe(1);
    expect((await query("SELECT COUNT(*)::int n FROM audit_events WHERE entity_id=$1 AND action='payment.submit'", [id])).rows[0].n).toBe(1);
  });

  it('rolls back payment state if its audit insert fails', async () => {
    const d = await deal('pay_before_dispatch'), id = (await state(d)).installments[0].id;
    await query(`CREATE FUNCTION fail_payment_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.entity_id='${id}'::uuid AND NEW.action='payment.submit' THEN RAISE EXCEPTION 'Injected audit failure'; END IF; RETURN NEW; END; $$;
      CREATE TRIGGER fail_payment_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION fail_payment_audit();`);
    try {
      expect((await post(`/payment-installments/${id}/submit`, buyer, { transactionReference: 'AUDIT-ROLLBACK' })).status).toBe(500);
      const p = await state(d); expect(p.installments[0].status).toBe('due'); expect(p.status).toBe('payment_due');
    } finally { await query('DROP TRIGGER fail_payment_audit ON audit_events; DROP FUNCTION fail_payment_audit()'); }
  });
});


describe('extracted payment-term use cases at the API boundary', () => {
  it('restricts proposal to the supplier and confirmation to the buyer without leaking another tenant', async () => {
    const d = await deal('deposit_balance', false, 'FOB', false);
    const endpoint = `/contracts/${d.contractId}/payment-terms`;
    for (const principal of [buyer, outsider]) {
      const response = await request(app).patch(endpoint).set('Authorization', `Bearer ${principal.token}`).send({ paymentPlan: 'pay_before_dispatch' });
      expect(response.status).toBe(404);
    }
    for (const principal of [seller, outsider]) expect((await post(`${endpoint}/confirm`, principal)).status).toBe(404);
    expect((await query('SELECT payment_plan,payment_terms_status FROM sales_contracts WHERE id=$1', [d.contractId])).rows[0]).toMatchObject({ payment_plan: 'deposit_balance', payment_terms_status: 'proposed' });
  });
  it('agreement retry preserves deadlines and creates one confirmation audit event', async () => {
    const d = await deal('deposit_balance', false, 'FOB', false);
    const endpoint = `/contracts/${d.contractId}/payment-terms/confirm`;
    expect((await post(endpoint, buyer)).status).toBe(200);
    const first = (await query('SELECT id,due_at,status FROM payment_installments WHERE payment_request_id=$1 ORDER BY sequence_number', [d.paymentId])).rows;
    const repeated = await post(endpoint, buyer);
    expect(repeated.status).toBe(200);
    expect(repeated.body).toEqual({ ok: true, alreadyConfirmed: true });
    expect((await query('SELECT id,due_at,status FROM payment_installments WHERE payment_request_id=$1 ORDER BY sequence_number', [d.paymentId])).rows).toEqual(first);
    expect((await query("SELECT COUNT(*)::int n FROM audit_events WHERE entity_id=$1 AND action='payment.terms.confirm'", [d.contractId])).rows[0].n).toBe(1);
  });
  it('cannot replace agreed terms or confirm a cancelled contract', async () => {
    const agreed = await deal('deposit_balance');
    expect((await request(app).patch(`/contracts/${agreed.contractId}/payment-terms`).set('Authorization', `Bearer ${seller.token}`).send({ paymentPlan: 'pay_after_delivery' })).status).toBe(409);
    const cancelled = await deal('deposit_balance', false, 'FOB', false);
    await query("UPDATE sales_contracts SET status='cancelled' WHERE id=$1", [cancelled.contractId]);
    expect((await post(`/contracts/${cancelled.contractId}/payment-terms/confirm`, buyer)).status).toBe(409);
    expect((await query("SELECT COUNT(*)::int n FROM audit_events WHERE entity_id=$1 AND action='payment.terms.confirm'", [cancelled.contractId])).rows[0].n).toBe(0);
  });
  nativeIt('serializes two simultaneous confirmations without duplicate activation or audit', async () => {
    const d = await deal('deposit_balance', false, 'FOB', false);
    const responses = await Promise.all([1, 2].map(() => post(`/contracts/${d.contractId}/payment-terms/confirm`, buyer)));
    expect(responses.map(response => response.status)).toEqual([200, 200]);
    expect(responses.filter(response => response.body.alreadyConfirmed).length).toBe(1);
    expect((await query("SELECT COUNT(*)::int n FROM audit_events WHERE entity_id=$1 AND action='payment.terms.confirm'", [d.contractId])).rows[0].n).toBe(1);
  });
});

describe('shared dashboard and deal-room action contract', () => {
  async function sameAction(d: Awaited<ReturnType<typeof deal>>, principal: Actor, expected: Record<string, unknown>) {
    const workspace = await get('/trade-actions', principal);
    const detail = await get(`/contracts/${d.contractId}`, principal);
    expect(workspace.status).toBe(200);
    expect(detail.status).toBe(200);
    expect(detail.body.nextAction).toMatchObject(expected);
    expect(workspace.body.find((item: { contractId: string }) => item.contractId === d.contractId)).toEqual(detail.body.nextAction);
  }
  it('uses the same proposed, agreed, submitted, verified and FOB handoff decisions for both parties', async () => {
    const d = await deal('pay_before_dispatch', false, 'FOB', false);
    await sameAction(d, buyer, { operation: 'confirm_terms', requiresAction: true });
    await sameAction(d, seller, { operation: 'view', requiresAction: false });
    expect((await post(`/contracts/${d.contractId}/payment-terms/confirm`, buyer)).status).toBe(200);
    const installment = (await state(d)).installments[0];
    await sameAction(d, buyer, { operation: 'submit_payment', installmentId: installment.id });
    await sameAction(d, seller, { requiresAction: false, title: 'Awaiting buyer payment' });
    expect((await post(`/payment-installments/${installment.id}/submit`, buyer, { transactionReference: 'SHARED-ACTION-PAYMENT' })).status).toBe(200);
    await sameAction(d, seller, { operation: 'verify_payment', installmentId: installment.id });
    await sameAction(d, buyer, { requiresAction: false });
    expect((await post(`/payment-installments/${installment.id}/confirm`, seller)).status).toBe(200);
    await sameAction(d, buyer, { operation: 'transport', title: 'Next transport action: booked' });
    await sameAction(d, seller, { requiresAction: false, title: 'Awaiting buyer: booked' });
    expect((await progress(d, 'loaded')).status).toBe(200);
    await sameAction(d, buyer, { operation: 'transport', title: 'Next transport action: departed' });
    await sameAction(d, seller, { requiresAction: false, title: 'Awaiting buyer: departed' });
    const outside = await get('/trade-actions', outsider);
    expect(outside.status).toBe(200);
    expect(outside.body.some((item: { contractId: string }) => item.contractId === d.contractId)).toBe(false);
    expect((await get(`/contracts/${d.contractId}`, outsider)).status).toBe(404);
  });
  it('does not leak trade facts through the action endpoint to an account without resource permissions', async () => {
    const restricted = await actor('importer');
    await query(`UPDATE roles SET permissions=ARRAY[]::text[] WHERE id IN (SELECT role_id FROM user_roles WHERE user_id=$1)`, [restricted.userId]);
    const response = await get('/trade-actions', restricted);
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});


it('uses the same document-presentation prerequisite after DPU unloading', async () => {
  const d = await deal('documentary_collection', false, 'DPU');
  const arrangement=await request(app).patch(`/shipments/${d.shipmentId}/details`).set('Authorization',`Bearer ${seller.token}`).send({bookingReference:'DPU-BOOKING',transportMode:'road',originLocation:'Tema',destinationLocation:'Rotterdam'});
  expect(arrangement.status,JSON.stringify(arrangement.body)).toBe(200);
  for(const [milestone,principal] of [['loaded',seller],['departed',seller],['arrived',seller],['customs_cleared',buyer],['unloaded',seller]] as const) {
    expect((await post(`/shipments/${d.shipmentId}/milestones`,principal,{milestone})).status).toBe(200);
  }
  const detail=await get(`/contracts/${d.contractId}`,seller);
  expect(detail.body.nextAction).toMatchObject({operation:'documents',requiresAction:true});
  await documents(d);
  const presented=await post(`/payment-requests/${d.paymentId}/submit-documents`,seller);
  expect(presented.status).toBe(200);
  const buyerDetail=await get(`/contracts/${d.contractId}`,buyer);
  expect(buyerDetail.body.nextAction.operation).toBe('submit_payment');
});


nativeIt('automatically submits a complete CIF set once, preserves deadlines on replay and records a system audit', async () => {
  const d = await deal('documentary_collection', false, 'CIF');
  await documents(d);
  await evidence(d.contractId, 'insurance_certificate');
  expect((await progress(d, 'loaded')).status).toBe(200);
  await query("UPDATE shipments SET transport_document_reference=NULL WHERE id=$1", [d.shipmentId]);
  await expect(automaticallyPresentDocuments(seller.organizationId, d.paymentId)).rejects.toThrow('transport-document reference');
  expect((await state(d)).documents_presented_at).toBeNull();
  await query("UPDATE shipments SET transport_document_reference='AUTO-CIF-1' WHERE id=$1", [d.shipmentId]);
  await Promise.all([
    automaticallyPresentDocuments(seller.organizationId, d.paymentId),
    automaticallyPresentDocuments(seller.organizationId, d.paymentId),
  ]);
  const first = await state(d);
  expect(first.documents_presented_at).toBeTruthy();
  expect(first.installments.some((i: { status: string }) => i.status === 'due')).toBe(true);
  const deadline = first.installments.find((i: { due_trigger: string }) => i.due_trigger === 'documents_presented').due_at;
  await automaticallyPresentDocuments(seller.organizationId, d.paymentId);
  expect((await state(d)).installments.find((i: { due_trigger: string }) => i.due_trigger === 'documents_presented').due_at).toBe(deadline);
  const audits = await query("SELECT actor_user_id,actor_organization_id,metadata FROM audit_events WHERE entity_id=$1 AND action='payment.documents.present'", [d.paymentId]);
  expect(audits.rows).toHaveLength(1);
  expect(audits.rows[0]).toMatchObject({ actor_user_id: null, actor_organization_id: seller.organizationId, metadata: { source: 'automatic_readiness' } });
  expect((await post(`/payment-requests/${d.paymentId}/submit-documents`, outsider)).status).toBe(404);
});


nativeIt('rolls back automatic payment activation and presentation when its system audit fails', async () => {
  const d = await deal('documentary_collection');
  await documents(d);
  expect((await progress(d, 'loaded')).status).toBe(200);
  const failingAudit = vi.spyOn(audit, 'hashObject').mockImplementationOnce(() => { throw new Error('Audit hashing unavailable'); });
  try {
    await expect(automaticallyPresentDocuments(seller.organizationId, d.paymentId)).rejects.toThrow('Audit hashing unavailable');
  } finally { failingAudit.mockRestore(); }
  const failed = await state(d);
  expect(failed.documents_presented_at).toBeNull();
  expect(failed.installments.find((i: { due_trigger: string }) => i.due_trigger === 'documents_presented').status).toBe('awaiting_trigger');
  expect((await query("SELECT id FROM audit_events WHERE entity_id=$1 AND action='payment.documents.present'", [d.paymentId])).rows).toHaveLength(0);
  await automaticallyPresentDocuments(seller.organizationId, d.paymentId);
  expect((await state(d)).documents_presented_at).toBeTruthy();
});
