import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';

import { incoterms } from '../../src/modules/transport/responsibilities';
import type { PaymentPlan } from '../../src/services/paymentProtection';

type Actor = { organizationId: string; token: string; userId: string };
let seller: Actor, buyer: Actor, outsider: Actor;



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

beforeAll(async()=>{seller=await actor('exporter');buyer=await actor('importer');outsider=await actor('importer');});
afterAll(async()=>{await pool.end();});
const expected: Record<string,string[]>={
 EXW:['buyer','seller','buyer','buyer','buyer','buyer','buyer','buyer','buyer'],
 FCA:['buyer','seller','seller','seller','buyer','buyer','buyer','buyer','buyer'],
 FAS:['buyer','seller','seller','buyer','buyer','buyer','buyer','buyer','buyer'],
 FOB:['buyer','seller','seller','seller','buyer','buyer','buyer','buyer','buyer'],
 CFR:['seller','seller','seller','seller','seller','seller','buyer','buyer','buyer'],
 CIF:['seller','seller','seller','seller','seller','seller','buyer','buyer','buyer'],
 CPT:['seller','seller','seller','seller','seller','seller','buyer','buyer','buyer'],
 CIP:['seller','seller','seller','seller','seller','seller','buyer','buyer','buyer'],
 DAP:['seller','seller','seller','seller','seller','seller','buyer','buyer','buyer'],
 DPU:['seller','seller','seller','seller','seller','seller','buyer','seller','buyer'],
 DDP:['seller','seller','seller','seller','seller','seller','seller','buyer','buyer'],
};
async function snapshot(d:Awaited<ReturnType<typeof deal>>) {
 return { shipment:(await query('SELECT * FROM shipments WHERE id=$1',[d.shipmentId])).rows,
 contract:(await query('SELECT * FROM sales_contracts WHERE id=$1',[d.contractId])).rows,
 holding:(await query('SELECT * FROM batch_holdings WHERE id=$1',[d.holdingId])).rows,
 payment:(await query('SELECT * FROM payment_requests WHERE id=$1',[d.paymentId])).rows,
 events:(await query('SELECT * FROM shipment_milestones WHERE shipment_id=$1 ORDER BY id',[d.shipmentId])).rows,
 audit:(await query('SELECT * FROM audit_events WHERE entity_id=ANY($1::uuid[]) ORDER BY id',[[d.shipmentId,d.contractId,d.holdingId,d.paymentId]])).rows };
}
describe('all Incoterms enforce physical action responsibilities at the API',()=>{
 for(const term of incoterms) it(`${term}: rejects the other party and outsider without mutation; permits the assigned party`,async()=>{
  const d=await deal('pay_after_delivery',false,term);
  const coordinator=expected[term][0]==='seller'?seller:buyer;
  const arrangement=`/shipments/${d.shipmentId}/details`;
  for(const wrong of [coordinator===seller?buyer:seller,outsider]) {
   const before=await snapshot(d);
   expect((await request(app).patch(arrangement).set('Authorization',`Bearer ${wrong.token}`).send({bookingReference:'FORBIDDEN'})).status).toBe(403);
   expect(await snapshot(d)).toEqual(before);
  }
  expect((await request(app).patch(arrangement).set('Authorization',`Bearer ${coordinator.token}`).send({bookingReference:'ASSIGNED'})).status).toBe(200);
  // Explicit origin/unloading/clearance confirmations are fixture prerequisites.
  for(const m of ['cargo_ready','handed_over','loaded','unloaded','customs_cleared']) await query('INSERT INTO shipment_milestones(shipment_id,milestone,recorded_by_user_id) VALUES($1,$2,$3)',[d.shipmentId,m,seller.userId]);
  const milestones=['booked','cargo_ready','export_cleared','loaded','departed','arrived','customs_cleared','unloaded','delivered'];
  for(const [i,m] of milestones.entries()) {
   await query("UPDATE shipments SET current_milestone='planning' WHERE id=$1",[d.shipmentId]);
   const assigned=expected[term][i]==='seller'?seller:buyer;
   for(const wrong of [assigned===seller?buyer:seller,outsider]) {
    const before=await snapshot(d);
    expect((await post(`/shipments/${d.shipmentId}/milestones`,wrong,{milestone:m,exceptionalDispatch:{reason:'Cannot override party authorization',acknowledgePaymentRisk:true}})).status).toBe(403);
    expect(await snapshot(d)).toEqual(before);
   }
   expect((await post(`/shipments/${d.shipmentId}/milestones`,assigned,{milestone:m})).status).toBe(200);
  }
 });
 it('blocks skipped origin work, EXW collection and DPU/DDP receipt prerequisites',async()=>{
  for(const term of ['FOB','EXW','FAS','DPU','DDP']) {
   const d=await deal('pay_after_delivery',false,term);
   const before=await snapshot(d);
   const result=await post(`/shipments/${d.shipmentId}/milestones`,buyer,{milestone:['EXW','FAS'].includes(term)?'loaded':'delivered'});
   expect(result.status).toBe(409);expect(result.body.code).toBe('TRANSPORT_PREREQUISITE');
   expect(await snapshot(d)).toEqual(before);
   if(['DPU','DDP'].includes(term)) {
    expect((await post(`/shipments/${d.shipmentId}/milestones`,seller,{milestone:'loaded'})).status).toBe(200);
    expect((await post(`/shipments/${d.shipmentId}/milestones`,buyer,{milestone:'delivered'})).status).toBe(409);
   }
  }
 });
});
