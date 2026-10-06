import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import type { Request } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
import { createSession } from '../../src/services/authSessionService';
import { checkPublicAction, publicBudgets, type PublicOperation } from '../../src/modules/security/publicRateLimits';
import { PostgresRateStore, rateKey } from '../../src/modules/security/rateLimits';
import { requireDisposableTestDatabase } from '../../src/testing/databaseSafety';

type Actor={id:string;organizationId:string;token:string};
let first:Actor,other:Actor;
async function actor():Promise<Actor>{
 const suffix=crypto.randomUUID();
 const org=(await query("INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'exporter','GH','verified') RETURNING id",[`Resource limits ${suffix}`])).rows[0];
 const user=(await query('INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',[org.id,`resource-${suffix}@integration.test`,await bcrypt.hash('ResourceRegression123!',4),'Resource regression'])).rows[0];
 const role=(await query("INSERT INTO roles(name,permissions) VALUES($1,ARRAY['evidence.upload','member.invite']) RETURNING id",[`resource-${suffix}`])).rows[0];
 await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)',[user.id,role.id]);
 return {id:user.id,organizationId:org.id,token:(await createSession(user.id)).token};
}
async function exhaust(operation:PublicOperation,scope:string,target:string,limit:number){
 await query("INSERT INTO auth_rate_limits(bucket_key,attempts,expires_at) VALUES($1,$2,NOW()+INTERVAL '15 minutes') ON CONFLICT(bucket_key) DO UPDATE SET attempts=EXCLUDED.attempts,expires_at=EXCLUDED.expires_at",[rateKey(`public:${operation}`,scope,target),limit]);
}
beforeAll(async()=>{requireDisposableTestDatabase(process.env.TEST_DATABASE_URL||process.env.DATABASE_URL);first=await actor();other=await actor();});
beforeEach(async()=>{await query('TRUNCATE auth_rate_limits');});
afterAll(async()=>{await pool.end();});

