import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import app from '../../src/app';
import { pool,query } from '../../src/db';
type Actor={org:string;token:string;user:string};
let owner:Actor,foreign:Actor,reader:Actor;
let farm:string,foreignFarm:string,sharedEvidence:string,foreignEvidence:string;
let ids:string[]=[];
async function actor(permissions=['evidence.read','farm.read']):Promise<Actor>{
  const unique=crypto.randomUUID();
  const org=(await query("INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'exporter','GH','verified') RETURNING id",[`Evidence ${unique}`])).rows[0].id;
  const email=`evidence-${unique}@integration.test`;
  const user=(await query('INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',[org,email,await bcrypt.hash('EvidencePaging123!',4),'Evidence paging'])).rows[0].id;
  const role=(await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id',[`evidence-${unique}`,permissions])).rows[0].id;
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)',[user,role]);
  const signed=await request(app).post('/auth/login').send({email,password:'EvidencePaging123!'});expect(signed.status).toBe(200);
  return {org,user,token:signed.body.accessToken};
}
const get=(path:string,parameters:Record<string,string>={},who=owner)=>request(app).get(path).query(parameters).set('Authorization',`Bearer ${who.token}`);
beforeAll(async()=>{
  owner=await actor();foreign=await actor();reader=await actor(['evidence.read','evidence.read.all']);
  farm=(await query("INSERT INTO farms(farmer_organization_id,name,region,district) VALUES($1,'Evidence source','Northern','Tamale') RETURNING id",[owner.org])).rows[0].id;
  foreignFarm=(await query("INSERT INTO farms(farmer_organization_id,name,region,district) VALUES($1,'Foreign evidence source','Northern','Tamale') RETURNING id",[foreign.org])).rows[0].id;
  ids=(await query(`INSERT INTO evidence_items(uploader_user_id,uploader_organization_id,type,file_name,sha256_hash,linked_entity_type,linked_entity_id,review_status,malware_scan_status,storage_key)
    SELECT $1,$2,'origin_document','Evidence file '||n||'.pdf','test-hash','farm',$3,'pending','legacy_unscanned','private-key-'||n FROM generate_series(1,1005) n RETURNING id`,[owner.user,owner.org,farm])).rows.map(row=>row.id);
  sharedEvidence=(await query(`INSERT INTO evidence_items(uploader_user_id,uploader_organization_id,type,file_name,sha256_hash,linked_entity_type,linked_entity_id)
    VALUES($1,$2,'other','Shared counterpart.pdf','test-hash','farm',$3) RETURNING id`,[foreign.user,foreign.org,farm])).rows[0].id;
  foreignEvidence=(await query(`INSERT INTO evidence_items(uploader_user_id,uploader_organization_id,type,file_name,sha256_hash,linked_entity_type,linked_entity_id)
    VALUES($1,$2,'other','Foreign private.pdf','test-hash','farm',$3) RETURNING id`,[foreign.user,foreign.org,foreignFarm])).rows[0].id;
});
afterAll(async()=>{
  await query('DELETE FROM evidence_items WHERE id=ANY($1::uuid[])',[[...ids,sharedEvidence,foreignEvidence].filter(Boolean)]);
  await query('DELETE FROM farms WHERE id=ANY($1::uuid[])',[[farm,foreignFarm].filter(Boolean)]);
  await pool.end();
});
describe('bounded evidence metadata and preserved document authorization',()=>{
  it('pages 1,005 documents with off-page literal search and no private storage metadata',async()=>{
    const first=await get('/evidence/page',{limit:'100'});expect(first.status).toBe(200);expect(first.body.items).toHaveLength(100);
    const next=await get('/evidence/page',{limit:'100',cursor:first.body.nextCursor});expect(next.status).toBe(200);expect(next.body.items).toHaveLength(100);
    const shown=[...first.body.items,...next.body.items].map((row:{id:string})=>row.id);expect(new Set(shown).size).toBe(200);
    const later=ids.find(id=>!shown.includes(id))!;
    const exact=await get('/evidence/page',{search:later});expect(exact.status).toBe(200);expect(exact.body.items.map((row:{id:string})=>row.id)).toEqual([later]);
    expect(exact.body.items[0]).not.toHaveProperty('storage_key');expect(exact.body.items[0]).not.toHaveProperty('storage_path');expect(exact.body.items[0]).not.toHaveProperty('uploader_user_id');
    expect(exact.body.items[0].malware_scan_status).toBe('legacy_unscanned');
    expect((await get('/evidence/page',{search:'%'})).body.items).toEqual([]);
    expect((await get('/evidence')).status).toBe(422);
    expect((await get('/evidence',{entityType:'farm',entityId:farm})).status).toBe(422);
  });
  it('keeps uploader library separate from authorized shared record evidence and refuses foreign entities',async()=>{
    expect((await get('/evidence/page',{search:sharedEvidence})).body.items).toEqual([]);
    const linked=await get('/evidence/page',{entityType:'farm',entityId:farm,search:sharedEvidence});expect(linked.status).toBe(200);expect(linked.body.items[0].id).toBe(sharedEvidence);
    expect((await get('/evidence/page',{entityType:'farm',entityId:foreignFarm})).status).toBe(403);
    expect((await get('/evidence',{entityType:'farm',entityId:foreignFarm})).status).toBe(403);
    expect((await get('/evidence/page',{search:foreignEvidence})).body.items).toEqual([]);
    expect((await get(`/evidence/${foreignEvidence}/download`)).status).toBe(403);
    expect((await get(`/evidence/${ids[0]}/download`)).status).toBe(423);
  });
  it('binds cursors to organization, entity/search and live read-all breadth and rechecks relationships',async()=>{
    const first=await get('/evidence/page',{limit:'1'});expect(first.status).toBe(200);
    expect((await get('/evidence/page',{cursor:first.body.nextCursor},foreign)).status).toBe(400);
    expect((await get('/evidence/page',{cursor:first.body.nextCursor,search:'changed'})).status).toBe(400);
    expect((await get('/evidence/page',{cursor:first.body.nextCursor,entityType:'farm',entityId:farm})).status).toBe(400);
    const linked=await get('/evidence/page',{limit:'1',entityType:'farm',entityId:farm});expect(linked.status).toBe(200);
    await query('UPDATE farms SET farmer_organization_id=$1 WHERE id=$2',[foreign.org,farm]);
    expect((await get('/evidence/page',{entityType:'farm',entityId:farm,cursor:linked.body.nextCursor})).status).toBe(403);
    await query('UPDATE farms SET farmer_organization_id=$1 WHERE id=$2',[owner.org,farm]);
    expect((await get('/evidence/page',{search:foreignEvidence},reader)).body.items[0].id).toBe(foreignEvidence);
    const network=await get('/evidence/page',{limit:'1'},reader);expect(network.status).toBe(200);
    await query("UPDATE roles r SET permissions=ARRAY['evidence.read']::text[] FROM user_roles ur WHERE ur.role_id=r.id AND ur.user_id=$1",[reader.user]);
    expect((await get('/evidence/page',{cursor:network.body.nextCursor},reader)).status).toBe(400);
    expect((await get('/evidence/page',{search:foreignEvidence},reader)).body.items).toEqual([]);
  });
  it('rejects invalid parameters and preserves authentication and permission checks',async()=>{
    for(const input of [{limit:'101'},{entityType:'farm'},{entityId:farm},{entityType:'farm',entityId:'bad-id'},{search:'x'.repeat(81)},{unexpected:'true'}] as Record<string,string>[])
      expect((await get('/evidence/page',input)).status).toBe(400);
    expect((await request(app).get('/evidence/page')).status).toBe(401);
    await query("UPDATE roles r SET permissions='{}' FROM user_roles ur WHERE ur.role_id=r.id AND ur.user_id=$1",[reader.user]);
    expect((await get('/evidence/page',{},reader)).status).toBe(403);
  });
});
