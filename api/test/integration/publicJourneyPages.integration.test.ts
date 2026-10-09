import crypto from 'node:crypto';
import request from 'supertest';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import app from '../../src/app';
import {pool,query} from '../../src/db';
let owner:string,buyer:string,user:string,batch:string,otherBatch:string,holding:string,notice:string,slug:string,otherSlug:string;
const read=(parameters:Record<string,string>={},name=slug)=>request(app).get(`/public/products/${name}/journey/page`).query(parameters);
beforeAll(async()=>{
 const orgs=(await query("INSERT INTO organizations(name,type,jurisdiction) VALUES('Journey owner','exporter','GH'),('Journey buyer','importer','NL') RETURNING id")).rows;owner=orgs[0].id;buyer=orgs[1].id;
 user=(await query("INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,'unused-test-hash','Journey owner') RETURNING id",[owner,crypto.randomUUID()+'@integration.test'])).rows[0].id;
 const batches=(await query("INSERT INTO harvest_batches(crop,harvest_date,quantity_kg,current_holder_id,source_mode,source_country) SELECT 'peanut','1960-01-01',1006,$1,'direct_inventory','GH' FROM generate_series(1,2) RETURNING id",[owner])).rows;batch=batches[0].id;otherBatch=batches[1].id;
 holding=(await query("INSERT INTO batch_holdings(batch_id,holder_organization_id,quantity_kg,warehouse_location) VALUES($1,$2,1006,'Journey warehouse') RETURNING id",[batch,owner])).rows[0].id;
 slug='journey-'+crypto.randomUUID();otherSlug='journey-'+crypto.randomUUID();
 await query("INSERT INTO product_profiles(batch_id,slug,display_name,lot_code,visibility) VALUES($1,$3,'Public journey','JOURNEY-ONE','published'),($2,$4,'Other journey','JOURNEY-TWO','published')",[batch,otherBatch,slug,otherSlug]);
 await query("INSERT INTO custody_transfers(holding_id,from_organization_id,to_organization_id,quantity_kg,status,responded_at) SELECT $1,$2,$3,n,'accepted','2026-01-01T00:00:00.123456Z' FROM generate_series(1,1005) n",[holding,owner,buyer]);
 await query("INSERT INTO custody_transfers(holding_id,from_organization_id,to_organization_id,quantity_kg,status) VALUES($1,$2,$3,1,'requested')",[holding,owner,buyer]);
 notice=(await query("INSERT INTO recall_notices(reference_code,title,reason,instructions,severity,status,initiated_by_user_id,initiated_by_organization_id,initiated_at) VALUES($1,'Journey safety notice','Recall investigation','Do not use material','critical','active',$2,$3,'2026-02-01') RETURNING id",['JOURNEY-'+crypto.randomUUID(),user,owner])).rows[0].id;
 await query('INSERT INTO recall_affected_batches(recall_id,batch_id) VALUES($1,$2)',[notice,batch]);
});
afterAll(async()=>{try{
 if(notice){await query('DELETE FROM recall_affected_batches WHERE recall_id=$1',[notice]);await query('DELETE FROM recall_notices WHERE id=$1',[notice]);}
 if(holding){await query('DELETE FROM custody_transfers WHERE holding_id=$1',[holding]);await query('DELETE FROM batch_holdings WHERE id=$1',[holding]);}
 if(batch){await query('DELETE FROM product_profiles WHERE batch_id=ANY($1::uuid[])',[[batch,otherBatch]]);await query('DELETE FROM harvest_batches WHERE id=ANY($1::uuid[])',[[batch,otherBatch]]);}
 }finally{await pool.end();}});
describe('published chronological journey pages',()=>{
 it('bounds embedded timeline and reports complete totals while recall warnings stay independent',async()=>{
 const response=await request(app).get(`/public/products/${slug}`);expect(response.status,JSON.stringify(response.body)).toBe(200);expect(response.body.journey).toHaveLength(50);expect(response.body.journeyPaging).toMatchObject({count:1007,hasMore:true});expect(response.body.journey[0]).toMatchObject({type:'harvest',occurredAt:'1960-01-01T00:00:00.000Z',verified:false});expect(response.body.safety.status).toBe('critical');expect(response.body.safety.activeRecalls.map((r:{id:string})=>r.id)).toContain(notice);
 });
 it('pages every same-time event exactly once using full numeric timestamp precision',async()=>{
 const ids:string[]=[];let cursor:string|undefined;
 do{const response=await read({limit:'100',search:'custody',...(cursor?{cursor}:{})});expect(response.status,JSON.stringify(response.body)).toBe(200);expect(response.body.items.length).toBeLessThanOrEqual(100);expect(response.body.count).toBe(1007);expect(response.body.items.every((r:{type:string})=>r.type==='custody')).toBe(true);expect(response.headers['cache-control']).toBe('no-store');ids.push(...response.body.items.map((r:{id:string})=>r.id));cursor=response.body.nextCursor||undefined;}while(cursor);
 expect(ids).toHaveLength(1005);expect(new Set(ids).size).toBe(1005);expect(ids).toEqual([...ids].sort());
 });
 it('searches before limiting and exposes no financial, user or source-row IDs',async()=>{
 const response=await read({limit:'1',search:'1005.000'});expect(response.status,JSON.stringify(response.body)).toBe(200);expect(response.body.items).toHaveLength(1);expect(response.body.items[0]).toMatchObject({type:'custody',summary:'1,005 kg · Journey owner → Journey buyer'});expect(response.body.count).toBe(1007);expect(Object.keys(response.body.items[0]).sort()).toEqual(['id','location','occurredAt','organization','summary','title','type','verified']);
 expect((await read({search:'%_'})).body.items).toEqual([]);
 });
 it('rechecks publication and rejects profile or search cursor reuse',async()=>{
 const first=await read({limit:'1'});expect(first.status).toBe(200);const cursor=first.body.nextCursor;
 expect((await read({limit:'1',cursor},otherSlug)).status).toBe(400);expect((await read({limit:'1',cursor,search:'changed'})).status).toBe(400);
 await query("UPDATE product_profiles SET visibility='archived' WHERE slug=$1",[slug]);try{expect((await read({limit:'1',cursor})).status).toBe(404);}finally{await query("UPDATE product_profiles SET visibility='published' WHERE slug=$1",[slug]);}
 });
 it('rejects invalid sizes, orders and repeated parameters',async()=>{
 for(const p of [{limit:'101'},{sort:'id'},{all:'true'},{search:'x'.repeat(81)},{cursor:'invalid'}] as Record<string,string>[])expect((await read(p)).status).toBe(400);
 expect((await request(app).get(`/public/products/${slug}/journey/page?search=a&search=b`)).status).toBe(400);
 });
});
