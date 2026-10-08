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
  const role=(await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id',[`selection-${unique}`,['evidence.upload','farm.read','batch.read','contract.read','shipment.read']])).rows[0].id;
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
const get=(parameters:Record<string,string>,who=seller)=>request(app).get('/evidence/record-options').query(parameters).set('Authorization',`Bearer ${who.token}`);
beforeAll(async()=>{seller=await actor();buyer=await actor();outsider=await actor();own=await stock(seller,1005);foreign=await stock(outsider,1);});
afterAll(async()=>{
  for(const row of stocks){
    await query('DELETE FROM shipments WHERE id=ANY($1::uuid[])',[row.shipments]);
    await query('DELETE FROM sales_contracts WHERE id=ANY($1::uuid[])',[row.contracts]);
    await query('DELETE FROM trade_offers WHERE id=ANY($1::uuid[])',[row.offers]);
    await query('DELETE FROM listings WHERE id=ANY($1::uuid[])',[row.listings]);
    await query('DELETE FROM batch_holdings WHERE id=ANY($1::uuid[])',[row.holdings]);
    await query('DELETE FROM harvest_batches WHERE id=ANY($1::uuid[])',[row.batches]);
    await query('DELETE FROM farms WHERE id=ANY($1::uuid[])',[row.farms]);
  }
  await pool.end();
});
describe('bounded evidence selection across source and trade records',()=>{
  it.each(['farm','batch','contract','shipment'] as const)('pages 1,005 %s options and resolves exact off-page links',async(kind)=>{
    const all=own[rowKeys[kind]];
    const first=await get({kind,limit:'100'});expect(first.status).toBe(200);expect(first.body.items).toHaveLength(100);
    const next=await get({kind,limit:'100',cursor:first.body.nextCursor});expect(next.status).toBe(200);expect(next.body.items).toHaveLength(100);
    const ids=[...first.body.items,...next.body.items].map((row:{id:string})=>row.id);expect(new Set(ids).size).toBe(200);expect(ids).toEqual([...ids].sort());
    expect(first.body.items.every((row:Record<string,unknown>)=>Object.keys(row).sort().join(',')==='id,label')).toBe(true);
    const later=all.find(id=>!ids.includes(id))!;
    const exact=await get({kind,id:later});expect(exact.status).toBe(200);expect(exact.body.items.map((row:{id:string})=>row.id)).toEqual([later]);expect(exact.body.hasMore).toBe(false);
    expect((await get({kind,id:later.toUpperCase()})).body.items[0].id).toBe(later);
    const searched=await get({kind,search:later});expect(searched.status).toBe(200);expect(searched.body.items.some((row:{id:string})=>row.id===later)).toBe(true);
    expect((await get({kind,search:'%'})).body.items).toEqual([]);
    expect((await get({kind,cursor:first.body.nextCursor,search:'changed'})).status).toBe(400);
    expect((await get({kind,cursor:first.body.nextCursor},outsider)).status).toBe(400);
    expect((await get({kind,id:foreign[rowKeys[kind]][0]})).body.items).toEqual([]);
  });
  it('keeps trade options party-scoped, not broadened by logistics assignment or a read-all permission',async()=>{
    expect((await get({kind:'contract',id:own.contracts[0]},buyer)).body.items[0].id).toBe(own.contracts[0]);
    expect((await get({kind:'shipment',id:own.shipments[0]},buyer)).body.items[0].id).toBe(own.shipments[0]);
    expect((await get({kind:'shipment',id:own.shipments[0]},outsider)).body.items).toEqual([]);
    await query("UPDATE roles r SET permissions=permissions||ARRAY['contract.read.all','shipment.read.all']::text[] FROM user_roles ur WHERE ur.role_id=r.id AND ur.user_id=$1",[outsider.user]);
    expect((await get({kind:'contract',id:own.contracts[0]},outsider)).body.items).toEqual([]);
    expect((await get({kind:'shipment',id:own.shipments[0]},outsider)).body.items).toEqual([]);
  });
  it('rechecks relationships and permissions for exact source links and refuses malformed selection input',async()=>{
    await query('UPDATE farms SET farmer_organization_id=$1 WHERE id=$2',[outsider.org,own.farms[0]]);
    expect((await get({kind:'farm',id:own.farms[0]})).body.items).toEqual([]);
    await query('UPDATE farms SET farmer_organization_id=$1 WHERE id=$2',[seller.org,own.farms[0]]);
    for(const parameters of [{kind:'unsupported'},{kind:'farm',id:'bad'},{kind:'batch',limit:'101'},{kind:'contract',id:own.contracts[0],search:'extra'},{kind:'shipment',unexpected:'true'}] as Record<string,string>[])expect((await get(parameters)).status).toBe(400);
    expect((await request(app).get('/evidence/record-options').query({kind:'farm'})).status).toBe(401);
    await query("UPDATE roles r SET permissions=ARRAY['evidence.upload']::text[] FROM user_roles ur WHERE ur.role_id=r.id AND ur.user_id=$1",[outsider.user]);
    expect((await get({kind:'farm'},outsider)).status).toBe(403);
    await query("UPDATE roles r SET permissions=ARRAY['farm.read']::text[] FROM user_roles ur WHERE ur.role_id=r.id AND ur.user_id=$1",[outsider.user]);
    expect((await get({kind:'farm'},outsider)).status).toBe(403);
  });
});
