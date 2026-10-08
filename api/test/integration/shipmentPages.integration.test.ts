import {incoterms,transportPermissions} from '../../src/modules/transport/responsibilities';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import app from '../../src/app';
import { pool,query } from '../../src/db';
type Actor={org:string;token:string;user:string};
type Stock={farms:string[];batches:string[];holdings:string[];listings:string[];offers:string[];contracts:string[];shipments:string[]};
let seller:Actor,buyer:Actor,outsider:Actor;
const stocks:Stock[]=[];
const rowKeys={farm:'farms',batch:'batches',contract:'contracts',shipment:'shipments'} as const;
let own:Stock,foreign:Stock;
async function actor():Promise<Actor>{
  const unique=crypto.randomUUID();
  const org=(await query("INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'exporter','GH','verified') RETURNING id",[`Selection ${unique}`])).rows[0].id;
  const email=`selection-${unique}@integration.test`;
  const user=(await query('INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',[org,email,await bcrypt.hash('EvidenceSelection123!',4),'Selection test'])).rows[0].id;
  const role=(await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id',[`selection-${unique}`,['shipment.read','shipment.update']])).rows[0].id;
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)',[user,role]);
  const signed=await request(app).post('/auth/login').send({email,password:'EvidenceSelection123!'});expect(signed.status).toBe(200);
  return {org,user,token:signed.body.accessToken};
}
async function stock(owner:Actor,count:number):Promise<Stock>{
  const result:Stock={farms:[],batches:[],holdings:[],listings:[],offers:[],contracts:[],shipments:[]};stocks.push(result);
  result.farms=(await query("INSERT INTO farms(farmer_organization_id,name,country,region,district) SELECT $1,'Evidence source '||n,'GH','Northern','Tamale' FROM generate_series(1,$2::int) n RETURNING id",[owner.org,count])).rows.map(row=>row.id);
  result.batches=(await query("INSERT INTO harvest_batches(farm_id,crop,harvest_date,quantity_kg,current_holder_id) SELECT id,'shea',CURRENT_DATE,1,$1 FROM farms WHERE id=ANY($2::uuid[]) RETURNING id",[owner.org,result.farms])).rows.map(row=>row.id);
  result.holdings=(await query("INSERT INTO batch_holdings(batch_id,holder_organization_id,quantity_kg,status) SELECT id,$1,1,'committed' FROM harvest_batches WHERE id=ANY($2::uuid[]) RETURNING id",[owner.org,result.batches])).rows.map(row=>row.id);
  result.listings=(await query("INSERT INTO listings(seller_organization_id,holding_id,available_quantity_kg,price_per_kg,currency,incoterm,origin_location,destination_location,active) SELECT $1,id,0,5,'EUR','FOB','Tema','Accra',false FROM batch_holdings WHERE id=ANY($2::uuid[]) RETURNING id",[owner.org,result.holdings])).rows.map(row=>row.id);
  result.offers=(await query("INSERT INTO trade_offers(listing_id,buyer_organization_id,quantity_kg,offered_price_per_kg,currency,valid_until,status) SELECT id,$1,1,5,'EUR',NOW()+INTERVAL '1 day','accepted' FROM listings WHERE id=ANY($2::uuid[]) RETURNING id",[buyer.org,result.listings])).rows.map(row=>row.id);
  result.contracts=(await query("INSERT INTO sales_contracts(listing_id,offer_id,seller_organization_id,buyer_organization_id,holding_id,quantity_kg,price_per_kg,currency,incoterm) SELECT l.id,o.id,l.seller_organization_id,o.buyer_organization_id,l.holding_id,1,5,'EUR','FOB' FROM trade_offers o JOIN listings l ON l.id=o.listing_id WHERE o.id=ANY($1::uuid[]) RETURNING id",[result.offers])).rows.map(row=>row.id);
  result.shipments=(await query("INSERT INTO shipments(contract_id,transport_coordinator_organization_id,logistics_organization_id,booking_reference) SELECT id,$1,$2,'SELECTION-'||id FROM sales_contracts WHERE id=ANY($3::uuid[]) RETURNING id",[buyer.org,outsider.org,result.contracts])).rows.map(row=>row.id);
  return result;
}
const get=(path:string,parameters:Record<string,string>={},who=seller)=>request(app).get(path).query(parameters).set('Authorization',`Bearer ${who.token}`);
beforeAll(async()=>{seller=await actor();buyer=await actor();outsider=await actor();own=await stock(seller,1005);foreign=await stock(outsider,1);});
afterAll(async()=>{
  for(const row of stocks){
    await query('DELETE FROM shipments WHERE id=ANY($1::uuid[])',[row.shipments]);
    await query('DELETE FROM payment_requests WHERE contract_id=ANY($1::uuid[])',[row.contracts]);
    await query('DELETE FROM sales_contracts WHERE id=ANY($1::uuid[])',[row.contracts]);
    await query('DELETE FROM trade_offers WHERE id=ANY($1::uuid[])',[row.offers]);
    await query('DELETE FROM listings WHERE id=ANY($1::uuid[])',[row.listings]);
    await query('DELETE FROM batch_holdings WHERE id=ANY($1::uuid[])',[row.holdings]);
    await query('DELETE FROM harvest_batches WHERE id=ANY($1::uuid[])',[row.batches]);
    await query('DELETE FROM farms WHERE id=ANY($1::uuid[])',[row.farms]);
  }
  await pool.end();
});


