import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
import { authenticator } from '../../src/testing/webauthnFixture';
type Actor = { org: string; user: string; token: string };
let owner: Actor, foreign: Actor, network: Actor;
let organizationIds: string[] = [],
  memberIds: string[] = [];
const prefix = 'Organization pages ' + crypto.randomUUID();
async function actor(permissions: string[]): Promise<Actor> {
  const tag = crypto.randomUUID();
  const org = (
    await query(
      "INSERT INTO organizations(name,type,jurisdiction,verification_status,legal_registration_number) VALUES($1,'exporter','GH','verified','PRIVATE-REGISTRATION') RETURNING id",
      [prefix + ' actor ' + tag],
    )
  ).rows[0].id;
  const email = `organization-pages-${tag}@integration.test`;
  const user = (
    await query(
      'INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',
      [org, email, await bcrypt.hash('OrganizationPages123!', 4), 'Organization reader'],
    )
  ).rows[0].id;
  const role = (
    await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id', [
      `organization-pages-${tag}`,
      permissions,
    ])
  ).rows[0].id;
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [user, role]);
  const login = await request(app)
    .post('/auth/login')
    .send({ email, password: 'OrganizationPages123!' });
  expect(login.status, JSON.stringify(login.body)).toBe(200);
  const token = login.body.accessToken;
  const options = await request(app)
    .post('/auth/mfa/registration/options')
    .set('Authorization', `Bearer ${token}`)
    .send({ currentPassword: 'OrganizationPages123!' });
  expect(options.status, JSON.stringify(options.body)).toBe(200);
  const key = authenticator();
  const enrolled = await request(app)
    .post('/auth/mfa/registration/verify')
    .set('Authorization', `Bearer ${token}`)
    .send({
      response: key.registration(options.body.challenge),
      label: 'Organization pages test key',
    });
  expect(enrolled.status, JSON.stringify(enrolled.body)).toBe(200);
  return { org, user, token };
}
const get = (path: string, parameters: Record<string, string | undefined> = {}, who = owner) =>
  request(app).get(path).query(parameters).set('Authorization', `Bearer ${who.token}`);
