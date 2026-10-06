import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
import { evidenceStorage } from '../../src/services/evidenceStorage';

type Actor = { organizationId: string; token: string; userId: string };
type Deal = { contractId: string; shipmentId: string; paymentId: string; holdingId: string };
let seller: Actor, buyer: Actor, outsider: Actor;
const keys: string[] = [];
const nativeIt = process.env.COCOATRACE_SUPPLEMENTAL_DATABASE === 'true' ? it.skip : it;

async function actor(type: 'exporter' | 'importer'): Promise<Actor> {
  const suffix = crypto.randomUUID(), password = 'DeliveryRegression123!';
  const organization = (await query("INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,$2,'GH','verified') RETURNING id", [`Delivery ${suffix}`, type])).rows[0];
  const email = `delivery-${suffix}@integration.test`;
  const user = (await query('INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id', [organization.id, email, await bcrypt.hash(password, 4), 'Delivery regression'])).rows[0];
  const role = (await query("INSERT INTO roles(name,permissions) VALUES($1,ARRAY['*']) RETURNING id", [`delivery-${suffix}`])).rows[0];
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [user.id, role.id]);
  const login = await request(app).post('/auth/login').send({ email, password });
  expect(login.status).toBe(200);
  return { organizationId: organization.id, userId: user.id, token: login.body.accessToken };
}
const post = (path: string, who: Actor, body = {}) => request(app).post(path).set('Authorization', `Bearer ${who.token}`).send(body);
const get = (path: string, who: Actor) => request(app).get(path).set('Authorization', `Bearer ${who.token}`);
const route = (d: Deal, suffix = '') => `/contracts/${d.contractId}/delivery${suffix}`;

async function deal(delivered = true, prepaid = true): Promise<Deal> {
  const batch = (await query("INSERT INTO harvest_batches(crop,harvest_date,quantity_kg,current_holder_id,source_mode,source_name,source_country) VALUES('peanut',CURRENT_DATE,10,$1,'direct_inventory','Delivery regression','GH') RETURNING id", [seller.organizationId])).rows[0];
  const holding = (await query('INSERT INTO batch_holdings(batch_id,holder_organization_id,quantity_kg) VALUES($1,$2,10) RETURNING id', [batch.id, seller.organizationId])).rows[0];
  const listing = (await query("INSERT INTO listings(seller_organization_id,holding_id,available_quantity_kg,price_per_kg,currency,incoterm,origin_location,destination_location) VALUES($1,$2,10,5,'EUR','FOB','Tema','Rotterdam') RETURNING id", [seller.organizationId, holding.id])).rows[0];
  const offer = (await query("INSERT INTO trade_offers(listing_id,buyer_organization_id,quantity_kg,offered_price_per_kg,currency,valid_until) VALUES($1,$2,4,5,'EUR',NOW()+INTERVAL '1 day') RETURNING id", [listing.id, buyer.organizationId])).rows[0];
  const accepted = await post(`/offers/${offer.id}/accept`, seller);
  expect(accepted.status).toBe(200);
  const contract = accepted.body.contract, shipment = accepted.body.shipment;
  const payment = (await query('SELECT * FROM payment_requests WHERE contract_id=$1', [contract.id])).rows[0];
  expect((await request(app).patch(`/contracts/${contract.id}/payment-terms`).set('Authorization', `Bearer ${seller.token}`).send({ paymentPlan: prepaid ? 'pay_before_dispatch' : 'pay_after_delivery', depositPercentage: 20, creditDays: 0, paymentEvidenceRequired: false })).status).toBe(200);
  expect((await post(`/contracts/${contract.id}/payment-terms/confirm`, buyer)).status).toBe(200);
  const installment = (await get(`/payment-requests/${payment.id}`, buyer)).body.installments[0];
  if (prepaid) {
    expect((await post(`/payment-installments/${installment.id}/submit`, buyer, { transactionReference: `DELIVERY-${installment.id}` })).status).toBe(200);
    expect((await post(`/payment-installments/${installment.id}/confirm`, seller)).status).toBe(200);
  }
  const d = { contractId: contract.id, shipmentId: shipment.id, paymentId: payment.id, holdingId: contract.holding_id };
  if (delivered) { expect((await post(`/shipments/${d.shipmentId}/milestones`, seller, { milestone: 'loaded' })).status).toBe(200); }
  if (delivered) expect((await post(`/shipments/${d.shipmentId}/milestones`, buyer, { milestone: 'delivered' })).status).toBe(200);
  return d;
}

