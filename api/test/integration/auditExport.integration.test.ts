import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
import { authenticator } from '../../src/testing/webauthnFixture';
type Actor = { org: string; user: string; token: string };
let owner: Actor, other: Actor, network: Actor, reader: Actor;
const entity = crypto.randomUUID(), foreign = crypto.randomUUID(), large = crypto.randomUUID();
async function actor(permissions: string[]): Promise<Actor> {
  const tag = crypto.randomUUID();
  const org = (await query("INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'exporter','GH','verified') RETURNING id", ['Audit export '+tag])).rows[0].id;
  const email = `audit-export-${tag}@integration.test`;
  const user = (await query('INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id', [org,email,await bcrypt.hash('AuditExport123!',4),'Export reader'])).rows[0].id;
  const role = (await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id', ['audit-export-'+tag,permissions])).rows[0].id;
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)',[user,role]);
  const login = await request(app).post('/auth/login').send({email,password:'AuditExport123!'});
  expect(login.status,JSON.stringify(login.body)).toBe(200);
  const token=login.body.accessToken;
  if(permissions.some(permission=>['audit.read.all','audit.export.all'].includes(permission))) {
    const options=await request(app).post('/auth/mfa/registration/options').set('Authorization',`Bearer ${token}`).send({currentPassword:'AuditExport123!'});
    expect(options.status,JSON.stringify(options.body)).toBe(200);
    const key=authenticator();
    const enrolled=await request(app).post('/auth/mfa/registration/verify').set('Authorization',`Bearer ${token}`).send({response:key.registration(options.body.challenge),label:'Audit export test key'});
    expect(enrolled.status,JSON.stringify(enrolled.body)).toBe(200);
  }
  return {org,user,token};
}
const get = (who:Actor = owner, parameters:Record<string,string> = {}) => request(app).get('/audit/export').query(parameters).set('Authorization',`Bearer ${who.token}`);
beforeAll(async () => {
  owner=await actor(['audit.export']); other=await actor(['audit.export']);
  network=await actor(['audit.export','audit.export.all']); reader=await actor(['audit.read.all']);
  await query(`INSERT INTO audit_events(actor_user_id,actor_organization_id,action,entity_type,entity_id,metadata,new_state_hash)
    SELECT $1,$2,'export-test','audit_fixture',$3,jsonb_build_object('sequence',n),'sha256:export-fixture'
    FROM generate_series(1,1005) n`,[owner.user,owner.org,entity]);
  await query(`INSERT INTO audit_events(actor_user_id,actor_organization_id,action,entity_type,entity_id,metadata,new_state_hash)
    VALUES($1,$2,'export-test','audit_fixture',$3,'{"private":"foreign organization"}','sha256:export-fixture')`,[other.user,other.org,foreign]);
  await query(`INSERT INTO audit_events(actor_user_id,actor_organization_id,action,entity_type,entity_id,metadata,new_state_hash)
    VALUES($1,$2,'export-test','audit_fixture',$3,$4,'sha256:export-fixture')`,[owner.user,owner.org,large,JSON.stringify({proof:'x'.repeat(4*1024*1024)})]);
});
afterAll(async () => {
  try { for(const who of [owner,other,network,reader]) if(who) await query('DELETE FROM audit_events WHERE actor_organization_id=$1',[who.org]); }
  finally { await pool.end(); }
});
describe('complete audit export size and authorization boundaries', () => {
  it('rejects over 1,000 records explicitly, without a partial attachment or export-success audit',async()=>{
    const before=(await query("SELECT COUNT(*)::int count FROM audit_events WHERE actor_organization_id=$1 AND action='export'",[owner.org])).rows[0].count;
    const res=await get(owner,{entityType:'audit_fixture',entityId:entity});
    expect(res.status,JSON.stringify(res.body)).toBe(422);expect(res.body.code).toBe('AUDIT_EXPORT_LIMIT');
    expect(res.headers['content-disposition']).toBeUndefined();
    expect((await query("SELECT COUNT(*)::int count FROM audit_events WHERE actor_organization_id=$1 AND action='export'",[owner.org])).rows[0].count).toBe(before);
  });
  it('preserves exact scope, complete JSON format, order and durable download attribution',async()=>{
    const res=await get(other,{entityType:'audit_fixture',entityId:foreign});
    expect(res.status,JSON.stringify(res.body)).toBe(200);expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({actor_organization_id:other.org,entity_id:foreign,metadata:{private:'foreign organization'}});
    expect(res.headers['cache-control']).toBe('no-store');expect(res.headers['content-disposition']).toContain('attachment;');
    const recorded=(await query("SELECT * FROM audit_events WHERE actor_user_id=$1 AND action='export'",[other.user])).rows;
    expect(recorded).toHaveLength(1);expect(recorded[0].metadata).toMatchObject({entityType:'audit_fixture',entityId:foreign,recordCount:1,scope:'organization'});
    expect(recorded[0].entity_id).toMatch(/^[a-f0-9-]{36}$/);
    expect(JSON.stringify(recorded[0].metadata)).not.toContain('foreign organization');
  });
  it('does not expose another tenant by exact entity filter but honors explicit network export',async()=>{
    const denied=await get(owner,{entityType:'audit_fixture',entityId:foreign});expect(denied.status).toBe(200);expect(denied.body).toEqual([]);
    const shared=await get(network,{entityType:'audit_fixture',entityId:foreign});expect(shared.status,JSON.stringify(shared.body)).toBe(200);expect(shared.body).toHaveLength(1);
    expect(shared.body[0].actor_organization_id).toBe(other.org);
    expect((await get(reader,{entityType:'audit_fixture',entityId:foreign})).status).toBe(403);
    expect((await request(app).get('/audit/export')).status).toBe(401);
  });
  it('rejects a complete byte-overflow report rather than truncating its metadata',async()=>{
    const res=await get(owner,{entityType:'audit_fixture',entityId:large});
    expect(res.status,JSON.stringify(res.body)).toBe(422);expect(res.body.code).toBe('AUDIT_EXPORT_LIMIT');expect(res.headers['content-disposition']).toBeUndefined();
  });
  it('rejects incomplete, repeated and unsupported filter parameters before exporting',async()=>{
    for(const input of ([{entityType:'audit_fixture'},{entityId:foreign},{entityType:'audit_fixture',entityId:'invalid'},{limit:'100'}] as Record<string,string>[]))
      expect((await get(owner,input)).status).toBe(400);
    expect((await request(app).get('/audit/export?entityType=a&entityType=b&entityId='+foreign).set('Authorization',`Bearer ${owner.token}`)).status).toBe(400);
  });
});
