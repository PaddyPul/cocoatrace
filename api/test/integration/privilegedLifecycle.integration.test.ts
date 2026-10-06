import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import {afterAll,beforeEach,describe,expect,it} from 'vitest';
import app from '../../src/app';
import {pool,query} from '../../src/db';
import {createSession} from '../../src/services/authSessionService';
import {authenticator} from '../../src/testing/webauthnFixture';
import {decidePrivilegedAccess} from '../../src/modules/accessControls/privilegedLifecycle';
import {requestPasswordReset,resetPassword} from '../../src/services/passwordLifecycleService';
import {approveRecovery} from '../../src/modules/mfa/recovery';
const password='ReviewedLifecyclePassword123!';
type Account={id:string;organizationId:string;token:string;email:string;sessionId:string};
async function account(organizationId?:string,permissions=['*']):Promise<Account>{
  const suffix=crypto.randomUUID();
  const org=organizationId||(await query("INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'admin','GH','verified') RETURNING id",[`Review ${suffix}`])).rows[0].id;
  const email=`review-${suffix}@integration.test`;
  const user=(await query('INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',[org,email,await bcrypt.hash(password,4),'Review regression'])).rows[0];
  const role=(await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id',[`review-${suffix}`,permissions])).rows[0];
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)',[user.id,role.id]);
  const session=await createSession(user.id);
  const result={id:user.id,organizationId:org,token:session.token,email,sessionId:session.actor.sessionId};
  const options=await request(app).post('/auth/mfa/registration/options').set('Authorization',`Bearer ${result.token}`).send({currentPassword:password});
  expect(options.status).toBe(200);
  const key=authenticator();
  expect((await request(app).post('/auth/mfa/registration/verify').set('Authorization',`Bearer ${result.token}`).send({response:key.registration(options.body.challenge),label:'Lifecycle regression'})).status).toBe(200);
  return result;
}
let first:Account,second:Account,target:Account;
beforeEach(async()=>{await query('TRUNCATE auth_rate_limits');first=await account();second=await account();target=await account();});
afterAll(async()=>pool.end());
const decide=(action='suspend',kind='users',id=target.id,tokens=[first.token,second.token])=>decidePrivilegedAccess({kind,id,action,ticket:'SEC_LIFECYCLE_1',reason:'Independent reviewers confirmed the access decision',reviewerTokens:tokens});
const me=(a:Account)=>request(app).get('/me').set('Authorization',`Bearer ${a.token}`);
describe('reviewed privileged lifecycle, immediate revocation and continuity',()=>{
  it('requires independent fresh reviewers and never allows self-approval',async()=>{
    await expect(decide('suspend','users',target.id,[first.token,first.token])).rejects.toMatchObject({code:'REVIEWERS_REQUIRED'});
    await expect(decide('suspend','users',first.id)).rejects.toMatchObject({code:'REVIEWERS_REQUIRED'});
    await query("UPDATE sessions SET mfa_verified_at=NOW()-INTERVAL '6 minutes' WHERE id=$1",[second.sessionId]);
    await expect(decide()).rejects.toMatchObject({code:'REVIEWERS_REQUIRED'});
    expect((await me(target)).status).toBe(200);
  });
  it('rejects organization-admin reviewers and revoked or future-dated assurance',async()=>{
    const ordinary=await account(undefined,['organization.admin']);
    await expect(decide('suspend','users',target.id,[first.token,ordinary.token])).rejects.toMatchObject({code:'REVIEWERS_REQUIRED'});
    await query("UPDATE sessions SET mfa_verified_at=NOW()+INTERVAL '5 minutes' WHERE id=$1",[second.sessionId]);
    await expect(decide()).rejects.toMatchObject({code:'REVIEWERS_REQUIRED'});
    await query('UPDATE sessions SET mfa_verified_at=NOW(),revoked_at=NOW() WHERE id=$1',[second.sessionId]);
    await expect(decide()).rejects.toMatchObject({code:'REVIEWERS_REQUIRED'});
    expect((await me(target)).status).toBe(200);
  });
  it('suspends only the target and restores without reviving sessions or keys being replaced',async()=>{
    const oldKey=(await query('SELECT id FROM user_passkeys WHERE user_id=$1',[target.id])).rows[0].id;
    const secondSession=await createSession(target.id);
    expect((await decide()).revokedSessions).toBe(2);
    expect((await me(target)).status).toBe(401);
    expect((await request(app).get('/me').set('Authorization',`Bearer ${secondSession.token}`)).status).toBe(401);
    expect((await me(first)).status).toBe(200);
    await expect(createSession(target.id)).rejects.toThrow('unavailable');
    await decide('restore');
    expect((await me(target)).status).toBe(401);
    const login=await request(app).post('/auth/login').send({email:target.email,password});
    expect(login.status).toBe(200);
    expect(login.body.user.mfa).toMatchObject({required:true,enrolled:true,verified:false});
    expect((await query('SELECT revoked_at FROM user_passkeys WHERE id=$1',[oldKey])).rows[0].revoked_at).toBeNull();
  });
  it('protects the affected reviewers and keeps two distinct usable administrators',async()=>{
    await expect(decide('suspend','organizations',first.organizationId)).rejects.toMatchObject({code:'REVIEWER_TARGET_CONFLICT'});
    await expect(decide('deactivate','users',second.id)).rejects.toMatchObject({code:'REVIEWERS_REQUIRED'});
    expect((await me(first)).status).toBe(200);expect((await me(second)).status).toBe(200);
  });
  it('organization suspension revokes members/invitations and restoration preserves individual holds',async()=>{
    const peer=await account(target.organizationId);
    await decide('suspend','users',peer.id);
    const role=(await query("SELECT id FROM roles WHERE name='supplier_admin'")).rows[0];
    const invite=(await query("INSERT INTO user_invitations(organization_id,email,role_id,token_hash,invited_by_user_id,expires_at) VALUES($1,$2,$3,$4,$5,NOW()+INTERVAL '1 day') RETURNING id",[target.organizationId,`pending-${crypto.randomUUID()}@integration.test`,role.id,crypto.randomBytes(32).toString('hex'),target.id])).rows[0];
    await decide('suspend','organizations',target.organizationId);
    expect((await me(target)).status).toBe(401);
    await expect(decide('restore','users',peer.id)).rejects.toMatchObject({code:'ORGANIZATION_SUSPENDED'});
    await decide('restore','organizations',target.organizationId);
    await expect(createSession(peer.id)).rejects.toThrow('unavailable');
    expect((await query('SELECT revoked_at FROM user_invitations WHERE id=$1',[invite.id])).rows[0].revoked_at).not.toBeNull();
    expect((await me(target)).status).toBe(401);
  });
  it('deactivation invalidates reset links, keys, ceremonies and invitations without deleting records',async()=>{
    const reset=await requestPasswordReset(target.email);expect(reset).not.toBeNull();
    const role=(await query("SELECT id FROM roles WHERE name='supplier_admin'")).rows[0];
    const invite=(await query("INSERT INTO user_invitations(organization_id,email,role_id,token_hash,invited_by_user_id,expires_at) VALUES($1,$2,$3,$4,$5,NOW()+INTERVAL '1 day') RETURNING id",[target.organizationId,`deactivate-${crypto.randomUUID()}@integration.test`,role.id,crypto.randomBytes(32).toString('hex'),target.id])).rows[0];
    await request(app).post('/auth/mfa/authentication/options').set('Authorization',`Bearer ${target.token}`).send({});
    await decide('deactivate');
    expect((await query('SELECT active FROM users WHERE id=$1',[target.id])).rows[0].active).toBe(false);
    expect((await query('SELECT id FROM user_passkeys WHERE user_id=$1 AND revoked_at IS NULL',[target.id])).rows).toHaveLength(0);
    expect((await query('SELECT session_id FROM mfa_challenges WHERE user_id=$1',[target.id])).rows).toHaveLength(0);
    await expect(resetPassword(reset!.token,'ReplacementPassword456!')).rejects.toThrow('invalid');
    await expect(decide('restore')).rejects.toMatchObject({code:'ACCOUNT_DEACTIVATED'});
    expect((await query('SELECT revoked_at FROM user_invitations WHERE id=$1',[invite.id])).rows[0].revoked_at).not.toBeNull();
    expect((await request(app).post('/auth/login').send({email:target.email,password})).status).toBe(401);
  });
  it('concurrent identical decisions produce one mutation and one atomic audit',async()=>{
    const results=await Promise.all([decide(),decide()]);
    expect(results.filter(result=>result.changed)).toHaveLength(1);
    const events=(await query("SELECT metadata FROM audit_events WHERE entity_id=$1 AND action='access.reviewed.users.suspend'",[target.id])).rows;
    expect(events).toHaveLength(1);expect(events[0].metadata.secondReviewerUserId).toBe(second.id);
    const serialized=JSON.stringify(events);expect(serialized).not.toContain(first.token);expect(serialized).not.toContain(password);
  });
  it('serializes crossing approvals so two groups cannot disable each other concurrently',async()=>{
    const results=await Promise.allSettled([
      decide('suspend','users',first.id,[second.token,target.token]),
      decide('suspend','users',target.id,[first.token,second.token]),
    ]);
    expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
    expect(results.filter(result=>result.status==='rejected')).toHaveLength(1);
    expect((await me(second)).status).toBe(200);
    const active=(await query('SELECT id FROM users WHERE id=ANY($1::uuid[]) AND active AND access_suspended_at IS NULL',[[first.id,second.id,target.id]])).rows;
    expect(active).toHaveLength(2);
  });
  it('serializes session issuance so no session survives suspension',async()=>{
    await Promise.all([createSession(target.id).catch(()=>null),decide('suspend','organizations',target.organizationId)]);
    expect((await query('SELECT id FROM sessions WHERE user_id=$1 AND revoked_at IS NULL',[target.id])).rows).toHaveLength(0);
    await expect(createSession(target.id)).rejects.toThrow('unavailable');
  });
  it('recovery cannot reactivate a deactivated identity',async()=>{
    await decide('deactivate');await expect(approveRecovery(target.id,[first.token,second.token],'SEC_RECOVERY_REVIEW')).rejects.toMatchObject({code:'ACCOUNT_DEACTIVATED'});
    await expect(createSession(target.id)).rejects.toThrow('unavailable');
    expect((await query('SELECT active FROM users WHERE id=$1',[target.id])).rows[0].active).toBe(false);
  });
  it('rolls back access and revocations when audit insertion fails',async()=>{
    const name=`fail_review_${crypto.randomUUID().replaceAll('-','')}`;
    await query(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='access.reviewed.users.suspend' AND NEW.entity_id='${target.id}'::uuid THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$`);
    await query(`CREATE TRIGGER ${name} BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION ${name}()`);
    try{await expect(decide()).rejects.toThrow('synthetic audit failure');expect((await me(target)).status).toBe(200);}
    finally{await query(`DROP TRIGGER ${name} ON audit_events`);await query(`DROP FUNCTION ${name}()`);}
  });
  it('normal HTTP controls still cannot bypass two-reviewer protection',async()=>{
    const response=await request(app).post(`/admin/access-controls/users/${target.id}`).set('Authorization',`Bearer ${first.token}`).send({suspended:true,reason:'Attempted one-reviewer bypass',currentPassword:password});
    expect(response.status).toBe(409);expect(response.body.code).toBe('PRIVILEGED_ACCESS_PROTECTED');
    expect((await me(target)).status).toBe(200);
  });
});