async function proof(d: Deal, owner = buyer, scan = 'clean', bytes = true, type = 'delivery_proof') {
  const id = crypto.randomUUID(), key = `evidence/test/${id}`, content = Buffer.from('%PDF-1.4\nDelivery regression fixture\n%%EOF');
  if (bytes) { await evidenceStorage().put(key, content, 'application/pdf'); keys.push(key); }
  await query(`INSERT INTO evidence_items(id,type,file_name,file_size_bytes,mime_type,sha256_hash,uploader_user_id,uploader_organization_id,
    linked_entity_type,linked_entity_id,storage_key,storage_provider,validation_status,malware_scan_status)
    VALUES($1,$2,'delivery-proof.pdf',$3,'application/pdf',$4,$5,$6,'contract',$7,$8,$9,'validated',$10)`,
  [id,type,content.length,crypto.createHash('sha256').update(content).digest('hex'),owner.userId,owner.organizationId,d.contractId,key,evidenceStorage().provider,scan]);
  return id;
}
async function assertHeld(d: Deal) {
  const holding = (await query('SELECT * FROM batch_holdings WHERE id=$1', [d.holdingId])).rows[0];
  expect(holding.holder_organization_id).toBe(seller.organizationId);
  expect(holding.status).toBe('committed'); expect(Number(holding.quantity_kg)).toBe(4);
  expect((await query("SELECT COUNT(*)::int n FROM custody_transfers WHERE holding_id=$1 AND status='accepted'", [d.holdingId])).rows[0].n).toBe(0);
  expect((await query('SELECT status FROM sales_contracts WHERE id=$1', [d.contractId])).rows[0].status).not.toBe('settled');
}
async function assertSettled(d: Deal) {
  const holding = (await query('SELECT * FROM batch_holdings WHERE id=$1', [d.holdingId])).rows[0];
  expect(holding.holder_organization_id).toBe(buyer.organizationId); expect(Number(holding.quantity_kg)).toBe(4);
  expect((await query('SELECT status FROM sales_contracts WHERE id=$1', [d.contractId])).rows[0].status).toBe('settled');
  expect((await query("SELECT COUNT(*)::int n FROM custody_transfers WHERE holding_id=$1 AND status='accepted'", [d.holdingId])).rows[0].n).toBe(1);
  expect((await query("SELECT COUNT(*)::int n FROM platform_fee_invoices WHERE contract_id=$1 AND status='invoiced'", [d.contractId])).rows[0].n).toBe(1);
}
beforeAll(async () => { seller = await actor('exporter'); buyer = await actor('importer'); outsider = await actor('importer'); });
afterAll(async () => { for (const key of keys) await evidenceStorage().delete(key); await pool.end(); });