beforeAll(async()=>{await query("INSERT INTO payment_requests(contract_id,requested_by_organization_id,amount_total,currency) SELECT contract_id,$1,5,'EUR' FROM shipments WHERE id=$2",[seller.org,own.shipments[3]]);});
describe('paged transport and responsibility boundaries',()=>{
 it('pages 1,005 shipment workspaces, searches off-page and preserves party access',async()=>{
  const first=await get('/shipments/page',{limit:'100',direction:'sales'});expect(first.status,first.body.code).toBe(200);expect(first.body.items).toHaveLength(100);
  const next=await get('/shipments/page',{limit:'100',direction:'sales',cursor:first.body.nextCursor});expect(next.status,next.body.code).toBe(200);
  const ids=[...first.body.items,...next.body.items].map((r:{id:string})=>r.id);expect(new Set(ids).size).toBe(200);expect(ids).toEqual([...ids].sort());
  const later=own.shipments.find(id=>!ids.includes(id))!;
  const found=await get('/shipments/page',{search:later});expect(found.status,found.body.code).toBe(200);expect(found.body.items.map((r:{id:string})=>r.id)).toEqual([later]);
  expect((await get('/shipments/page',{search:later,direction:'purchases'},buyer)).body.items[0].id).toBe(later);
  expect((await get('/shipments/page',{search:later},outsider)).body.items).toEqual([]);
  expect((await get('/shipments/page',{direction:'purchases'})).body.items).toEqual([]);
  expect((await get('/shipments/page',{search:'%'})).body.items).toEqual([]);
  for(const changed of [{direction:'purchases'},{direction:'sales',milestone:'planning'},{direction:'sales',search:'changed'}] as Record<string,string>[])expect((await get('/shipments/page',{...changed,cursor:first.body.nextCursor})).status).toBe(400);
  expect((await get('/shipments/page',{direction:'sales',cursor:first.body.nextCursor},buyer)).status).toBe(400);
  const legacy=await get('/shipments');expect(legacy.status).toBe(422);expect(legacy.body.code).toBe('CATALOG_READ_LIMIT');
 });
 it('aggregates full transport totals independently from pages and excludes closed work from active count',async()=>{
  await query("UPDATE shipments SET current_milestone='delivered' WHERE id=$1",[own.shipments[0]]);
  await query("UPDATE sales_contracts SET status='cancelled' WHERE id=(SELECT contract_id FROM shipments WHERE id=$1)",[own.shipments[1]]);
  await query("UPDATE sales_contracts SET status='settled' WHERE id=(SELECT contract_id FROM shipments WHERE id=$1)",[own.shipments[2]]);
  const totals=await get('/shipments/summary');expect(totals.status,totals.body.code).toBe(200);expect(totals.body).toEqual({count:1005,active_count:1002,delivered_count:1,cancelled_count:1});
  expect((await get('/shipments/page',{status:'delivered'})).body.items.map((r:{id:string})=>r.id)).toEqual([own.shipments[0]]);
  expect((await get('/shipments/page',{status:'active',search:own.shipments[1]})).body.items).toEqual([]);
  const other=await get('/shipments/summary',{},outsider);expect(other.status).toBe(200);expect(other.body.count).toBe(1);
 });
 it.each(incoterms)('does not grant wrong-party progress authority for %s',async(term)=>{
  const id=own.shipments[3];
   await query('UPDATE sales_contracts SET incoterm=$1 WHERE id=(SELECT contract_id FROM shipments WHERE id=$2)',[term,id]);
   for(const actor of [seller,buyer]){
    const detail=await get('/shipments/'+id,{},actor);expect(detail.status,detail.body.code).toBe(200);expect(detail.body.permissions).toMatchObject(transportPermissions(detail.body.shipment,actor.org));
   }
   const buyerWrite=await request(app).post('/shipments/'+id+'/milestones').set('Authorization',`Bearer ${buyer.token}`).send({milestone:'cargo_ready'});expect(buyerWrite.status,buyerWrite.body.code).toBe(403);
   const sellerWrite=await request(app).post('/shipments/'+id+'/milestones').set('Authorization',`Bearer ${seller.token}`).send({milestone:'delivered'});expect(sellerWrite.status,sellerWrite.body.code).toBe(403);
  expect((await query('SELECT COUNT(*)::int AS count FROM shipment_milestones WHERE shipment_id=$1',[id])).rows[0].count).toBe(0);
 });
 it('validates inputs and permissions without broadening logistics or read-all access',async()=>{
  for(const invalid of [{limit:'101'},{direction:'foreign'},{status:'invalid'},{milestone:'invented'},{search:'x'.repeat(81)}] as Record<string,string>[])expect((await get('/shipments/page',invalid)).status).toBe(400);
  expect((await request(app).get('/shipments/page')).status).toBe(401);
  await query("UPDATE roles r SET permissions=ARRAY['shipment.read','shipment.read.all']::text[] FROM user_roles ur WHERE ur.role_id=r.id AND ur.user_id=$1",[outsider.user]);
  expect((await get('/shipments/page',{search:own.shipments[0]},outsider)).body.items).toEqual([]);
  await query('UPDATE roles r SET permissions=ARRAY[]::text[] FROM user_roles ur WHERE ur.role_id=r.id AND ur.user_id=$1',[outsider.user]);
  expect((await get('/shipments/page',{},outsider)).status).toBe(403);expect((await get('/shipments/summary',{},outsider)).status).toBe(403);
 });
});
