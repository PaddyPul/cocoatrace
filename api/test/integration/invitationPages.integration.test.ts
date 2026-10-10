import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
import { authenticator } from '../../src/testing/webauthnFixture';

type Actor = { org: string; user: string; role: string; token: string };
let owner: Actor, other: Actor, states: Actor, denied: Actor, network: Actor;
let ordered: string[] = [];
const stateIds: Record<string, string> = {};
async function actor(permissions = ['member.invite']): Promise<Actor> {
  const tag = crypto.randomUUID();
  const org = (
    await query(
      "INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'exporter','GH','verified') RETURNING id",
      ['Invitation register ' + tag],
    )
  ).rows[0].id;
  const email = 'invitation-register-' + tag + '@integration.test';
  const user = (
    await query(
      'INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',
      [org, email, await bcrypt.hash('InvitationRegister123!', 4), 'Invitation reader'],
    )
  ).rows[0].id;
  const role = (
    await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id', [
      'invitation-register-' + tag,
      permissions,
    ])
  ).rows[0].id;
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [user, role]);
  const login = await request(app)
    .post('/auth/login')
    .send({ email, password: 'InvitationRegister123!' });
  expect(login.status, JSON.stringify(login.body)).toBe(200);
  const token = login.body.accessToken;
  if (permissions.includes('*') || permissions.includes('member.invite')) {
    const options = await request(app)
      .post('/auth/mfa/registration/options')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'InvitationRegister123!' });
    expect(options.status, JSON.stringify(options.body)).toBe(200);
    const key = authenticator();
    const enrolled = await request(app)
      .post('/auth/mfa/registration/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({
        response: key.registration(options.body.challenge),
        label: 'Invitation register key',
      });
    expect(enrolled.status, JSON.stringify(enrolled.body)).toBe(200);
  }
  return { org, user, role, token };
}
const get = (
  parameters: Record<string, string | undefined> = {},
  who = owner,
  path = '/invitations/page',
) => request(app).get(path).query(parameters).set('Authorization', `Bearer ${who.token}`);
const post = (id: string, action: 'resend' | 'revoke', who = states) =>
  request(app).post(`/invitations/${id}/${action}`).set('Authorization', `Bearer ${who.token}`);
