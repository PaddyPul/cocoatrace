import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
import { createSession } from '../../src/services/authSessionService';
import { authenticator } from '../../src/testing/webauthnFixture';
import { definitions } from '../../src/modules/teamMembers/policy';
const password = 'TeamPassword123!';
// globalSetup deliberately truncates every application table after migration,
// including roles. Seed only this suite's finite customer role fixtures.
const previousRoles = new Map<string, string[]>();
beforeAll(async () => {
  for (const [name, permissions] of Object.entries(definitions('importer'))) {
    const existing = (await query('SELECT permissions FROM roles WHERE name=$1', [name])).rows[0];
    if (existing) previousRoles.set(name, existing.permissions);
    await query(
      'INSERT INTO roles(name,permissions) VALUES($1,$2) ON CONFLICT(name) DO UPDATE SET permissions=EXCLUDED.permissions',
      [name, permissions],
    );
    const role = (await query('SELECT permissions FROM roles WHERE name=$1', [name])).rows[0];
    expect([...role.permissions].sort(), `Unexpected fixture role definition: ${name}`).toEqual(
      [...permissions].sort(),
    );
  }
});
const diagnostic = (response: { status: number; body: { code?: string; error?: string } }) =>
  `HTTP ${response.status}; code=${response.body.code || 'none'}; error=${response.body.error || 'none'}`;

async function account(role = 'buyer_admin', organizationId?: string) {
  const id =
    organizationId ||
    (
      await query(
        "INSERT INTO organizations(name,type,verification_status) VALUES($1,'importer','verified') RETURNING id",
        [`Team ${crypto.randomUUID()}`],
      )
    ).rows[0].id;
  const user = (
    await query(
      'INSERT INTO users(organization_id,name,email,password_hash) VALUES($1,$2,$3,$4) RETURNING id',
      [id, 'Team member', `${crypto.randomUUID()}@team.test`, await bcrypt.hash(password, 4)],
    )
  ).rows[0];
  const assigned = await query(
    'INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE name=$2 RETURNING role_id',
    [user.id, role],
  );
  expect(assigned.rowCount, `Fixture role missing: ${role}`).toBe(1);
  const token = (await createSession(user.id)).token;
  if (role.endsWith('_admin')) {
    const authorization = { Authorization: `Bearer ${token}` };
    const options = await request(app)
      .post('/auth/mfa/registration/options')
      .set(authorization)
      .send({ currentPassword: password });
    expect(options.status, diagnostic(options)).toBe(200);
    const key = authenticator();
    const verified = await request(app)
      .post('/auth/mfa/registration/verify')
      .set(authorization)
      .send({ response: key.registration(options.body.challenge), label: 'Team management test' });
    expect(verified.status, diagnostic(verified)).toBe(200);
  }
  return { id: user.id, organizationId: id, token };
}
afterAll(async () => {
  try {
    for (const [name, permissions] of previousRoles) {
      await query('UPDATE roles SET permissions=$1 WHERE name=$2', [permissions, name]);
    }
  } finally {
    await pool.end();
  }
});
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const body = { reason: 'Reviewed team membership decision', currentPassword: password };
describe('tenant team management', () => {
  it('lists bounded roles and isolates foreign members with nondisclosing 404', async () => {
    const actor = await account(),
      target = await account('buyer_member', actor.organizationId),
      foreign = await account();
    const page = await request(app).get('/team/members/page?limit=1').set(auth(actor.token));
    expect(page.status, diagnostic(page)).toBe(200);
    expect(page.body.rows).toHaveLength(1);
    expect(page.body.next).toBeTruthy();
    const roles = await request(app).get('/team/roles').set(auth(actor.token));
    expect(roles.body.rows.map((r: { name: string }) => r.name).sort()).toEqual([
      'buyer_admin',
      'buyer_member',
      'buyer_viewer',
    ]);
    expect(
      (
        await request(app)
          .post(`/team/members/${foreign.id}/deactivate`)
          .set(auth(actor.token))
          .send(body)
      ).status,
    ).toBe(404);
    expect((await request(app).get('/team/roles').set(auth(target.token))).status).toBe(403);
  });
  it('reauthenticates, forbids self changes and atomically revokes reduced member sessions', async () => {
    const actor = await account(),
      target = await account('buyer_member', actor.organizationId);
    expect(
      (
        await request(app)
          .patch(`/team/members/${actor.id}/role`)
          .set(auth(actor.token))
          .send({ ...body, role: 'buyer_viewer' })
      ).body.code,
    ).toBe('SELF_CHANGE_FORBIDDEN');
    expect(
      (
        await request(app)
          .patch(`/team/members/${target.id}/role`)
          .set(auth(actor.token))
          .send({ ...body, currentPassword: 'wrong', role: 'buyer_viewer' })
      ).status,
    ).toBe(403);
    const result = await request(app)
      .patch(`/team/members/${target.id}/role`)
      .set(auth(actor.token))
      .send({ ...body, role: 'buyer_viewer' });
    expect(result.status, diagnostic(result)).toBe(200);
    expect(result.body.revokedSessions).toBe(1);
    expect((await request(app).get('/me').set(auth(target.token))).status).toBe(401);
    expect(
      (
        await query(
          "SELECT id FROM audit_events WHERE entity_id=$1 AND action='team.member.role_changed'",
          [target.id],
        )
      ).rows,
    ).toHaveLength(1);
  });
  it('deactivates peers and rejects role escalation or a poisoned definition', async () => {
    const actor = await account(),
      target = await account('buyer_member', actor.organizationId);
    expect(
      (
        await request(app)
          .patch(`/team/members/${target.id}/role`)
          .set(auth(actor.token))
          .send({ ...body, role: 'admin' })
      ).body.code,
    ).toBe('ROLE_NOT_ASSIGNABLE');
    const original = (await query("SELECT permissions FROM roles WHERE name='buyer_viewer'"))
      .rows[0].permissions;
    try {
      await query("UPDATE roles SET permissions=ARRAY['*']::text[] WHERE name='buyer_viewer'");
      const poisoned = await request(app)
        .patch(`/team/members/${target.id}/role`)
        .set(auth(actor.token))
        .send({ ...body, role: 'buyer_viewer' });
      expect(poisoned.status, diagnostic(poisoned)).toBe(403);
      expect(poisoned.body.code).toBe('ROLE_NOT_ASSIGNABLE');
    } finally {
      await query("UPDATE roles SET permissions=$1 WHERE name='buyer_viewer'", [original]);
    }
    expect(
      (
        await request(app)
          .post(`/team/members/${target.id}/deactivate`)
          .set(auth(actor.token))
          .send(body)
      ).status,
    ).toBe(200);
    await expect(createSession(target.id)).rejects.toThrow();
  });
});