async function success(
  path: string,
  parameters: Record<string, string | undefined> = {},
  who = owner,
) {
  const r = await get(path, parameters, who);
  expect(r.status, `${path}: ${JSON.stringify(r.body)}`).toBe(200);
  return r;
}
beforeAll(async () => {
  owner = await actor(['organization.admin']);
  foreign = await actor(['organization.admin']);
  network = await actor(['*']);
  organizationIds = (
    await query(
      "INSERT INTO organizations(name,type,jurisdiction,legal_registration_number) SELECT $1 || ' ' || n,'exporter','GH','PRIVATE-REGISTRATION' FROM generate_series(1,1005) n RETURNING id",
      [prefix],
    )
  ).rows
    .map((row) => String(row.id))
    .sort()
    .reverse();
  await query('UPDATE organizations SET name=$1 WHERE id=$2', [
    prefix + ' Literal %_',
    organizationIds[1004],
  ]);
  memberIds = (
    await query(
      "INSERT INTO users(organization_id,email,password_hash,name) SELECT $1,'organization-member-' || $2 || '-' || n || '@integration.test','NOT-A-LOGIN-PASSWORD','Member ' || n FROM generate_series(1,1004) n RETURNING id",
      [owner.org, crypto.randomUUID()],
    )
  ).rows.map((row) => String(row.id));
  memberIds.push(owner.user);
  memberIds.sort().reverse();
  const late = memberIds.find((id) => id !== owner.user && memberIds.indexOf(id) > 900)!;
  await query("UPDATE users SET name='Literal %_ member' WHERE id=$1", [late]);
});
afterAll(async () => {
  try {
    if (owner)
      await query('DELETE FROM users WHERE organization_id=$1 AND id<>$2', [owner.org, owner.user]);
    if (organizationIds.length)
      await query('DELETE FROM organizations WHERE id=ANY($1::uuid[])', [organizationIds]);
  } finally {
    await pool.end();
  }
});
describe('organization and member administrative boundaries', () => {
  it('rechecks current role permissions instead of trusting an issued administrative token', async () => {
    const role = (
      await query(
        'SELECT r.id,r.permissions FROM roles r JOIN user_roles ur ON ur.role_id=r.id WHERE ur.user_id=$1',
        [owner.user],
      )
    ).rows[0];
    try {
      await query('UPDATE roles SET permissions=ARRAY[]::text[] WHERE id=$1', [role.id]);
      for (const path of [
        '/organizations/page',
        '/organizations/summary',
        `/organizations/${owner.org}/members/page`,
        `/organizations/${owner.org}/members/summary`,
      ]) {
        expect((await get(path)).status).toBe(403);
      }
    } finally {
      await query('UPDATE roles SET permissions=$2 WHERE id=$1', [role.id, role.permissions]);
    }
  });

  it('tenant administrators only receive their own safe organization projection, including legacy reads', async () => {
    for (const who of [owner, foreign]) {
      const page = await success('/organizations/page', {}, who);
      expect(page.body.count).toBe(1);
      expect(page.body.items.map((r: { id: string }) => r.id)).toEqual([who.org]);
      expect(page.headers['cache-control']).toBe('no-store');
      expect(Object.keys(page.body.items[0]).sort()).toEqual([
        'created_at',
        'id',
        'jurisdiction',
        'name',
        'type',
        'verification_status',
      ]);
      expect(
        (await success('/organizations', {}, who)).body.map((r: { id: string }) => r.id),
      ).toEqual([who.org]);
      expect((await success('/organizations/summary', {}, who)).body.count).toBe(1);
      expect(
        (
          await get(
            `/organizations/${who === owner ? foreign.org : owner.org}/members/page`,
            {},
            who,
          )
        ).status,
      ).toBe(403);
    }
  });
  it('network administrators page and literally search all fixture organizations without private fields', async () => {
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await success(
        '/organizations/page',
        { search: prefix, limit: '100', ...(cursor ? { cursor } : {}) },
        network,
      );
      ids.push(...page.body.items.map((r: { id: string }) => r.id));
      expect(page.body.count).toBe(1008);
      cursor = page.body.nextCursor || undefined;
    } while (cursor);
    expect(ids).toEqual([...organizationIds, owner.org, foreign.org, network.org].sort().reverse());
    expect(new Set(ids).size).toBe(1008);
    const literal = await success('/organizations/page', { search: '%_', limit: '1' }, network);
    expect(literal.body.items.map((r: { id: string }) => r.id)).toEqual([organizationIds[1004]]);
    const legacy = await get('/organizations', {}, network);
    expect(legacy.status).toBe(422);
    expect(legacy.body.code).toBe('CATALOG_READ_LIMIT');
  });
  it('member pages hydrate only selected IDs, retain totals and return empty role arrays without secrets', async () => {
    const path = `/organizations/${owner.org}/members/page`;
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await success(path, { limit: '100', ...(cursor ? { cursor } : {}) });
      expect(page.body.count).toBe(1005);
      for (const row of page.body.items) {
        expect(Object.keys(row).sort()).toEqual([
          'active',
          'created_at',
          'email',
          'id',
          'mfa_enabled',
          'name',
          'roles',
        ]);
        expect(row.roles).not.toContain(null);
      }
      ids.push(...page.body.items.map((r: { id: string }) => r.id));
      cursor = page.body.nextCursor || undefined;
    } while (cursor);
    expect(ids).toEqual(memberIds);
    expect((await success(`/organizations/${owner.org}/members/summary`)).body.count).toBe(1005);
    const filtered = await success(path, { search: '%_', limit: '1' });
    expect(filtered.body.count).toBe(1);
    expect(filtered.body.items[0].name).toBe('Literal %_ member');
    expect(filtered.body.items[0].roles).toEqual([]);
    expect((await get(`/organizations/${owner.org}/members`)).status).toBe(422);
    expect(
      (await success(`/organizations/${foreign.org}/members/page`, {}, network)).body.items[0].id,
    ).toBe(foreign.user);
  });
  it('binds cursors to organization, selected members, permission and search while rejecting malformed parameters', async () => {
    const first = await success('/organizations/page', { limit: '1', search: prefix }, network);
    const cursor = first.body.nextCursor;
    expect((await get('/organizations/page', { cursor, search: 'changed' }, network)).status).toBe(
      400,
    );
    expect((await get('/organizations/page', { cursor, search: prefix }, owner)).status).toBe(400);
    const memberFirst = await success(
      `/organizations/${owner.org}/members/page`,
      { limit: '1' },
      network,
    );
    expect(
      (
        await get(
          `/organizations/${foreign.org}/members/page`,
          { cursor: memberFirst.body.nextCursor },
          network,
        )
      ).status,
    ).toBe(400);
    for (const parameters of [{ limit: '101' }, { search: 'x'.repeat(81) }, { unknown: 'x' }])
      expect((await get('/organizations/page', parameters)).status).toBe(400);
    expect((await get('/organizations/bad/members/page')).status).toBe(400);
  });
});
