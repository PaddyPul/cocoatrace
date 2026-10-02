import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

async function deal(plan: PaymentPlan, proof = false, incoterm = 'FOB') {
  const batch = (await query("INSERT INTO harvest_batches(crop,harvest_date,quantity_kg,current_holder_id,source_mode,source_name,source_country) VALUES('peanut',CURRENT_DATE,10,$1,'direct_inventory','Payment regression','GH') RETURNING id", [seller.organizationId])).rows[0];
  const holding = (await query('INSERT INTO batch_holdings(batch_id,holder_organization_id,quantity_kg) VALUES($1,$2,10) RETURNING id', [batch.id, seller.organizationId])).rows[0];
  const listing = (await query("INSERT INTO listings(seller_organization_id,holding_id,available_quantity_kg,price_per_kg,currency,incoterm,origin_location,destination_location) VALUES($1,$2,10,5,'EUR',$3,'Tema','Rotterdam') RETURNING id", [seller.organizationId, holding.id, incoterm])).rows[0];
  const offer = (await query("INSERT INTO trade_offers(listing_id,buyer_organization_id,quantity_kg,offered_price_per_kg,currency,valid_until) VALUES($1,$2,4,5,'EUR',NOW()+INTERVAL '1 day') RETURNING id", [listing.id, buyer.organizationId])).rows[0];
  const accepted = await post(`/offers/${offer.id}/accept`, seller);
  expect(accepted.status).toBe(200);
  const { contract, shipment, paymentRequest } = accepted.body;
  const payment = paymentRequest || (await query('SELECT * FROM payment_requests WHERE contract_id=$1', [contract.id])).rows[0];
  expect((await request(app).patch(`/contracts/${contract.id}/payment-terms`).set('Authorization', `Bearer ${seller.token}`).send( { paymentPlan: plan, depositPercentage: 20, creditDays: 0, paymentEvidenceRequired: proof })).status).toBe(200);
  expect((await post(`/contracts/${contract.id}/payment-terms/confirm`, buyer)).status).toBe(200);
  // Transport metadata is a fixture; progress mutations use the real API.
  await query("UPDATE shipments SET transport_document_reference='REGRESSION-CONSIGNMENT' WHERE id=$1", [shipment.id]);
  return { contractId: contract.id, shipmentId: shipment.id, paymentId: payment.id, holdingId: contract.holding_id };
}
async function state(d: Awaited<ReturnType<typeof deal>>) { return (await get(`/payment-requests/${d.paymentId}`, buyer)).body; }
async function progress(d: Awaited<ReturnType<typeof deal>>, milestone: string) { return post(`/shipments/${d.shipmentId}/milestones`, milestone === 'delivered' ? buyer : seller, { milestone }); }
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
    expect((await get(`/payment-requests/${d.paymentId}`, outsider)).status).toBe(403);
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
