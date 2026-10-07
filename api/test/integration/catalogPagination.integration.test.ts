import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
import { withCatalogRead, parsePage } from '../../src/modules/catalog/paging';
import { holdingPage, holdingSelect } from '../../src/modules/catalog/repository';

type Actor = {org:string; token:string; user:string};
type Stock = {batch:string; holdings:{id:string}[]; listings:{id:string}[]};
let seller:Actor, outsider:Actor;
const stocks:Stock[]=[];
async function actor():Promise<Actor> {
  const suffix=crypto.randomUUID();
  const org=(await query("INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'exporter','GH','verified') RETURNING id",[`Paging ${suffix}`])).rows[0].id;
  const email=`paging-${suffix}@integration.test`;
  const user=(await query('INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',[org,email,await bcrypt.hash('PagingPassword123!',4),'Paging regression'])).rows[0].id;
  const role=(await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id',[`paging-${suffix}`,['holding.read','listing.read','custody.transfer.request','custody.transfer.accept']])).rows[0].id;
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
    await query('DELETE FROM listings WHERE holding_id=ANY($1::uuid[])',[s.holdings.map(h=>h.id)]);
    await query('DELETE FROM batch_holdings WHERE batch_id=$1',[s.batch]);
    await query('DELETE FROM harvest_batches WHERE id=$1',[s.batch]);
  }
  await pool.end();
});

