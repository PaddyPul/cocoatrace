import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
import { createSession } from '../../src/services/authSessionService';
import { requestPasswordReset } from '../../src/services/passwordLifecycleService';
const password = 'SuspensionPassword123!';
type Account = { id: string; organizationId: string; email: string; token: string };
async function account(privileged = false, organizationId?: string): Promise<Account> {
  const suffix = crypto.randomUUID();
  const orgId = organizationId || (await query("INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'exporter','GH','verified') RETURNING id", [`Suspension ${suffix}`])).rows[0].id;
  const email = `suspension-${suffix}@integration.test`;
  const user = (await query('INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id', [orgId, email, await bcrypt.hash(password, 4), 'Suspension user'])).rows[0];
  if (privileged) {
    const role = (await query("INSERT INTO roles(name,permissions) VALUES($1,ARRAY['*']) RETURNING id", [`suspension-admin-${suffix}`])).rows[0];
    await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [user.id, role.id]);
  }
  return { id: user.id, organizationId: orgId, email, token: (await createSession(user.id)).token };
}
let admin: Account;
beforeEach(async () => { admin = await account(true); });
afterAll(async () => { await pool.end(); });
const me = (token: string) => request(app).get('/me').set('Authorization', `Bearer ${token}`);
const decide = (kind: string, id: string, suspended = true, who = admin, currentPassword = password) => request(app).post(`/admin/access-controls/${kind}/${id}`).set('Authorization', `Bearer ${who.token}`).send({ suspended, currentPassword, reason: 'Integration reviewed access decision' });

describe('audited suspension, revocation and safe restoration', () => {
  it('denies ordinary actors, bad reauthentication and malformed targets without mutation', async () => {
    const user = await account();
    expect((await decide('users', user.id, true, user)).status).toBe(403);
    expect((await decide('users', user.id, true, admin, 'incorrect')).status).toBe(403);
    expect((await decide('users', 'bad-id')).status).toBe(400);
    expect((await decide('injected-table', user.id)).status).toBe(400);
    expect((await me(user.token)).status).toBe(200);
    expect((await request(app).get('/admin/access-controls/organizations').set('Authorization', `Bearer ${user.token}`)).status).toBe(403);
  });
  it('protects the current and every other privileged organization', async () => {
    const otherAdmin = await account(true);
    expect((await decide('users', admin.id)).body.code).toBe('PRIVILEGED_ACCESS_PROTECTED');
    expect((await decide('organizations', otherAdmin.organizationId)).body.code).toBe('PRIVILEGED_ACCESS_PROTECTED');
    expect((await me(otherAdmin.token)).status).toBe(200);
  });
  it('suspends one member, revokes all their sessions, isolates peers and never revives old sessions', async () => {
    const user = await account(), peer = await account(false, user.organizationId);
    const second = await createSession(user.id);
    expect((await decide('users', user.id)).status).toBe(200);
    expect((await me(user.token)).status).toBe(401);
    expect((await me(second.token)).status).toBe(401);
    expect((await me(peer.token)).status).toBe(200);
    expect((await request(app).post('/auth/login').send({ email: user.email, password })).status).toBe(401);
    expect(await requestPasswordReset(user.email)).toBeNull();
    await expect(createSession(user.id)).rejects.toThrow('unavailable');
    expect((await decide('users', user.id, false)).status).toBe(200);
    expect((await me(user.token)).status).toBe(401);
    expect((await me((await createSession(user.id)).token)).status).toBe(200);
    const audit = (await query("SELECT metadata FROM audit_events WHERE entity_id=$1 AND action='access.users.suspend'", [user.id])).rows;
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit)).not.toContain(password);
    expect(audit[0].metadata.revokedSessions).toBe(2);
  });
  it('suspends every organization session, revokes invitations and restores only the organization flag', async () => {
    const user = await account(), peer = await account(false, user.organizationId);
    expect((await decide('users', peer.id)).status).toBe(200);
    const role = (await query("SELECT id FROM roles WHERE name='supplier_admin'")).rows[0];
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const invite = (await query('INSERT INTO user_invitations(organization_id,email,role_id,token_hash,invited_by_user_id,expires_at) VALUES($1,$2,$3,$4,$5,NOW()+INTERVAL \'1 day\') RETURNING id', [user.organizationId, `invite-${crypto.randomUUID()}@integration.test`, role.id, crypto.createHash('sha256').update(rawToken).digest('hex'), user.id])).rows[0];
    expect((await decide('organizations', user.organizationId)).status).toBe(200);
    expect((await me(user.token)).status).toBe(401);
    expect((await decide('users', peer.id, false)).status).toBe(409);
    expect((await request(app).post('/auth/login').send({ email: user.email, password })).status).toBe(403);
    expect((await decide('organizations', user.organizationId, false)).status).toBe(200);
    expect((await me(user.token)).status).toBe(401);
    await expect(createSession(peer.id)).rejects.toThrow('unavailable');
    expect((await query('SELECT revoked_at FROM user_invitations WHERE id=$1', [invite.id])).rows[0].revoked_at).not.toBeNull();
    expect((await request(app).post(`/auth/invitations/${rawToken}/accept`).send({ name: 'Blocked invite', password })).status).toBe(410);
    expect((await me((await createSession(user.id)).token)).status).toBe(200);
  });
  it('serializes retries into one decision and one audit', async () => {
    const user = await account();
    const responses = await Promise.all([decide('users', user.id), decide('users', user.id)]);
    expect(responses.map(r => r.status)).toEqual([200, 200]);
    expect(responses.filter(r => r.body.changed)).toHaveLength(1);
    expect((await query("SELECT id FROM audit_events WHERE entity_id=$1 AND action='access.users.suspend'", [user.id])).rows).toHaveLength(1);
  });
  it('serializes new sessions against suspension so no valid session survives the commit', async () => {
    const user = await account();
    const attempts = await Promise.all([createSession(user.id).catch(() => null), createSession(user.id).catch(() => null), decide('organizations', user.organizationId)]);
    expect((attempts[2] as { status: number }).status).toBe(200);
    expect((await query('SELECT id FROM sessions WHERE user_id=$1 AND revoked_at IS NULL', [user.id])).rows).toHaveLength(0);
    await expect(createSession(user.id)).rejects.toThrow('unavailable');
  });
  it('rolls back suspension and revocation if its audit cannot commit', async () => {
    const user = await account();
    const name = `fail_access_${crypto.randomUUID().replaceAll('-', '')}`;
    await query(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='access.users.suspend' AND NEW.entity_id='${user.id}'::uuid THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$`);
    await query(`CREATE TRIGGER ${name} BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION ${name}()`);
    try {
      expect((await decide('users', user.id)).status).toBe(500);
      expect((await me(user.token)).status).toBe(200);
      expect((await query('SELECT access_suspended_at FROM users WHERE id=$1', [user.id])).rows[0].access_suspended_at).toBeNull();
    } finally {
      await query(`DROP TRIGGER ${name} ON audit_events`); await query(`DROP FUNCTION ${name}()`);
    }
  });
});
