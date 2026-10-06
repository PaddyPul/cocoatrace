import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import {afterAll,beforeEach,describe,expect,it,vi} from 'vitest';
vi.mock('../../src/config/env',async importOriginal=>{
  const original=await importOriginal<typeof import('../../src/config/env')>();
  return {...original,config:{...original.config,mfaEnforced:true}};
});
import app from '../../src/app';
import {query,pool} from '../../src/db';
import {authenticator} from '../../src/testing/webauthnFixture';
import {requestPasswordReset,resetPassword} from '../../src/services/passwordLifecycleService';
import {approveRecovery} from '../../src/modules/mfa/recovery';
const password='MfaRegressionPassword123!';
type Account={userId:string;token:string;email:string;sessionId:string};
const post=(a:Account,path:string,data={})=>request(app).post(path).set('Authorization',`Bearer ${a.token}`).send(data);
const get=(a:Account,path:string)=>request(app).get(path).set('Authorization',`Bearer ${a.token}`);
async function account(permissions=['*']):Promise<Account>{
  const suffix=crypto.randomUUID(),email=`mfa-${suffix}@integration.test`;
  const org=(await query("INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'admin','GH','verified') RETURNING id",[`MFA ${suffix}`])).rows[0];
  const user=(await query('INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',[org.id,email,await bcrypt.hash(password,4),'MFA regression'])).rows[0];
  const role=(await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id',[`mfa-${suffix}`,permissions])).rows[0];
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)',[user.id,role.id]);
  const login=await request(app).post('/auth/login').send({email,password});expect(login.status).toBe(200);
  const session=(await query('SELECT id FROM sessions WHERE user_id=$1',[user.id])).rows[0];
  return {userId:user.id,email,token:login.body.accessToken,sessionId:session.id};
}
async function enroll(a:Account,key=authenticator()){
  const opts=await post(a,'/auth/mfa/registration/options',{currentPassword:password});expect(opts.status).toBe(200);
  const response=key.registration(opts.body.challenge);
  expect((await post(a,'/auth/mfa/registration/verify',{response,label:'Regression key'})).status).toBe(200);
  return key;
}
async function verify(a:Account,key:ReturnType<typeof authenticator>,counter=1){
  const opts=await post(a,'/auth/mfa/authentication/options');expect(opts.status).toBe(200);
  const response=key.authentication(opts.body.challenge,counter);
  return post(a,'/auth/mfa/authentication/verify',{response});
}
beforeEach(async()=>{await query('TRUNCATE auth_rate_limits');});
afterAll(async()=>{await pool.end();});
describe('real PostgreSQL passkey boundaries',()=>{
  it('restricts password-only privileged sessions but permits setup/status/logout',async()=>{
    const a=await account();expect((await get(a,'/organizations')).status).toBe(403);
    expect((await get(a,'/me')).body.mfa).toMatchObject({required:true,enrolled:false,verified:false});
    expect((await post(a,'/auth/mfa/registration/options',{currentPassword:'wrong'})).status).toBe(403);
    await enroll(a);expect((await get(a,'/organizations')).status).toBe(200);
    expect((await post(a,'/auth/logout')).status).toBe(204);
  });
  it('passkey verification clears MFA restriction without granting organization administration',async()=>{
    const a=await account(['holding.read','member.invite']);
    const restricted=await get(a,'/holdings');
    expect(restricted.status).toBe(403);
    expect(restricted.body.code).toBe('MFA_REQUIRED');
    await enroll(a);
    expect((await get(a,'/me')).body.mfa).toMatchObject({required:true,enrolled:true,verified:true});
    expect((await get(a,'/holdings')).status).toBe(200);
    const forbidden=await get(a,'/organizations');
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error).toBe('Permission required: organization.admin');
  });
  it('rejects malformed input with a controlled 400',async()=>{
    const a=await account();expect((await post(a,'/auth/mfa/registration/verify',{response:{}})).status).toBe(400);
  });
  it.each(['origin','rp','uv','expiry','cross-session'])('rejects %s registration without recording a key',async failure=>{
    const a=await account(),key=authenticator();const opts=await post(a,'/auth/mfa/registration/options',{currentPassword:password});
    if(failure==='expiry')await query("UPDATE mfa_challenges SET expires_at=NOW()-INTERVAL '1 second' WHERE session_id=$1",[a.sessionId]);
    const response=key.registration(opts.body.challenge,failure==='origin'?'https://evil.example':'http://localhost:3000',failure==='rp'?'evil.example':'localhost',failure!=='uv');
    const other=failure==='cross-session'?await account():a;
    expect((await post(other,'/auth/mfa/registration/verify',{response,label:'Rejected'})).status).toBe(403);
    expect((await query('SELECT id FROM user_passkeys WHERE user_id=$1',[a.userId])).rows).toHaveLength(0);
  });
  it('consumes failed challenges and rotates outstanding challenges',async()=>{
    const a=await account(),key=authenticator();const first=await post(a,'/auth/mfa/registration/options',{currentPassword:password});
    const second=await post(a,'/auth/mfa/registration/options',{currentPassword:password});
    expect(first.body.challenge).not.toBe(second.body.challenge);
    expect((await post(a,'/auth/mfa/registration/verify',{response:key.registration(first.body.challenge),label:'Old'})).status).toBe(403);
    expect((await post(a,'/auth/mfa/registration/verify',{response:key.registration(second.body.challenge),label:'Consumed'})).status).toBe(403);
    expect((await query("SELECT success FROM security_events WHERE actor_user_id=$1 AND event_type='mfa.registration'",[a.userId])).rows.map(row=>row.success)).toEqual([false,false]);
  });
  it('serializes concurrent registration replays into one key and one success',async()=>{
    const a=await account(),key=authenticator();const opts=await post(a,'/auth/mfa/registration/options',{currentPassword:password});
    const results=await Promise.all([1,2].map(()=>post(a,'/auth/mfa/registration/verify',{response:key.registration(opts.body.challenge),label:'Single key'})));
    expect(results.map(result=>result.status).sort()).toEqual([200,403]);
    expect((await query('SELECT id FROM user_passkeys WHERE user_id=$1',[a.userId])).rows).toHaveLength(1);
  });
  it('requires a fresh signed assertion for writes and rejects counter replay',async()=>{
    const a=await account(),key=await enroll(a);
    await query("UPDATE sessions SET mfa_verified_at=NOW()-INTERVAL '6 minutes' WHERE id=$1",[a.sessionId]);
    expect((await get(a,'/organizations')).status).toBe(200);
    expect((await post(a,'/auth/password/change',{currentPassword:password,newPassword:'NewMfaPassword456!'})).body.code).toBe('MFA_STEP_UP_REQUIRED');
    expect((await verify(a,key)).status).toBe(200);expect((await verify(a,key,1)).status).toBe(403);
  });
  it('cannot use a ceremony issued before account suspension',async()=>{
    const a=await account(),key=authenticator();const opts=await post(a,'/auth/mfa/registration/options',{currentPassword:password});
    await query('UPDATE users SET access_suspended_at=NOW() WHERE id=$1',[a.userId]);
    expect((await post(a,'/auth/mfa/registration/verify',{response:key.registration(opts.body.challenge),label:'Blocked'})).status).toBe(401);
    expect((await query('SELECT id FROM user_passkeys WHERE user_id=$1',[a.userId])).rows).toHaveLength(0);
  });
  it('password reset preserves keys and cannot create verified sessions',async()=>{
    const a=await account();await enroll(a);const reset=await requestPasswordReset(a.email);expect(reset).not.toBeNull();
    await resetPassword(reset!.token,'ChangedMfaPassword456!');
    expect((await get(a,'/me')).status).toBe(401);
    const login=await request(app).post('/auth/login').send({email:a.email,password:'ChangedMfaPassword456!'});
    expect(login.body.user.mfa).toMatchObject({enrolled:true,verified:false});
    expect((await get({...a,token:login.body.accessToken},'/organizations')).status).toBe(403);
  });
  it('forbids removing the last key or verified key and isolates ownership',async()=>{
    const a=await account(),key=await enroll(a),other=await account();await enroll(other);
    const remove=(who:Account,id:string)=>request(app).delete(`/auth/mfa/keys/${id}`).set('Authorization',`Bearer ${who.token}`);
    expect((await remove(a,key.id)).status).toBe(409);expect((await remove(other,key.id)).status).toBe(404);
    const backup=await enroll(a);expect((await remove(a,key.id)).status).toBe(204);
    expect((await query('SELECT revoked_at FROM user_passkeys WHERE id=$1',[key.id])).rows[0].revoked_at).not.toBeNull();
    expect((await verify(a,key,2)).status).toBe(403);expect((await verify(a,backup)).status).toBe(200);
  });
  it('consumes reviewed recovery approval after replacement enrollment',async()=>{
    const target=await account(),first=await account(),second=await account();await enroll(target);await enroll(first);await enroll(second);
    await approveRecovery(target.userId,[first.token,second.token],'SEC_REVIEW_2');
    const login=await request(app).post('/auth/login').send({email:target.email,password});
    const recovering={...target,token:login.body.accessToken};await enroll(recovering);
    expect((await get(recovering,'/organizations')).status).toBe(200);
    expect((await query('SELECT mfa_recovery_approved_until FROM users WHERE id=$1',[target.userId])).rows[0].mfa_recovery_approved_until).toBeNull();
  });
  it('reviewed recovery needs distinct fresh reviewers, revokes sessions/keys and expires',async()=>{
    const target=await account(),first=await account(),second=await account();await enroll(target);await enroll(first);await enroll(second);
    await expect(approveRecovery(target.userId,[first.token,first.token],'SEC_REVIEW_1')).rejects.toThrow();
    await approveRecovery(target.userId,[first.token,second.token],'SEC_REVIEW_1');
    expect((await get(target,'/me')).status).toBe(401);
    const login=await request(app).post('/auth/login').send({email:target.email,password});const recovering={...target,token:login.body.accessToken};
    await query("UPDATE users SET mfa_recovery_approved_until=NOW()-INTERVAL '1 second' WHERE id=$1",[target.userId]);
    expect((await post(recovering,'/auth/mfa/registration/options',{currentPassword:password})).body.code).toBe('MFA_RECOVERY_REQUIRED');
    expect((await query("SELECT metadata FROM audit_events WHERE entity_id=$1 AND action='mfa.recovery.approve'",[target.userId])).rows[0].metadata.secondReviewerUserId).toBe(second.userId);
  });
});
