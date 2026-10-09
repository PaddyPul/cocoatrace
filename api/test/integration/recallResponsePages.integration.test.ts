import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
type Actor = { org: string; user: string; token: string; role: string };
let manager: Actor, recipient: Actor, outsider: Actor;
let notice: string, batch: string, lateHolding: string, lateEvidence: string;
async function actor(permissions: string[]): Promise<Actor> {
  const tag = crypto.randomUUID();
  const org = (await query("INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'exporter','GH','verified') RETURNING id", ['Response pages '+tag])).rows[0].id;
  const email = `response-pages-${tag}@integration.test`;
  const user = (await query('INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id', [org,email,await bcrypt.hash('ResponsePages123!',4),'Response reader'])).rows[0].id;
  const role = (await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id', ['response-pages-'+tag,permissions])).rows[0].id;
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)',[user,role]);
  const login = await request(app).post('/auth/login').send({email,password:'ResponsePages123!'});
  expect(login.status).toBe(200);
  return {org,user,role,token:login.body.accessToken};
}
const get = (parameters: Record<string,string> = {}, who?:Actor) => request(app).get(`/recalls/${notice}/response`).query(parameters).set('Authorization',`Bearer ${(who || manager).token}`);
beforeAll(async () => {
  manager=await actor(['recall.manage','evidence.read']);
  recipient=await actor([]);
  outsider=await actor(['analytics.read.network','evidence.read']);
  notice=(await query("INSERT INTO recall_notices(reference_code,title,reason,instructions,severity,status,initiated_by_user_id,initiated_by_organization_id) VALUES($1,'Response paging','Test only','Hold material','warning','active',$2,$3) RETURNING id",['RESPONSE-PAGE-'+crypto.randomUUID(),manager.user,manager.org])).rows[0].id;
  await query('INSERT INTO recall_participants(recall_id,organization_id) VALUES($1,$2),($1,$3)',[notice,manager.org,recipient.org]);
  await query("WITH orgs AS (INSERT INTO organizations(name,type,jurisdiction,verification_status) SELECT 'Response participant '||gen_random_uuid(),'exporter','GH','verified' FROM generate_series(1,1003) RETURNING id) INSERT INTO recall_participants(recall_id,organization_id) SELECT $1,id FROM orgs",[notice]);
  batch=(await query("INSERT INTO harvest_batches(crop,harvest_date,quantity_kg,current_holder_id,source_mode,source_name,source_country) VALUES('peanut',CURRENT_DATE,1006,$1,'direct_inventory','Response test stock','GH') RETURNING id",[recipient.org])).rows[0].id;
  await query("INSERT INTO batch_holdings(batch_id,holder_organization_id,quantity_kg,warehouse_location) SELECT $1,$2,1,'Held response stock' FROM generate_series(1,1005)",[batch,recipient.org]);
  await query("INSERT INTO batch_holdings(batch_id,holder_organization_id,quantity_kg,warehouse_location) VALUES($1,$2,1,'Manager stock')",[batch,manager.org]);
  await query("INSERT INTO recall_safety_holds(recall_id,entity_type,entity_id) SELECT $1,'holding',id FROM batch_holdings WHERE batch_id=$2",[notice,batch]);
  await query("INSERT INTO recall_recovery_records(recall_id,holding_id,quarantined_kg,note,recorded_by_user_id) SELECT $1,id,1,'Existing recovery snapshot',$3 FROM batch_holdings WHERE batch_id=$2",[notice,batch,manager.user]);
  lateHolding=(await query('SELECT id FROM batch_holdings WHERE batch_id=$1 AND holder_organization_id=$2 ORDER BY id DESC LIMIT 1',[batch,recipient.org])).rows[0].id;
  await query("UPDATE batch_holdings SET warehouse_location='Literal %_ late holding' WHERE id=$1",[lateHolding]);
  await query("INSERT INTO evidence_items(uploader_user_id,uploader_organization_id,type,file_name,sha256_hash,linked_entity_type,linked_entity_id,validation_status,malware_scan_status) SELECT $1,$2,'other','response-'||n||'.pdf',repeat('a',64),'recall',$3,'validated','clean' FROM generate_series(1,1005) n",[manager.user,manager.org,notice]);
  lateEvidence=(await query("SELECT id FROM evidence_items WHERE linked_entity_type='recall' AND linked_entity_id=$1 ORDER BY id DESC LIMIT 1",[notice])).rows[0].id;
  await query("UPDATE evidence_items SET file_name='Literal %_ late proof.pdf' WHERE id=$1",[lateEvidence]);
});
afterAll(async () => {
  try {
    if(notice) {
      await query("DELETE FROM evidence_items WHERE linked_entity_type='recall' AND linked_entity_id=$1",[notice]);
      await query('DELETE FROM recall_recovery_records WHERE recall_id=$1',[notice]);
      await query('DELETE FROM recall_safety_holds WHERE recall_id=$1',[notice]);
      await query('DELETE FROM recall_participants WHERE recall_id=$1',[notice]);
      await query('DELETE FROM recall_notices WHERE id=$1',[notice]);
    }
    if(batch) { await query('DELETE FROM batch_holdings WHERE batch_id=$1',[batch]); await query('DELETE FROM harvest_batches WHERE id=$1',[batch]); }
  } finally { await pool.end(); }
});
describe('recall response pages and current recipient boundaries', () => {
  it('bounds all four collections and preserves complete scoped totals above 1,000', async () => {
    const first=await get({limit:'100'});expect(first.status,JSON.stringify(first.body)).toBe(200);
    for(const name of ['participants','holdings','recoveries','evidence']) {
      expect(first.body[name]).toHaveLength(100);
      expect(first.body.paging[name]).toMatchObject({hasMore:true,count:name==='holdings'||name==='recoveries'?1006:1005});
      const next=await get({limit:'100',[`${name}Cursor`]:first.body.paging[name].nextCursor});expect(next.status,JSON.stringify(next.body)).toBe(200);
      const key=name==='participants'?'organization_id':name==='recoveries'?'holding_id':'id';
      expect(new Set([...first.body[name],...next.body[name]].map((row:Record<string,string>)=>row[key])).size).toBe(200);
    }
    const legacy=await get();expect(legacy.status).toBe(422);expect(legacy.body.code).toBe('CATALOG_READ_LIMIT');
  });
  it('filters literally before limiting and includes saved recovery with the chosen off-page holding',async()=>{
    const filtered=await get({limit:'2',holdingsSearch:'%_',evidenceSearch:'%_'});expect(filtered.status,JSON.stringify(filtered.body)).toBe(200);
    expect(filtered.body.holdings.map((row:{id:string})=>row.id)).toEqual([lateHolding]);
    expect(filtered.body.holdings[0].recovery).toMatchObject({holding_id:lateHolding,quarantined_kg:'1.000',note:'Existing recovery snapshot'});
    expect(filtered.body.evidence).toEqual([{id:lateEvidence,file_name:'Literal %_ late proof.pdf'}]);
    expect(JSON.stringify(filtered.body.evidence)).not.toContain('storage_key');
    expect(filtered.body.paging.holdings.count).toBe(1006);
  });
  it('recipients see only their own participants and stock; evidence needs explicit permission',async()=>{
    const own=await get({limit:'100'},recipient);expect(own.status,JSON.stringify(own.body)).toBe(200);
    expect(own.body.canManage).toBe(false);expect(own.body.participants).toHaveLength(1);
    expect(own.body.holdings.every((h:{holder_organization_id:string})=>h.holder_organization_id===recipient.org)).toBe(true);
    expect(own.body.paging.holdings.count).toBe(1005);expect(own.body.paging.evidence.count).toBe(0);expect(own.body.evidence).toEqual([]);
    expect((await get({limit:'100'},outsider)).status).toBe(404);
    const cursor=own.body.paging.holdings.nextCursor;
    expect((await get({limit:'100',holdingsCursor:cursor},manager)).status).toBe(400);
    expect((await get({limit:'100',holdingsCursor:cursor,holdingsSearch:'changed'},recipient)).status).toBe(400);
    expect((await get({limit:'100',evidenceCursor:cursor},recipient)).status).toBe(400);
  });
  it('revalidates an exact selected holding independently of its visible inventory page',async()=>{
    const own=await get({limit:'2',selectedHoldingId:lateHolding},recipient);expect(own.status,JSON.stringify(own.body)).toBe(200);
    expect(own.body.holdings.some((row:{id:string})=>row.id===lateHolding)).toBe(false);
    expect(own.body.selectedHolding).toMatchObject({id:lateHolding,holder_organization_id:recipient.org,recovery:{holding_id:lateHolding}});
    const foreign=(await query('SELECT id FROM batch_holdings WHERE batch_id=$1 AND holder_organization_id=$2',[batch,manager.org])).rows[0].id;
    const denied=await get({limit:'2',selectedHoldingId:foreign},recipient);expect(denied.status).toBe(200);expect(denied.body.selectedHolding).toBeNull();
    expect((await get({limit:'2',selectedHoldingId:'invalid'},recipient)).status).toBe(400);
  });
  it('rejects malformed limits, unknown filters and repeated parameter arrays',async()=>{
    for(const parameters of [{limit:'101'},{limit:'0'},{limit:'2',unknown:'true'},{limit:'2',holdingsCursor:'invalid'}] as Record<string,string>[]) expect((await get(parameters)).status).toBe(400);
    expect((await request(app).get(`/recalls/${notice}/response?limit=2&holdingsSearch=a&holdingsSearch=b`).set('Authorization',`Bearer ${manager.token}`)).status).toBe(400);
  });
  it('rechecks membership on every read rather than trusting a previous page cursor',async()=>{
    const first=await get({limit:'2'},recipient);expect(first.status).toBe(200);
    await query('DELETE FROM recall_participants WHERE recall_id=$1 AND organization_id=$2',[notice,recipient.org]);
    try { expect((await get({limit:'2',holdingsCursor:first.body.paging.holdings.nextCursor},recipient)).status).toBe(404); }
    finally { await query('INSERT INTO recall_participants(recall_id,organization_id) VALUES($1,$2)',[notice,recipient.org]); }
  });
});
