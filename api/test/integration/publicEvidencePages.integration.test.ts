import crypto from 'node:crypto';
import request from 'supertest';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import app from '../../src/app';
import {pool,query} from '../../src/db';
let owner:string,reviewer:string,ownerUser:string,reviewerUser:string,batch:string,secondBatch:string,slug:string,otherSlug:string,late:string;
const read=(parameters:Record<string,string>={},name=slug)=>request(app).get(`/public/products/${name}/evidence/page`).query(parameters);
beforeAll(async()=>{
 const orgs=(await query("INSERT INTO organizations(name,type,jurisdiction) VALUES('Public evidence owner','exporter','GH'),('Public evidence reviewer','certifier','GH') RETURNING id")).rows;
 owner=orgs[0].id;reviewer=orgs[1].id;
 const users=(await query("INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$3,'unused-test-hash','Owner'),($2,$4,'unused-test-hash','Reviewer') RETURNING id",[owner,reviewer,crypto.randomUUID()+'@integration.test',crypto.randomUUID()+'@integration.test'])).rows;
 ownerUser=users[0].id;reviewerUser=users[1].id;
 const batches=(await query("INSERT INTO harvest_batches(crop,harvest_date,quantity_kg,current_holder_id,source_mode,source_country) SELECT 'peanut',CURRENT_DATE,1005,$1,'direct_inventory','GH' FROM generate_series(1,2) RETURNING id",[owner])).rows;
 batch=batches[0].id;secondBatch=batches[1].id;slug='public-evidence-'+crypto.randomUUID();otherSlug='public-evidence-'+crypto.randomUUID();
 await query("INSERT INTO product_profiles(batch_id,slug,display_name,lot_code,visibility) VALUES($1,$3,'Reviewed public proof','PUBLIC-ONE','published'),($2,$4,'Another public proof','PUBLIC-TWO','published')",[batch,secondBatch,slug,otherSlug]);
 await query("INSERT INTO evidence_items(uploader_user_id,uploader_organization_id,type,file_name,sha256_hash,linked_entity_type,linked_entity_id,review_status,validation_status,malware_scan_status) SELECT $1,$2,'other','Public proof '||n||'.pdf',repeat('a',64),'batch',$3,'approved','validated','clean' FROM generate_series(1,1005) n",[ownerUser,owner,batch]);
 await query("INSERT INTO trust_claim_reviews(entity_type,entity_id,claim_key,claim_source,reviewer_user_id,reviewer_organization_id,review_method,reviewed_at) SELECT 'evidence',id,'evidence_review','independent_document_review',$2,$3,'document_review',NOW()-INTERVAL '1 hour' FROM evidence_items WHERE linked_entity_id=$1",[batch,reviewerUser,reviewer]);
 late=(await query('SELECT id FROM evidence_items WHERE linked_entity_id=$1 ORDER BY id DESC LIMIT 1',[batch])).rows[0].id;
 await query("UPDATE evidence_items SET file_name='Literal %_ late proof.pdf',claim_description='Reviewed late proof' WHERE id=$1",[late]);
});
afterAll(async()=>{try{
 if(batch){await query("DELETE FROM trust_claim_reviews WHERE entity_type='evidence' AND entity_id IN(SELECT id FROM evidence_items WHERE linked_entity_id=$1)",[batch]);await query('DELETE FROM evidence_items WHERE linked_entity_id=$1',[batch]);await query('DELETE FROM product_profiles WHERE batch_id=ANY($1::uuid[])',[[batch,secondBatch]]);await query('DELETE FROM harvest_batches WHERE id=ANY($1::uuid[])',[[batch,secondBatch]]);}
 }finally{await pool.end();}});
