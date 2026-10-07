import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import app from '../../src/app';
import { pool,query } from '../../src/db';
type Actor={org:string;token:string;user:string};
let owner:Actor,foreign:Actor,cooperative:Actor,certifier:Actor,observer:Actor;
let farmIds:string[]=[],batchIds:string[]=[],foreignFarm:string,foreignBatch:string,certificate:string;
async function actor(type='exporter',permissions=['farm.read','batch.read']):Promise<Actor>{
  const id=crypto.randomUUID();
  const org=(await query("INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,$2,'GH','verified') RETURNING id",[`Source ${id}`,type])).rows[0].id;
  const email=`source-${id}@integration.test`;
  const user=(await query('INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',[org,email,await bcrypt.hash('SourceRecords123!',4),'Source pagination'])).rows[0].id;
  const role=(await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id',[`source-${id}`,permissions])).rows[0].id;
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)',[user,role]);
  const signed=await request(app).post('/auth/login').send({email,password:'SourceRecords123!'});expect(signed.status).toBe(200);
  return {org,token:signed.body.accessToken,user};
}
const get=(path:string,parameters:Record<string,string>={},actor=owner)=>request(app).get(path).query(parameters).set('Authorization',`Bearer ${actor.token}`);
beforeAll(async()=>{
  owner=await actor();foreign=await actor();cooperative=await actor('cooperative');certifier=await actor('certifier');observer=await actor('exporter',['farm.read','batch.read','farm.read.all','batch.read.all']);
  farmIds=(await query("INSERT INTO farms(farmer_organization_id,name,country,region,district) SELECT $1,'Own source '||n,'GH','Northern','Tamale' FROM generate_series(1,1005) n RETURNING id",[owner.org])).rows.map(row=>row.id);
  batchIds=(await query("INSERT INTO harvest_batches(farm_id,crop,harvest_date,quantity_kg,current_holder_id) SELECT id,'shea',CURRENT_DATE,1,$1 FROM farms WHERE farmer_organization_id=$1 RETURNING id",[owner.org])).rows.map(row=>row.id);
  foreignFarm=(await query("INSERT INTO farms(farmer_organization_id,name,region,district) VALUES($1,'Foreign source','Northern','Tamale') RETURNING id",[foreign.org])).rows[0].id;
  foreignBatch=(await query("INSERT INTO harvest_batches(farm_id,crop,harvest_date,quantity_kg,current_holder_id) VALUES($1,'shea',CURRENT_DATE,1,$2) RETURNING id",[foreignFarm,foreign.org])).rows[0].id;
});
afterAll(async()=>{
  if(foreignBatch)await query('DELETE FROM batch_attestations WHERE batch_id=$1',[foreignBatch]);
  if(foreignBatch)await query('DELETE FROM batch_holdings WHERE batch_id=$1',[foreignBatch]);
  if(certificate)await query('DELETE FROM organic_certificates WHERE id=$1',[certificate]);
  await query('DELETE FROM harvest_batches WHERE id=ANY($1::uuid[])',[[...batchIds,foreignBatch].filter(Boolean)]);
  await query('DELETE FROM farms WHERE id=ANY($1::uuid[])',[[...farmIds,foreignFarm].filter(Boolean)]);
  await pool.end();
});
describe('paged source records and scoped aggregates',()=>{
  it('pages 1,005 owned farms, searches before LIMIT and reports complete authorized totals',async()=>{
    const first=await get('/farms/page',{limit:'100'});expect(first.status).toBe(200);expect(first.body.items).toHaveLength(100);
    const next=await get('/farms/page',{limit:'100',cursor:first.body.nextCursor});expect(next.status).toBe(200);
    const ids=[...first.body.items,...next.body.items].map((row:{id:string})=>row.id);expect(new Set(ids).size).toBe(200);expect(ids).toEqual([...ids].sort());
    const later=farmIds.find(id=>!ids.includes(id))!;
    const exact=await get('/farms/page',{search:later,owned:'true'});expect(exact.status).toBe(200);expect(exact.body.items.map((row:{id:string})=>row.id)).toEqual([later]);
    expect((await get('/farms/page',{search:foreignFarm})).body.items).toEqual([]);
    expect((await get('/farms/page',{search:'%'})).body.items).toEqual([]);
    const totals=await get('/farms/summary');expect(totals.status).toBe(200);expect(totals.body).toEqual({count:1005,owned_count:1005});
    expect((await get('/farms')).status).toBe(422);
    expect((await get('/farms/page',{cursor:first.body.nextCursor,owned:'true'})).status).toBe(400);
    expect((await get('/farms/page',{cursor:first.body.nextCursor},foreign)).status).toBe(400);
  });
  it('pages 1,005 batches with authoritative trust and farm filtering and full source totals',async()=>{
    const first=await get('/batches/page',{limit:'100'});expect(first.status).toBe(200);expect(first.body.items).toHaveLength(100);expect(first.body.items.every((row:{trust:unknown})=>Boolean(row.trust))).toBe(true);
    const next=await get('/batches/page',{limit:'100',cursor:first.body.nextCursor});expect(next.status).toBe(200);
    const ids=[...first.body.items,...next.body.items].map((row:{id:string})=>row.id);expect(new Set(ids).size).toBe(200);
    const later=batchIds.find(id=>!ids.includes(id))!;
    const farm=(await query('SELECT farm_id FROM harvest_batches WHERE id=$1',[later])).rows[0].farm_id;
    const scoped=await get('/batches/page',{farm});expect(scoped.status).toBe(200);expect(scoped.body.items.map((row:{id:string})=>row.id)).toEqual([later]);
    expect((await get('/batches/page',{farm:foreignFarm})).body.items).toEqual([]);
    expect((await get('/batches/page',{search:later})).body.items[0].id).toBe(later);
    const total=await get('/batches/summary');expect(total.status).toBe(200);expect(total.body).toEqual({count:1005,recorded_quantity_kg:'1005.000'});
    expect((await get('/batches/summary',{farm})).body.count).toBe(1);
    expect((await get('/batches')).status).toBe(422);
    expect((await get('/batches/page',{farm,cursor:first.body.nextCursor})).status).toBe(400);
  });
  it('retains cooperative/certifier farm and holding/attestation batch relationships without granting owned-source selection',async()=>{
    await query('UPDATE farms SET cooperative_organization_id=$1 WHERE id=$2',[cooperative.org,foreignFarm]);
    certificate=(await query("INSERT INTO organic_certificates(certifier_organization_id,farmer_organization_id,farm_id,valid_from,valid_to,issuing_authority,accreditation_reference) VALUES($1,$2,$3,CURRENT_DATE,CURRENT_DATE+1,'Test issuer','Test reference') RETURNING id",[certifier.org,foreign.org,foreignFarm])).rows[0].id;
    expect((await get('/farms/page',{search:foreignFarm},cooperative)).body.items[0].id).toBe(foreignFarm);
    expect((await get('/farms/page',{search:foreignFarm},certifier)).body.items[0].id).toBe(foreignFarm);
    expect((await get('/farms/page',{search:foreignFarm,owned:'true'},cooperative)).body.items).toEqual([]);
    expect((await get('/farms/page',{search:foreignFarm,owned:'true'},certifier)).body.items).toEqual([]);
    expect((await get('/batches/page',{search:foreignBatch},cooperative)).body.items[0].id).toBe(foreignBatch);
    expect((await get('/batches/page',{search:foreignBatch,mine:'true'},cooperative)).body.items).toEqual([]);
    expect((await get('/batches/page',{search:foreignBatch},certifier)).body.items).toEqual([]);
    const holding=(await query('INSERT INTO batch_holdings(batch_id,holder_organization_id,quantity_kg) VALUES($1,$2,1) RETURNING id',[foreignBatch,owner.org])).rows[0].id;
    expect((await get('/batches/page',{search:foreignBatch})).body.items[0].id).toBe(foreignBatch);
    await query('DELETE FROM batch_holdings WHERE id=$1',[holding]);
    await query("INSERT INTO batch_attestations(batch_id,certificate_id,certifier_user_id,certifier_organization_id,provenance_hash) VALUES($1,$2,$3,$4,'test-source-read')",[foreignBatch,certificate,certifier.user,certifier.org]);
    expect((await get('/batches/page',{search:foreignBatch},certifier)).body.items[0].id).toBe(foreignBatch);

  });
  it('honors explicit read-all and invalidates its cursor when live scope is narrowed',async()=>{
    expect((await get('/farms/page',{search:foreignFarm},observer)).body.items[0].id).toBe(foreignFarm);
    expect((await get('/batches/page',{search:foreignBatch},observer)).body.items[0].id).toBe(foreignBatch);
    const first=await get('/farms/page',{limit:'1'},observer);expect(first.status).toBe(200);
    await query("UPDATE roles r SET permissions=ARRAY['farm.read','batch.read']::text[] FROM user_roles ur WHERE ur.role_id=r.id AND ur.user_id=$1",[observer.user]);
    expect((await get('/farms/page',{cursor:first.body.nextCursor},observer)).status).toBe(400);
    expect((await get('/farms/page',{search:foreignFarm},observer)).body.items).toEqual([]);
    expect((await get('/batches/page',{search:foreignBatch},observer)).body.items).toEqual([]);
  });
  it('rejects malformed filters and preserves authentication and permission gates',async()=>{
    for(const input of [{limit:'101'},{owned:'yes'},{search:'x'.repeat(81)}] as Record<string,string>[])expect((await get('/farms/page',input)).status).toBe(400);
    expect((await get('/batches/page',{farm:'not-a-uuid'})).status).toBe(400);
    expect((await request(app).get('/farms/page')).status).toBe(401);
    expect((await request(app).get('/batches/summary')).status).toBe(401);
    await query("UPDATE roles r SET permissions='{}' FROM user_roles ur WHERE ur.role_id=r.id AND ur.user_id=$1",[certifier.user]);
    expect((await get('/farms/page',{},certifier)).status).toBe(403);
    expect((await get('/batches/page',{},certifier)).status).toBe(403);
  });
});