describe('team audit transaction boundary', () => {
  it('rolls back role assignment and revocation when audit insertion fails', async () => {
    const actor = await account();
    const target = await account('buyer_member', actor.organizationId);
    const name = `fail_team_${crypto.randomUUID().replaceAll('-', '')}`;
    await query(
      `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='team.member.role_changed' AND NEW.entity_id='${target.id}'::uuid THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$`,
    );
    await query(
      `CREATE TRIGGER ${name} BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION ${name}()`,
    );
    try {
      expect(
        (
          await request(app)
            .patch(`/team/members/${target.id}/role`)
            .set(auth(actor.token))
            .send({ ...body, role: 'buyer_viewer' })
        ).status,
      ).toBe(500);
      expect((await request(app).get('/me').set(auth(target.token))).status).toBe(200);
      expect(
        (
          await query(
            'SELECT r.name FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE user_id=$1',
            [target.id],
          )
        ).rows[0].name,
      ).toBe('buyer_member');
    } finally {
      await query(`DROP TRIGGER ${name} ON audit_events`);
      await query(`DROP FUNCTION ${name}()`);
    }
  });
  it('serializes simultaneous role changes without leaving a usable old session', async () => {
    const actor = await account(),
      target = await account('buyer_member', actor.organizationId);
    const responses = await Promise.all(
      [1, 2].map(() =>
        request(app)
          .patch(`/team/members/${target.id}/role`)
          .set(auth(actor.token))
          .send({ ...body, role: 'buyer_viewer' }),
      ),
    );
    expect(
      responses.map((r) => r.status),
      responses.map(diagnostic).join('; '),
    ).toEqual([200, 200]);
    expect(responses.filter((r) => r.body.changed)).toHaveLength(1);
    expect(
      (
        await query(
          "SELECT id FROM audit_events WHERE entity_id=$1 AND action='team.member.role_changed'",
          [target.id],
        )
      ).rows,
    ).toHaveLength(1);
    expect((await request(app).get('/me').set(auth(target.token))).status).toBe(401);
  });
});