describe('delivery acceptance and discrepancy settlement boundary', () => {
  nativeIt('serializes concurrent full acceptance without duplicate custody, fees or acceptance audit', async () => {
    const d = await deal(), body = { receivedQuantityKg: 4,note: 'Concurrent acceptance' };
    const results = await Promise.all([post(route(d,'/accept'),buyer,body),post(route(d,'/accept'),buyer,body)]);
    expect(results.map(result => result.status)).toEqual([200,200]);
    await assertSettled(d);
    expect((await query('SELECT COUNT(*)::int n FROM delivery_acceptances WHERE contract_id=$1', [d.contractId])).rows[0].n).toBe(1);
    expect((await query("SELECT COUNT(*)::int n FROM audit_events WHERE entity_id=$1 AND action='delivery.accept'", [d.contractId])).rows[0].n).toBe(1);
  });

  it('rolls acceptance and settlement back if its atomic audit cannot be written', async () => {
    const d = await deal();
    const suffix = crypto.randomUUID().replaceAll('-',''), fn = `reject_delivery_audit_${suffix}`;
    // A transaction-local business failure must roll back its acceptance as well as custody.
    await query(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.entity_id='${d.contractId}'::uuid AND NEW.action='delivery.accept' THEN
        RAISE EXCEPTION 'Injected delivery audit failure';
      END IF; RETURN NEW; END $$`);
    await query(`CREATE TRIGGER ${fn} BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION ${fn}()`);
    try {
      expect((await post(route(d,'/accept'),buyer,{ receivedQuantityKg: 4,note: 'Rollback check' })).status).toBe(500);
      expect((await query('SELECT COUNT(*)::int n FROM delivery_acceptances WHERE contract_id=$1', [d.contractId])).rows[0].n).toBe(0);
      await assertHeld(d);
    } finally {
      await query(`DROP TRIGGER ${fn} ON audit_events`);
      await query(`DROP FUNCTION ${fn}()`);
    }
    expect((await post(route(d,'/accept'),buyer,{ receivedQuantityKg: 4,note: 'Rollback check' })).status).toBe(200);
    await assertSettled(d);
  });
  it('holds delivered paid inventory until exact buyer acceptance and settles once on retries', async () => {
    const d = await deal(); await assertHeld(d);
    expect((await get(route(d),buyer)).status).toBe(200);
    expect((await get(route(d),seller)).status).toBe(200);
    expect((await get(route(d),outsider)).status).toBe(404);
    expect((await post(route(d,'/accept'),seller,{ receivedQuantityKg: 4,note: 'Accepted' })).status).toBe(404);
    expect((await post(route(d,'/accept'),outsider,{ receivedQuantityKg: 4,note: 'Accepted' })).status).toBe(404);
    expect((await post(route(d,'/accept'),buyer,{ receivedQuantityKg: 3.999,note: 'Short' })).status).toBe(400);
    await assertHeld(d);
    const body = { receivedQuantityKg: 4,note: 'Quantity and goods checked' };
    expect((await post(route(d,'/accept'),buyer,body)).status).toBe(200);
    expect((await post(route(d,'/accept'),buyer,body)).status).toBe(200);
    await assertSettled(d);
  });

  it('keeps accepted goods committed until an after-delivery payment is actually verified', async () => {
    const d = await deal(true,false);
    expect((await post(route(d,'/accept'),buyer,{ receivedQuantityKg: 4,note: 'Full quantity accepted before final payment' })).status).toBe(200);
    await assertHeld(d);
    const installment = (await get(`/payment-requests/${d.paymentId}`,buyer)).body.installments[0];
    expect((await post(`/payment-installments/${installment.id}/submit`,buyer,{ transactionReference: `FINAL-${installment.id}` })).status).toBe(200);
    await assertHeld(d);
    expect((await post(`/payment-installments/${installment.id}/confirm`,seller)).status).toBe(200);
    await assertSettled(d);
  });

  it('requires physical delivery before accepting or reporting a discrepancy', async () => {
    const d = await deal(false), evidence = await proof(d);
    expect((await post(route(d,'/accept'),buyer,{ receivedQuantityKg: 4,note: 'Not arrived' })).status).toBe(409);
    expect((await post(route(d,'/discrepancy'),buyer,{ kind: 'damage',receivedQuantityKg: 4,reason: 'Packaging damaged before arrival',evidenceIds: [evidence] })).status).toBe(409);
    await assertHeld(d);
  });

  it('requires genuine buyer-owned contract proof with scan-clean stored bytes', async () => {
    const d = await deal(), other = await deal();
    const upload = { type: 'delivery_proof',fileName: 'delivery.pdf',mimeType: 'application/pdf',fileSizeBytes: 100,linkedEntityType: 'contract',linkedEntityId: d.contractId };
    expect((await post('/evidence/upload-intents',buyer,upload)).status).toBe(201);
    expect((await post('/evidence/upload-intents',outsider,upload)).status).toBe(403);
    const invalid = [crypto.randomUUID(), await proof(d,seller), await proof(d,buyer,'infected'), await proof(d,buyer,'clean',false), await proof(other), await proof(d,buyer,'clean',true,'payment_proof')];
    for (const id of invalid) {
      expect((await post(route(d,'/discrepancy'),buyer,{ kind: 'damage',receivedQuantityKg: 4,reason: 'Packaging damaged',evidenceIds: [id] })).status).toBe(400);
    }
    expect((await post(route(d,'/discrepancy'),buyer,{ kind: 'damage',receivedQuantityKg: 4,reason: 'Packaging damaged',evidenceIds: [] })).status).toBe(400);
    await assertHeld(d);
  });

  it('pauses settlement through a discrepancy, requires the buyer to approve supplier resolution, then accepts separately', async () => {
    const d = await deal(), evidence = await proof(d);
    const report = { kind: 'shortage',receivedQuantityKg: 3,reason: 'One kilogram missing on unloading',evidenceIds: [evidence] };
    expect((await post(route(d,'/discrepancy'),buyer,report)).status).toBe(201);
    expect((await post(route(d,'/discrepancy'),buyer,report)).status).toBe(201);
    expect((await post(route(d,'/accept'),buyer,{ receivedQuantityKg: 4,note: 'Accept despite open issue' })).status).toBe(409);
    expect((await post(route(d,'/resolution'),buyer,{ note: 'Supplier must propose' })).status).toBe(404);
    const proposal = { note: 'Missing goods received; buyer will inspect before acceptance' };
    expect((await post(route(d,'/resolution'),seller,proposal)).status).toBe(200);
    expect((await post(route(d,'/resolution'),seller,proposal)).status).toBe(200);
    expect((await post(route(d,'/resolution/approve'),seller)).status).toBe(404);
    expect((await post(route(d,'/resolution/approve'),outsider)).status).toBe(404);
    expect((await post(route(d,'/resolution/approve'),buyer)).status).toBe(200);
    expect((await post(route(d,'/resolution/approve'),buyer)).status).toBe(200);
    await assertHeld(d);
    expect((await post(route(d,'/accept'),buyer,{ receivedQuantityKg: 4,note: 'Replacement checked, full quantity received' })).status).toBe(200);
    await assertSettled(d);
  });
});
