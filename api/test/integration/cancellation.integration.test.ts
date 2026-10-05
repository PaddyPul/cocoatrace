import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import app from '../../src/app';
import { pool, query, getClient } from '../../src/db';
import { reconcileTradeIntegrity } from '../../src/modules/trading/reconciliation';
type Actor = { organizationId: string; token: string };
let seller: Actor, buyer: Actor, outsider: Actor;
const nativeIt = process.env.COCOATRACE_SUPPLEMENTAL_DATABASE === 'true' ? it.skip : it;
async function actor(type: string, organizationId?: string, permissions = ['*']): Promise<Actor> {
  const key = crypto.randomUUID();
  const org = organizationId ? {id: organizationId} : (await query("INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,$2,'GH','verified') RETURNING id", [`Cancellation ${key}`,type])).rows[0];
  const email = `cancel-${key}@integration.test`, password='CancellationTesting123!';
  const user = (await query('INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id', [org.id,email,await bcrypt.hash(password,4),'Cancellation tester'])).rows[0];
  const role = (await query("INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id", [`cancel-${key}`, permissions])).rows[0];
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [user.id,role.id]);
  const login = await request(app).post('/auth/login').send({email,password});
  expect(login.status).toBe(200);
  return {organizationId:org.id,token:login.body.accessToken};
}
const post = (path: string, principal: Actor, body={}) => request(app).post(path).set('Authorization', `Bearer ${principal.token}`).send(body);
const patch = (path: string, principal: Actor, body={}) => request(app).patch(path).set('Authorization', `Bearer ${principal.token}`).send(body);
async function deal() {
  const batch = (await query("INSERT INTO harvest_batches(crop,harvest_date,quantity_kg,current_holder_id,source_mode,source_name,source_country) VALUES('peanut',CURRENT_DATE,10,$1,'direct_inventory','Cancellation fixture','GH') RETURNING id", [seller.organizationId])).rows[0];
  const holding=(await query('INSERT INTO batch_holdings(batch_id,holder_organization_id,quantity_kg) VALUES($1,$2,10) RETURNING id',[batch.id,seller.organizationId])).rows[0];
  const listing=(await query("INSERT INTO listings(seller_organization_id,holding_id,available_quantity_kg,price_per_kg,currency,incoterm,origin_location,destination_location) VALUES($1,$2,10,5,'EUR','FOB','Tema','Rotterdam') RETURNING id",[seller.organizationId,holding.id])).rows[0];
  const offer=(await query("INSERT INTO trade_offers(listing_id,buyer_organization_id,quantity_kg,offered_price_per_kg,currency,valid_until) VALUES($1,$2,4,5,'EUR',NOW()+INTERVAL '1 day') RETURNING id",[listing.id,buyer.organizationId])).rows[0];
  const accepted=await post(`/offers/${offer.id}/accept`,seller); expect(accepted.status).toBe(200);
  return {...accepted.body, batchId:batch.id};
}
async function cancellation(id: string, principal=buyer) {
  const response=await post(`/contracts/${id}/cancellation`,principal,{reason:'Procurement schedule changed; both parties should review'});
  expect(response.status).toBe(200);return response.body;
}
beforeAll(async()=> { seller=await actor('exporter');buyer=await actor('importer');outsider=await actor('importer'); });
afterAll(async()=>{await pool.end();});
describe('bilateral unstarted trade cancellation',()=>{
  it('requires the other organization and releases exact stock once without relisting',async()=>{
    const d=await deal(), r=await cancellation(d.contract.id);
    expect((await post(`/contracts/${d.contract.id}/cancellation/${r.id}/approve`,buyer)).status).toBe(403);
    const endpoint=`/contracts/${d.contract.id}/cancellation/${r.id}/approve`;
    expect((await post(endpoint,seller)).status).toBe(200);
    expect((await post(endpoint,seller)).status).toBe(200);
    expect((await query('SELECT status FROM sales_contracts WHERE id=$1',[d.contract.id])).rows[0].status).toBe('cancelled');
    const holdings=(await query('SELECT * FROM batch_holdings WHERE batch_id=$1',[d.batchId])).rows;
    expect(holdings.reduce((sum,row)=>sum+Number(row.quantity_kg),0)).toBe(10);
    expect(holdings.find(row=>row.id===d.contract.holding_id)).toMatchObject({status:'available',holder_organization_id:seller.organizationId,quantity_kg:'4.000'});
    expect((await query('SELECT active FROM listings WHERE id=$1',[d.contract.listing_id])).rows[0].active).toBe(false);
    expect((await query('SELECT status FROM platform_fee_invoices WHERE contract_id=$1',[d.contract.id])).rows[0].status).toBe('void');
    expect((await query("SELECT COUNT(*)::int n FROM audit_events WHERE entity_id=$1 AND action='contract.cancellation.approved'",[d.contract.id])).rows[0].n).toBe(1);
    const client=await getClient();try {const own=new Set([d.batchId,d.contract.id,d.contract.holding_id,d.contract.listing_id,d.contract.offer_id]);expect((await reconcileTradeIntegrity(client)).filter(issue=>own.has(issue.entity_id))).toEqual([]);} finally{client.release();}
  });
  it('scopes read/request/review and rejects malformed or short input',async()=>{
    const d=await deal(),r=await cancellation(d.contract.id,seller);
    expect((await request(app).get(`/contracts/${d.contract.id}/cancellation`).set('Authorization',`Bearer ${outsider.token}`)).status).toBe(404);
    expect((await post(`/contracts/${d.contract.id}/cancellation`,outsider,{reason:'Not an authorized trade participant'})).status).toBe(404);
    expect((await post(`/contracts/${d.contract.id}/cancellation/${r.id}/approve`,outsider)).status).toBe(404);
    expect((await post('/contracts/not-a-uuid/cancellation',seller,{reason:'Reason has sufficient detail'})).status).toBe(400);
    expect((await post(`/contracts/${d.contract.id}/cancellation`,seller,{reason:'short'})).status).toBe(400);
  });
  it('allows scoped readers to inspect history but denies commercial mutations',async()=>{
    const reader=await actor('importer',buyer.organizationId,['contract.read']);
    const d=await deal(),r=await cancellation(d.contract.id,seller);
    expect((await request(app).get(`/contracts/${d.contract.id}/cancellation`).set('Authorization',`Bearer ${reader.token}`)).status).toBe(200);
    expect((await post(`/contracts/${d.contract.id}/cancellation`,reader,{reason:'Reader cannot request commercial cancellation'})).status).toBe(403);
    for(const decision of ['approve','reject']) expect((await post(`/contracts/${d.contract.id}/cancellation/${r.id}/${decision}`,reader)).status).toBe(403);
  });
  it('rejection leaves trade and inventory committed and permits a new request',async()=>{
    const d=await deal(),r=await cancellation(d.contract.id);
    expect((await post(`/contracts/${d.contract.id}/cancellation/${r.id}/reject`,seller)).status).toBe(200);
    expect((await query('SELECT status FROM batch_holdings WHERE id=$1',[d.contract.holding_id])).rows[0].status).toBe('committed');
    expect((await cancellation(d.contract.id)).id).not.toBe(r.id);
    expect((await post(`/contracts/${d.contract.id}/cancellation/${r.id}/approve`,seller)).status).toBe(409);
  });
  it.each(['payment','security','transport','fee'])('rechecks new %s activity at approval',async activity=>{
    const d=await deal(),r=await cancellation(d.contract.id);
    if(activity==='payment')await query("UPDATE payment_installments SET status='payment_submitted',submitted_at=NOW() WHERE payment_request_id=$1",[d.paymentRequest.id]);
    if(activity==='security')await query("UPDATE payment_requests SET security_status='submitted',security_submitted_at=NOW() WHERE id=$1",[d.paymentRequest.id]);
    if(activity==='transport')await query("UPDATE shipments SET current_milestone='booked' WHERE id=$1",[d.shipment.id]);
    if(activity==='fee')await query("UPDATE platform_fee_invoices SET status='invoiced' WHERE contract_id=$1",[d.contract.id]);
    expect((await post(`/contracts/${d.contract.id}/cancellation/${r.id}/approve`,seller)).status).toBe(409);
    expect((await query('SELECT status FROM batch_holdings WHERE id=$1',[d.contract.holding_id])).rows[0].status).toBe('committed');
  });
  it('prevents stale payment submission and transport progress after cancellation',async()=>{
    const d=await deal();
    expect((await patch(`/contracts/${d.contract.id}/payment-terms`,seller,{paymentPlan:'pay_before_dispatch'})).status).toBe(200);
    expect((await post(`/contracts/${d.contract.id}/payment-terms/confirm`,buyer)).status).toBe(200);
    const installment=(await query('SELECT id FROM payment_installments WHERE payment_request_id=$1',[d.paymentRequest.id])).rows[0];
    const r=await cancellation(d.contract.id);
    expect((await post(`/contracts/${d.contract.id}/cancellation/${r.id}/approve`,seller)).status).toBe(200);
    expect((await post(`/payment-installments/${installment.id}/submit`,buyer,{transactionReference:'OLD-TAB'})).status).toBe(409);
    expect((await post(`/shipments/${d.shipment.id}/milestones`,seller,{milestone:'loaded'})).status).toBe(409);
    expect((await patch(`/shipments/${d.shipment.id}/details`,buyer,{serviceProviderName:'External transporter'})).status).toBe(409);
  });
  nativeIt('serializes simultaneous approvals into one inventory release and audit',async()=>{
    const d=await deal(),r=await cancellation(d.contract.id);
    const responses=await Promise.all([1,2].map(()=>post(`/contracts/${d.contract.id}/cancellation/${r.id}/approve`,seller)));
    expect(responses.map(row=>row.status)).toEqual([200,200]);
    expect((await query("SELECT COUNT(*)::int n FROM audit_events WHERE entity_id=$1 AND action='contract.cancellation.approved'",[d.contract.id])).rows[0].n).toBe(1);
  });
});

 nativeIt('payment submission and approval cannot both succeed in a race',async()=>{
   const d=await deal();
   expect((await patch(`/contracts/${d.contract.id}/payment-terms`,seller,{paymentPlan:'pay_before_dispatch'})).status).toBe(200);
   expect((await post(`/contracts/${d.contract.id}/payment-terms/confirm`,buyer)).status).toBe(200);
   const installment=(await query('SELECT id FROM payment_installments WHERE payment_request_id=$1',[d.paymentRequest.id])).rows[0];
   const r=await cancellation(d.contract.id);
   const responses=await Promise.all([
     post(`/contracts/${d.contract.id}/cancellation/${r.id}/approve`,seller),
     post(`/payment-installments/${installment.id}/submit`,buyer,{transactionReference:'RACE-PAYMENT'})
   ]);
   expect(responses.map(row=>row.status).sort()).toEqual([200,409]);
   const status=(await query('SELECT status FROM sales_contracts WHERE id=$1',[d.contract.id])).rows[0].status;
   const holding=(await query('SELECT status FROM batch_holdings WHERE id=$1',[d.contract.holding_id])).rows[0].status;
   expect(holding).toBe(status==='cancelled'?'available':'committed');
 });