async function invite(who: Actor, status = 'pending'): Promise<string> {
  const id = crypto.randomUUID();
  await query(
    `INSERT INTO user_invitations(id,organization_id,email,role_id,token_hash,invited_by_user_id,expires_at,accepted_at,revoked_at)
    VALUES($1,$2,$3,$4,$5,$6,CASE WHEN $7 IN ('expired','accepted','revoked') THEN NOW()-INTERVAL '1 day' ELSE NOW()+INTERVAL '1 day' END,
    CASE WHEN $7 IN ('accepted','revoked') THEN NOW() ELSE NULL END, CASE WHEN $7='revoked' THEN NOW() ELSE NULL END)`,
    [
      id,
      who.org,
      'fixture-' + id + '@integration.test',
      who.role,
      crypto.randomBytes(32).toString('hex'),
      who.user,
      status,
    ],
  );
  return id;
}
beforeAll(async () => {
  owner = await actor();
  other = await actor();
  states = await actor();
  denied = await actor([]);
  network = await actor(['*']);
  const rows = (
    await query(
      `INSERT INTO user_invitations(organization_id,email,role_id,token_hash,invited_by_user_id,expires_at)
    SELECT $1,'page-'||g||'-'||$4||'@integration.test',$2,md5($4||'-'||g),$3,NOW()+INTERVAL '1 day' FROM generate_series(1,1005) g RETURNING id`,
      [owner.org, owner.role, owner.user, crypto.randomUUID()],
    )
  ).rows;
  ordered = rows
    .map((row) => row.id)
    .sort()
    .reverse();
  await query('UPDATE user_invitations SET email=$2 WHERE id=$1', [
    ordered[1004],
    'literal-%_-' + crypto.randomUUID() + '@integration.test',
  ]);
  await invite(other);
  for (const status of ['pending', 'accepted', 'expired', 'revoked'])
    stateIds[status] = await invite(states, status);
});
afterAll(async () => {
  try {
    for (const who of [owner, other, states, denied, network].filter(Boolean)) {
      await query('DELETE FROM user_invitations WHERE organization_id=$1', [who.org]);
    }
  } finally {
    await pool.end();
  }
});
describe('bounded invitation register and current workspace authorization', () => {
  it('pages over 1,000 invitations exactly once with full scoped totals and no secret fields', async () => {
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const response = await get({ limit: '100', ...(cursor ? { cursor } : {}) });
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body.count).toBe(1005);
      expect(response.body.items.length).toBeLessThanOrEqual(100);
      expect(response.headers['cache-control']).toBe('no-store');
      for (const row of response.body.items) {
        expect(row).not.toHaveProperty('token_hash');
        expect(row).not.toHaveProperty('token');
        expect(row).not.toHaveProperty('invited_by_user_id');
      }
      ids.push(...response.body.items.map((row: { id: string }) => row.id));
      cursor = response.body.nextCursor || undefined;
    } while (cursor);
    expect(ids).toEqual(ordered);
    expect(new Set(ids).size).toBe(1005);
    const legacy = await get({}, owner, '/invitations');
    expect(legacy.status).toBe(422);
    expect(legacy.body.code).toBe('CATALOG_READ_LIMIT');
    const total = await get({}, owner, '/invitations/summary');
    expect(total.status).toBe(200);
    expect(total.body).toMatchObject({
      count: 1005,
      pending_count: 1005,
      accepted_count: 0,
      revoked_count: 0,
      expired_count: 0,
    });
  });
  it('searches literally before limiting and preserves totals independent of search and page', async () => {
    const literal = await get({ limit: '1', search: '%_' });
    expect(literal.status).toBe(200);
    expect(literal.body.items.map((row: { id: string }) => row.id)).toEqual([ordered[1004]]);
    expect(literal.body.count).toBe(1005);
    const organization = (await query('SELECT name FROM organizations WHERE id=$1', [owner.org]))
      .rows[0].name;
    expect((await get({ search: organization, limit: '1' })).body.items).toHaveLength(1);
    const roleName = (await query('SELECT name FROM roles WHERE id=$1', [owner.role])).rows[0].name;
    expect((await get({ search: roleName, limit: '1' })).body.items).toHaveLength(1);
    const missing = await get({ search: 'not-present-in-this-register' });
    expect(missing.status).toBe(200);
    expect(missing.body.items).toEqual([]);
    expect(missing.body.count).toBe(1005);
  });
  it('uses revoked then accepted then expired state priority consistently in pages and summary', async () => {
    const total = await get({}, states, '/invitations/summary');
    expect(total.status).toBe(200);
    expect(total.body).toMatchObject({
      count: 4,
      pending_count: 1,
      accepted_count: 1,
      revoked_count: 1,
      expired_count: 1,
    });
    for (const status of ['pending', 'accepted', 'expired', 'revoked']) {
      const result = await get({ status }, states);
      expect(result.status, JSON.stringify(result.body)).toBe(200);
      expect(result.body.count).toBe(1);
      expect(result.body.items.map((row: { id: string }) => row.id)).toEqual([stateIds[status]]);
    }
    const legacy = await get({}, states, '/invitations');
    expect(legacy.status).toBe(200);
    expect(legacy.body).toHaveLength(4);
  });
  it('isolates unrelated tenants and binds cursors to scope, filters and current permission', async () => {
    const own = await get({ limit: '1' });
    const cursor = own.body.nextCursor;
    expect((await get({ cursor, limit: '1' }, other)).status).toBe(400);
    expect((await get({ cursor, search: 'changed' })).status).toBe(400);
    expect((await get({ cursor, status: 'accepted' })).status).toBe(400);
    expect((await get({}, denied)).status).toBe(403);
    expect((await get({}, denied, '/invitations/summary')).status).toBe(403);
    expect((await request(app).get('/invitations/page')).status).toBe(401);
    const foreign = await get({}, other);
    expect(foreign.status).toBe(200);
    expect(foreign.body.count).toBe(1);
    expect(foreign.body.items.some((row: { id: string }) => ordered.includes(row.id))).toBe(false);
    expect((await get({}, other, '/invitations/summary')).body.count).toBe(1);
    const global = await get({ search: 'literal-%_' }, network);
    expect(global.status, JSON.stringify(global.body)).toBe(200);
    expect(global.body.items.map((row: { id: string }) => row.id)).toContain(ordered[1004]);
    await query('UPDATE roles SET permissions=ARRAY[]::text[] WHERE id=$1', [owner.role]);
    try {
      expect((await get({ cursor })).status).toBe(403);
    } finally {
      await query("UPDATE roles SET permissions=ARRAY['member.invite'] WHERE id=$1", [owner.role]);
    }
  });
  it('rejects malformed or repeated query values without silently widening scope', async () => {
    for (const parameters of [
      { limit: '101' },
      { limit: '0' },
      { cursor: 'not-a-cursor' },
      { status: 'invalid' },
      { offset: '0' },
      { search: 'a'.repeat(81) },
    ])
      expect((await get(parameters)).status, JSON.stringify(parameters)).toBe(400);
    expect(
      (
        await request(app)
          .get('/invitations/page?status=pending&status=accepted')
          .set('Authorization', `Bearer ${owner.token}`)
      ).status,
    ).toBe(400);
  });
  it('keeps resend and revoke tenant scoped and immediately reflects lifecycle changes in totals', async () => {
    const id = stateIds.expired;
    expect((await post(id, 'resend', other)).status).toBe(404);
    expect((await post(id, 'revoke', other)).status).toBe(404);
    const resent = await post(id, 'resend');
    expect(resent.status, JSON.stringify(resent.body)).toBe(200);
    expect((await get({ status: 'pending' }, states)).body.count).toBe(2);
    expect((await post(id, 'revoke')).status).toBe(204);
    expect((await post(id, 'resend')).status).toBe(404);
    expect((await get({ status: 'revoked' }, states)).body.count).toBe(2);
    expect((await get({}, states, '/invitations/summary')).body).toMatchObject({
      count: 4,
      pending_count: 1,
      accepted_count: 1,
      revoked_count: 2,
      expired_count: 0,
    });
  });
});