describe('published reviewed evidence pages',()=>{
 it('bounds page and embedded public profile metadata above 1,000 with full totals',async()=>{
 const first=await read({limit:'100'});expect(first.status,JSON.stringify(first.body)).toBe(200);expect(first.body.items).toHaveLength(100);expect(first.body.count).toBe(1005);expect(first.body.hasMore).toBe(true);expect(first.headers['cache-control']).toBe('no-store');
 const next=await read({limit:'100',cursor:first.body.nextCursor});expect(next.status,JSON.stringify(next.body)).toBe(200);expect(new Set([...first.body.items,...next.body.items].map((r:{id:string})=>r.id)).size).toBe(200);
 const profile=await request(app).get(`/public/products/${slug}`);expect(profile.status,JSON.stringify(profile.body)).toBe(200);expect(profile.body.evidence).toHaveLength(50);expect(profile.body.evidencePaging).toMatchObject({count:1005,hasMore:true});expect(profile.body.safety.status).toBe('clear');
 });
 it('searches literally before limiting and projects no storage, uploader or download credentials',async()=>{
 const response=await read({limit:'1',search:'%_'});expect(response.status,JSON.stringify(response.body)).toBe(200);expect(response.body.items).toHaveLength(1);expect(response.body.items[0]).toMatchObject({id:late,file_name:'Literal %_ late proof.pdf'});expect(response.body.count).toBe(1005);
 expect(Object.keys(response.body.items[0]).sort()).toEqual(['claim_description','created_at','file_name','id','review_status','sha256_hash','type']);
 });
 it('rejects unpublished profiles and cursor reuse across profiles or searches',async()=>{
 const first=await read({limit:'1'});expect(first.status).toBe(200);
 expect((await read({limit:'1',cursor:first.body.nextCursor},otherSlug)).status).toBe(400);
 expect((await read({limit:'1',cursor:first.body.nextCursor,search:'changed'})).status).toBe(400);
 await query("UPDATE product_profiles SET visibility='draft' WHERE slug=$1",[slug]);
 try{expect((await read({limit:'1',cursor:first.body.nextCursor})).status).toBe(404);expect((await request(app).get(`/public/products/${slug}`)).status).toBe(404);}finally{await query("UPDATE product_profiles SET visibility='published' WHERE slug=$1",[slug]);}
 });
 it('never lets an older approval override the newest revocation',async()=>{
 const review=(await query("INSERT INTO trust_claim_reviews(entity_type,entity_id,claim_key,claim_source,reviewer_user_id,reviewer_organization_id,review_method,status) VALUES('evidence',$1,'evidence_review','independent_document_review',$2,$3,'document_review','revoked') RETURNING id",[late,reviewerUser,reviewer])).rows[0].id;
 try{const response=await read({search:'%_'});expect(response.status).toBe(200);expect(response.body.items).toEqual([]);expect(response.body.count).toBe(1004);}finally{await query('DELETE FROM trust_claim_reviews WHERE id=$1',[review]);}
 });
 it('hides unscanned, unapproved evidence and expired or self reviews',async()=>{
 for(const [column,value,restore] of [['malware_scan_status','legacy_unscanned','clean'],['review_status','pending','approved']]){
 await query(`UPDATE evidence_items SET ${column}=$1 WHERE id=$2`,[value,late]);
 try{const response=await read({search:'%_'});expect(response.status,JSON.stringify(response.body)).toBe(200);expect(response.body.items).toEqual([]);}finally{await query(`UPDATE evidence_items SET ${column}=$1 WHERE id=$2`,[restore,late]);}
 }
 for(const self of [false,true]){
 const review=(await query("INSERT INTO trust_claim_reviews(entity_type,entity_id,claim_key,claim_source,reviewer_user_id,reviewer_organization_id,review_method,expires_at) VALUES('evidence',$1,'evidence_review','document_review',$2,$3,'document_review',$4) RETURNING id",[late,self?ownerUser:reviewerUser,self?owner:reviewer,self?null:'2020-01-01'])).rows[0].id;
 try{const response=await read({search:'%_'});expect(response.status).toBe(200);expect(response.body.items).toEqual([]);}finally{await query('DELETE FROM trust_claim_reviews WHERE id=$1',[review]);}
 }
 });
 it('rejects invalid page sizes, unknown filters and repeated query values',async()=>{
 for(const p of [{limit:'101'},{limit:'0'},{all:'true'},{search:'x'.repeat(81)}] as Record<string,string>[]) expect((await read(p)).status).toBe(400);
 expect((await request(app).get(`/public/products/${slug}/evidence/page?search=a&search=b`)).status).toBe(400);
 });
});
