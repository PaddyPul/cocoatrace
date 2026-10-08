import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';



type Actor = {org:string; token:string; user:string};
type Stock = {batch:string; holdings:{id:string}[]; listings:{id:string}[]};
let seller:Actor, outsider:Actor;
const stocks:Stock[]=[];
async function actor():Promise<Actor> {
  const suffix=crypto.randomUUID();
  const org=(await query("INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'exporter','GH','verified') RETURNING id",[`Paging ${suffix}`])).rows[0].id;
  const email=`paging-${suffix}@integration.test`;
  const user=(await query('INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',[org,email,await bcrypt.hash('PagingPassword123!',4),'Paging regression'])).rows[0].id;
  const role=(await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id',[`paging-${suffix}`,['offer.create','offer.respond']])).rows[0].id;
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)',[user,role]);
  const login=await request(app).post('/auth/login').send({email,password:'PagingPassword123!'});expect(login.status).toBe(200);
  return {org,token:login.body.accessToken,user};
}
async function stock(owner:Actor,n:number,warehouse:string):Promise<Stock> {
  const batch=(await query("INSERT INTO harvest_batches(crop,harvest_date,quantity_kg,current_holder_id,source_mode,source_name,source_country) VALUES('peanut',CURRENT_DATE,$1,$2,'direct_inventory',$3,'GH') RETURNING id",[n,owner.org,warehouse])).rows[0].id;
  const holdings=(await query('INSERT INTO batch_holdings(batch_id,holder_organization_id,quantity_kg,warehouse_location) SELECT $1,$2,1,$3 FROM generate_series(1,$4::int) RETURNING id',[batch,owner.org,warehouse,n])).rows;
  const listings=(await query("INSERT INTO listings(seller_organization_id,holding_id,available_quantity_kg,price_per_kg,currency,incoterm,origin_location,destination_location) SELECT $1,id,1,5,'EUR','FOB','Tema','Accra' FROM batch_holdings WHERE batch_id=$2 RETURNING id",[owner.org,batch])).rows;
  const result={batch,holdings,listings};stocks.push(result);return result;
}
const get=(path:string,parameters:Record<string,string>={},owner?:Actor)=>request(app).get(path).query(parameters).set('Authorization',`Bearer ${(owner||seller).token}`);
beforeAll(async()=>{seller=await actor();outsider=await actor();});
afterAll(async()=>{
  for(const s of stocks) {
    await query('DELETE FROM custody_transfers WHERE holding_id=ANY($1::uuid[])',[s.holdings.map(h=>h.id)]);
    await query('DELETE FROM trade_offers WHERE listing_id=ANY($1::uuid[])',[s.listings.map(l=>l.id)]);
    await query('DELETE FROM listings WHERE holding_id=ANY($1::uuid[])',[s.holdings.map(h=>h.id)]);
    await query('DELETE FROM batch_holdings WHERE batch_id=$1',[s.batch]);
    await query('DELETE FROM harvest_batches WHERE id=$1',[s.batch]);
  }
  await pool.end();
});


describe('paged offer party boundaries and totals',()=>{
  it('pages 1,005 offers, searches off-page, isolates parties and summarizes without truncation',async()=>{
    const own=await stock(seller,1,'Offer paging');
    const unrelated=await actor();
    const foreign=await stock(unrelated,1,'Foreign offer paging');
    const created=(await query("INSERT INTO trade_offers(listing_id,buyer_organization_id,quantity_kg,offered_price_per_kg,currency,valid_until) SELECT $1,$2,1,5,'EUR',NOW()+INTERVAL '1 day' FROM generate_series(1,1005) RETURNING id",[own.listings[0].id,outsider.org])).rows;
    await query("INSERT INTO trade_offers(listing_id,buyer_organization_id,quantity_kg,offered_price_per_kg,currency,valid_until) VALUES($1,$2,1,5,'EUR',NOW()+INTERVAL '1 day')",[foreign.listings[0].id,outsider.org]);
    const first=await get('/offers/page',{direction:'received',limit:'100'});expect(first.status,first.body.code).toBe(200);expect(first.body.items).toHaveLength(100);
    const next=await get('/offers/page',{direction:'received',limit:'100',cursor:first.body.nextCursor});expect(next.status,next.body.code).toBe(200);
    const ids=[...first.body.items,...next.body.items].map((row:{id:string})=>row.id);expect(new Set(ids).size).toBe(200);expect(ids).toEqual([...ids].sort());
    const later=created.find(row=>!ids.includes(row.id))!.id;
    const found=await get('/offers/page',{direction:'received',search:later});expect(found.status,found.body.code).toBe(200);expect(found.body.items.map((row:{id:string})=>row.id)).toEqual([later]);
    expect((await get('/offers/page',{search:'%'})).body.items).toEqual([]);
    expect((await get('/offers/page',{direction:'sent'})).body.items).toEqual([]);
    expect((await get('/offers/page',{direction:'sent',search:later},outsider)).body.items[0].id).toBe(later);
    expect((await get('/offers/page',{search:later},unrelated)).body.items).toEqual([]);
    expect((await get('/offers/page',{direction:'received',cursor:first.body.nextCursor},outsider)).status).toBe(400);
    expect((await get('/offers/page',{direction:'sent',cursor:first.body.nextCursor})).status).toBe(400);
    const summary=await get('/offers/summary');expect(summary.status,summary.body.code).toBe(200);expect(summary.body).toEqual({received_count:1005,sent_count:0,received_pending:1005,sent_pending:0});
    await query("UPDATE trade_offers SET status='rejected' WHERE id=$1",[later]);
    expect((await get('/offers/summary')).body.received_pending).toBe(1004);
    expect((await get('/offers/page',{status:'rejected'})).body.items.map((row:{id:string})=>row.id)).toEqual([later]);
    expect((await get('/offers')).status).toBe(422);
    for(const invalid of [{limit:'101'},{status:'invalid'},{direction:'foreign'}] as Record<string,string>[])expect((await get('/offers/page',invalid)).status).toBe(400);
    expect((await request(app).get('/offers/page')).status).toBe(401);
    await query('UPDATE roles r SET permissions=ARRAY[]::text[] FROM user_roles ur WHERE ur.role_id=r.id AND ur.user_id=$1',[unrelated.user]);
    expect((await get('/offers/page',{},unrelated)).status).toBe(403);
    expect((await get('/offers/summary',{},unrelated)).status).toBe(403);
  });
});