describe('shared public and resource abuse boundaries',()=>{
 it('serializes a deployment budget across independent workers and stops creating peer buckets',async()=>{
  const budget=publicBudgets.scan.deployment,stores=[new PostgresRateStore(),new PostgresRateStore()];
  await exhaust('scan','deployment','all',budget-8);
  const decisions=await Promise.all(Array.from({length:24},(_,n)=>checkPublicAction({ip:`peer-${n}`} as Request,stores[n%2],'scan')));
  expect(decisions.filter(d=>d.allowed)).toHaveLength(8);
  const rows=(await query('SELECT bucket_key,attempts FROM auth_rate_limits')).rows;
  expect(rows).toHaveLength(9);
  expect(rows.find(r=>r.bucket_key===rateKey('public:scan','deployment','all')).attempts).toBe(budget+1);
 });
 it.each([
  {method:'get',path:'/public/products/missing-limit-profile',operation:'profile'},
  {method:'get',path:'/public/products/missing-limit-profile/qr.svg',operation:'qr'},
  {method:'post',path:'/public/products/missing-limit-profile/scans',operation:'scan'},
  {method:'get',path:'/auth/invitations/missing-limit-token',operation:'invitationPreview'},
 ] as const)('$operation throttles before its expensive handler even with rotated target/header input',async({method,path,operation})=>{
  await exhaust(operation,'deployment','all',publicBudgets[operation].deployment);
  const before=(await query('SELECT COUNT(*)::int n FROM product_profile_scans')).rows[0].n;
  const response=await request(app)[method](path).set('X-Forwarded-For','192.0.2.23').send({email:'ignored@integration.test',organizationId:other.organizationId});
  expect(response.status).toBe(429);expect(response.body.code).toBe('RESOURCE_RATE_LIMITED');expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
  expect((await query('SELECT COUNT(*)::int n FROM product_profile_scans')).rows[0].n).toBe(before);
  expect((await query('SELECT COUNT(*)::int n FROM auth_rate_limits')).rows[0].n).toBe(1);
 });
 it('actual scan route keeps one socket-peer budget across slug and forwarded-address rotation',async()=>{
  const response=await request(app).post('/public/products/missing-peer-profile/scans');expect(response.status).toBe(404);
  const deployment=rateKey('public:scan','deployment','all');
  const peer=(await query('SELECT bucket_key FROM auth_rate_limits WHERE bucket_key<>$1',[deployment])).rows[0].bucket_key;
  await query('UPDATE auth_rate_limits SET attempts=$1 WHERE bucket_key=$2',[publicBudgets.scan.ip,peer]);
  const denied=await request(app).post('/public/products/rotated-peer-profile/scans').set('X-Forwarded-For','192.0.2.199');
  expect(denied.status).toBe(429);expect(denied.body.code).toBe('RESOURCE_RATE_LIMITED');
  expect((await query('SELECT COUNT(*)::int n FROM auth_rate_limits')).rows[0].n).toBe(2);
 });
 it('authenticated user quota survives token rotation and does not consume an unrelated tenant budget',async()=>{
  await exhaust('uploadIntent','user',first.id,publicBudgets.uploadIntent.user);
  const before=(await query('SELECT COUNT(*)::int n FROM evidence_upload_intents')).rows[0].n;
  const newToken=(await createSession(first.id)).token;
  const denied=await request(app).post('/evidence/upload-intents').set('Authorization',`Bearer ${newToken}`).send({organizationId:other.organizationId});
  expect(denied.status).toBe(429);
  expect((await query('SELECT COUNT(*)::int n FROM evidence_upload_intents')).rows[0].n).toBe(before);
  const permitted=await request(app).post('/evidence/upload-intents').set('Authorization',`Bearer ${other.token}`).send({});
  expect(permitted.status).toBe(400); // Reaches input validation, not a bypass of resource authorization.
  expect((await query('SELECT attempts FROM auth_rate_limits WHERE bucket_key=$1',[rateKey('public:uploadIntent','organization',other.organizationId)])).rows[0].attempts).toBe(1);
 });
 it('unauthenticated intent requests do not charge any resource quota and invitation creation is bounded',async()=>{
  expect((await request(app).post('/evidence/upload-intents').send({})).status).toBe(401);
  expect((await query('SELECT * FROM auth_rate_limits')).rows).toHaveLength(0);
  await exhaust('invitationCreate','organization',first.organizationId,publicBudgets.invitationCreate.organization);
  const before=(await query('SELECT COUNT(*)::int n FROM user_invitations')).rows[0].n;
  expect((await request(app).post('/invitations').set('Authorization',`Bearer ${first.token}`).send({email:'blocked@integration.test',role:'supplier_admin'})).status).toBe(429);
  expect((await query('SELECT COUNT(*)::int n FROM user_invitations')).rows[0].n).toBe(before);
 });
 it('content exhaustion rejects before raw-body allocation and creates no evidence',async()=>{
  await exhaust('uploadContent','deployment','all',publicBudgets.uploadContent.deployment);
  const before=(await query('SELECT COUNT(*)::int n FROM evidence_items')).rows[0].n;
  const response=await request(app).put(`/evidence/upload-intents/${crypto.randomUUID()}/content?expires=1&signature=ignored`).set('Content-Type','application/pdf').send(Buffer.alloc(513));
  expect(response.status).toBe(429);expect(response.body.code).toBe('RESOURCE_RATE_LIMITED');
  expect((await query('SELECT COUNT(*)::int n FROM evidence_items')).rows[0].n).toBe(before);
 });
 it('expired deployment quota resumes using database time and stores no raw visitor or token identifiers',async()=>{
  const key=rateKey('public:qr','deployment','all');await exhaust('qr','deployment','all',publicBudgets.qr.deployment);
  await query("UPDATE auth_rate_limits SET expires_at=NOW()-INTERVAL '1 second' WHERE bucket_key=$1",[key]);
  const req={ip:'private-peer-value',params:{slug:'secret-slug'},query:{signature:'secret-upload-token'}} as unknown as Request;
  expect((await checkPublicAction(req,new PostgresRateStore(),'qr')).allowed).toBe(true);
  const rows=(await query('SELECT bucket_key,attempts FROM auth_rate_limits')).rows;
  expect(rows.find(r=>r.bucket_key===key).attempts).toBe(1);
  expect(rows.every(r=>/^[0-9a-f]{64}$/.test(r.bucket_key))).toBe(true);
 });
});