describe('inventory/marketplace pages and aggregate totals',()=>{
  it('pages over 1,000 records, searches before limiting and keeps dashboard totals independent of pages',async()=>{
    const own=await stock(seller,1005,`Own ${crypto.randomUUID()}`);
    const foreign=await stock(outsider,2,`Foreign ${crypto.randomUUID()}`);
    const first=await get('/holdings/page',{limit:'100'});expect(first.status).toBe(200);expect(first.body.items).toHaveLength(100);
    const second=await get('/holdings/page',{limit:'100',cursor:first.body.nextCursor});expect(second.status).toBe(200);
    const ids=[...first.body.items,...second.body.items].map((h:{id:string})=>h.id);
    expect(new Set(ids).size).toBe(200);expect(ids).toEqual([...ids].sort());
    const later=own.holdings.find(h=>!ids.includes(h.id))!;
    const found=await get('/holdings/page',{search:later.id});expect(found.status).toBe(200);expect(found.body.items.map((h:{id:string})=>h.id)).toEqual([later.id]);
    expect((await get('/holdings/page',{search:foreign.holdings[0].id})).body.items).toEqual([]);
    expect((await get('/holdings/page',{cursor:first.body.nextCursor},outsider)).status).toBe(400);
    expect((await get('/holdings/page',{search:'changed',cursor:first.body.nextCursor})).status).toBe(400);
    const total=await get('/holdings/summary');expect(total.status).toBe(200);expect(total.body).toMatchObject({count:1005,available_count:1005,available_kg:'1005.000',commodities:['peanut']});
    const listings=await get('/listings/page',{mine:'true',limit:'100'});expect(listings.status).toBe(200);expect(listings.body.items).toHaveLength(100);
    expect(listings.body.items.every((l:{seller_organization_id:string})=>l.seller_organization_id===seller.org)).toBe(true);
    expect((await get('/listings/page',{mine:'true',limit:'100',cursor:listings.body.nextCursor},outsider)).status).toBe(400);
    const offPage=own.listings.find(l=>!listings.body.items.some((item:{id:string})=>item.id===l.id))!;
    const direct=await get('/listings/page',{id:offPage.id});expect(direct.status).toBe(200);expect(direct.body.items.map((l:{id:string})=>l.id)).toEqual([offPage.id]);
    const supplyTotals=await get('/listings/summary');expect(supplyTotals.status).toBe(200);expect(supplyTotals.body.own_count).toBe(1005);
    // Legacy callers get an explicit error, never a misleading first-page array.
    expect((await get('/holdings')).body.code).toBe('CATALOG_READ_LIMIT');
    expect((await get('/listings')).body.code).toBe('CATALOG_READ_LIMIT');
    await query("UPDATE batch_holdings SET status='committed' WHERE id=$1",[later.id]);
    expect((await get('/holdings/page',{available:'true',search:later.id})).body.items).toEqual([]);
    expect((await get('/listings/page',{id:(await query('SELECT id FROM listings WHERE holding_id=$1',[later.id])).rows[0].id})).body.items).toEqual([]);
    expect((await get('/holdings/summary')).body.available_count).toBe(1004);
    expect((await get('/listings/summary')).body.own_count).toBe(1004);
    await query("UPDATE batch_holdings SET status='available' WHERE id=$1",[later.id]);

    await withCatalogRead(async execute=>{
      let pagePlansChecked=0;
      const page=await holdingPage(async(sql,parameters)=>{
        if(sql.startsWith(holdingSelect)) {
          const explained=await execute(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${sql}`,parameters);
          const root=(explained.rows[0]['QUERY PLAN'] as {Plan:Record<string,unknown>}[])[0].Plan;
          expect(root['Node Type']).toBe('Limit');expect(Number(root['Actual Rows'])).toBeLessThanOrEqual(101);
          pagePlansChecked++;
        }
        return execute(sql,parameters);
      },seller.org,parsePage({limit:'100'},[seller.org],[]),false);
      expect(pagePlansChecked).toBe(1);
      expect(page.items).toHaveLength(100);
      expect(page.items.every(item=>item.trust!==undefined)).toBe(true);
    });
    const recall=(await query(`INSERT INTO recall_notices(reference_code,title,reason,instructions,severity,initiated_by_user_id,initiated_by_organization_id)
      VALUES($1,'Paging safety fixture','Read hold regression','Do not dispatch','warning',$2,$3) RETURNING id`,[crypto.randomUUID(),seller.user,seller.org])).rows[0].id;
    try {
      await query('INSERT INTO recall_affected_batches(recall_id,batch_id) VALUES($1,$2)',[recall,own.batch]);
      expect((await get('/holdings/page',{available:'true',search:later.id})).body.items).toEqual([]);
      expect((await get('/holdings/page',{search:later.id})).body.items[0].activeRecall).toBe(true);
      expect((await get('/listings/page',{id:offPage.id})).body.items).toEqual([]);
      expect((await get('/holdings/summary')).body.available_count).toBe(0);
      expect((await get('/listings/summary')).body.own_count).toBe(0);
      expect((await get('/holdings/summary',{},outsider)).body.count).toBe(2);
    } finally {
      await query('DELETE FROM recall_affected_batches WHERE recall_id=$1',[recall]);
      await query('DELETE FROM recall_notices WHERE id=$1',[recall]);
    }
  });

  it('applies literal search, request commodity, origin, minimum and exact numeric ordering before page limits',async()=>{
    const first=await get('/listings/page',{mine:'true',limit:'1',sort:'price',currency:'EUR'});expect(first.status).toBe(200);
    const next=await get('/listings/page',{mine:'true',limit:'1',sort:'price',currency:'EUR',cursor:first.body.nextCursor});expect(next.status).toBe(200);expect(next.body.items[0].id).not.toBe(first.body.items[0].id);
    expect((await get('/listings/page',{mine:'true',commodity:'raw peanut nuts',origin:'Tema',minimum:'1',limit:'2'})).body.items).toHaveLength(2);
    expect((await get('/listings/page',{mine:'true',commodity:'cocoa'})).body.items).toEqual([]);
    expect((await get('/listings/page',{mine:'true',minimum:'2'})).body.items).toEqual([]);
    expect((await get('/listings/page',{mine:'true',search:'%'})).body.items).toEqual([]);
    expect((await get('/listings/page',{sort:'price'})).status).toBe(400);
    expect((await get('/listings/page',{mine:'true',currency:'USD',sort:'price',cursor:first.body.nextCursor})).status).toBe(400);
    const largest=await get('/listings/page',{mine:'true',sort:'quantity',limit:'2'});
    const more=await get('/listings/page',{mine:'true',sort:'quantity',limit:'2',cursor:largest.body.nextCursor});
    expect(largest.status).toBe(200);expect(more.status).toBe(200);
    const ids=[...largest.body.items,...more.body.items].map((l:{id:string})=>l.id);
    expect(new Set(ids).size).toBe(4);expect(ids).toEqual([...ids].sort().reverse());
    for(const parameters of [{limit:'101'},{search:'x'.repeat(81)},{available:'yes'}] as Record<string,string>[]) expect((await get('/holdings/page',parameters)).status).toBe(400);
    expect((await request(app).get('/holdings/page')).status).toBe(401);
  });
});


describe('bounded transfer history',()=>{
  it('pages both party views, excludes unrelated tenants, filters before limiting and preserves receiving-party acceptance',async()=>{
    const material=await stock(seller,1005,`Transfers ${crypto.randomUUID()}`);
    const inserted=(await query(`INSERT INTO custody_transfers(holding_id,from_organization_id,to_organization_id,quantity_kg)
      SELECT id,$1,$2,1 FROM batch_holdings WHERE batch_id=$3 RETURNING id`,[seller.org,outsider.org,material.batch])).rows;
    const stranger=await actor();
    const first=await get('/transfers/page',{direction:'outgoing',limit:'100'});expect(first.status).toBe(200);expect(first.body.items).toHaveLength(100);
    const next=await get('/transfers/page',{direction:'outgoing',limit:'100',cursor:first.body.nextCursor});expect(next.status).toBe(200);
    const ids=[...first.body.items,...next.body.items].map((item:{id:string})=>item.id);
    expect(new Set(ids).size).toBe(200);expect(ids).toEqual([...ids].sort());
    const later=inserted.find(item=>!ids.includes(item.id))!.id;
    const exact=await get('/transfers/page',{direction:'outgoing',search:later});expect(exact.status).toBe(200);expect(exact.body.items.map((item:{id:string})=>item.id)).toEqual([later]);
    const incoming=await get('/transfers/page',{search:later},outsider);expect(incoming.status).toBe(200);expect(incoming.body.items[0].id).toBe(later);
    expect((await get('/transfers/page',{direction:'all'},stranger)).body.items).toEqual([]);
    expect((await get('/transfers/page',{direction:'incoming'},seller)).body.items).toEqual([]);
    expect((await get('/transfers/page',{direction:'outgoing',search:'%'})).body.items).toEqual([]);
    for(const changed of [{direction:'incoming'},{direction:'outgoing',status:'accepted'},{direction:'outgoing',search:'changed'}] as Record<string,string>[])
      expect((await get('/transfers/page',{...changed,cursor:first.body.nextCursor})).status).toBe(400);
    expect((await get('/transfers/page',{direction:'outgoing',cursor:first.body.nextCursor},stranger)).status).toBe(400);
    expect((await get('/transfers')).status).toBe(422);
    expect((await request(app).post(`/transfers/${later}/accept`).set('Authorization',`Bearer ${seller.token}`)).status).toBe(404);
    expect((await request(app).post(`/transfers/${later}/accept`).set('Authorization',`Bearer ${outsider.token}`)).status).toBe(200);
    expect((await get('/transfers/page',{search:later},outsider)).body.items).toEqual([]);
    expect((await get('/transfers/page',{search:later,status:'accepted'},outsider)).body.items[0].id).toBe(later);
    expect((await request(app).post(`/transfers/${later}/accept`).set('Authorization',`Bearer ${outsider.token}`)).status).toBe(409);
    for(const invalid of [{limit:'101'},{direction:'foreign'},{status:'invalid'},{search:'x'.repeat(81)}] as Record<string,string>[]) expect((await get('/transfers/page',invalid)).status).toBe(400);
    expect((await request(app).get('/transfers/page')).status).toBe(401);
  });
});
