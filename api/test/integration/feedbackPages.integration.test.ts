import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
import { authenticator } from '../../src/testing/webauthnFixture';

type Actor = { org: string; user: string; role: string; token: string };
let owner: Actor, other: Actor, denied: Actor, network: Actor;
let ordered: string[] = [];
async function actor(permissions = ['organization.admin']): Promise<Actor> {
  const tag = crypto.randomUUID();
  const org = (
    await query(
      "INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'exporter','GH','verified') RETURNING id",
      ['Feedback register ' + tag],
    )
  ).rows[0].id;
  const email = 'feedback-register-' + tag + '@integration.test';
  const user = (
    await query(
      'INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',
      [org, email, await bcrypt.hash('FeedbackRegister123!', 4), 'Feedback reader'],
    )
  ).rows[0].id;
  const role = (
    await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id', [
      'feedback-register-' + tag,
      permissions,
    ])
  ).rows[0].id;
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [user, role]);
  const login = await request(app)
    .post('/auth/login')
    .send({ email, password: 'FeedbackRegister123!' });
  expect(login.status, JSON.stringify(login.body)).toBe(200);
  const token = login.body.accessToken;
  if (
    permissions.some((permission) => ['*', 'organization.admin'].includes(permission)) ||
    permissions.includes('member.invite')
  ) {
    const options = await request(app)
      .post('/auth/mfa/registration/options')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'FeedbackRegister123!' });
    expect(options.status, JSON.stringify(options.body)).toBe(200);
    const key = authenticator();
    const enrolled = await request(app)
      .post('/auth/mfa/registration/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({
        response: key.registration(options.body.challenge),
        label: 'Feedback register key',
      });
    expect(enrolled.status, JSON.stringify(enrolled.body)).toBe(200);
  }
  return { org, user, role, token };
}
const get = (
  parameters: Record<string, string | undefined> = {},
  who = owner,
  path = '/pilot-feedback/page',
) => request(app).get(path).query(parameters).set('Authorization', `Bearer ${who.token}`);
beforeAll(async () => {
  owner = await actor();
  other = await actor();
  denied = await actor([]);
  network = await actor(['*']);
  const rows = (
    await query(
      `INSERT INTO pilot_feedback(user_id,organization_id,page,task,rating,comment)
    SELECT $1,$2,'feedback page','Complete trade',(g%5)+1,'Feedback note '||g FROM generate_series(1,1005) g RETURNING id`,
      [owner.user, owner.org],
    )
  ).rows;
  ordered = rows
    .map((row) => row.id)
    .sort()
    .reverse();
  await query("UPDATE pilot_feedback SET comment='Literal %_ note',rating=5 WHERE id=$1", [
    ordered[1004],
  ]);
  await query(
    "INSERT INTO pilot_feedback(user_id,organization_id,page,task,rating,comment) VALUES($1,$2,'foreign page','foreign task',1,'unrelated-private-feedback')",
    [other.user, other.org],
  );
});
afterAll(async () => {
  try {
    for (const who of [owner, other, denied, network])
      if (who) await query('DELETE FROM pilot_feedback WHERE organization_id=$1', [who.org]);
  } finally {
    await pool.end();
  }
});
describe('bounded pilot feedback pages and full authorized totals', () => {
  it('pages more than 1,000 records exactly once and caps legacy before hydration', async () => {
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const response = await get({ limit: '100', ...(cursor ? { cursor } : {}) });
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body.count).toBe(1005);
      expect(response.body.items.length).toBeLessThanOrEqual(100);
      expect(response.headers['cache-control']).toBe('no-store');
      ids.push(...response.body.items.map((row: { id: string }) => row.id));
      cursor = response.body.nextCursor || undefined;
    } while (cursor);
    expect(ids).toEqual(ordered);
    expect(new Set(ids).size).toBe(1005);
    const legacy = await get({}, owner, '/pilot-feedback');
    expect(legacy.status).toBe(422);
    expect(legacy.body.code).toBe('CATALOG_READ_LIMIT');
    const small = await get({}, other, '/pilot-feedback');
    expect(small.status).toBe(200);
    expect(small.body).toHaveLength(1);
  });
  it('applies literal search and exact rating before limiting, with independent full rating totals', async () => {
    const page = await get({ search: '%_', rating: '5', limit: '1' });
    expect(page.status, JSON.stringify(page.body)).toBe(200);
    expect(page.body.items.map((row: { id: string }) => row.id)).toEqual([ordered[1004]]);
    const ratingTotal = (
      await query(
        'SELECT COUNT(*)::int AS count FROM pilot_feedback WHERE organization_id=$1 AND rating=5',
        [owner.org],
      )
    ).rows[0].count;
    expect(page.body.count).toBe(ratingTotal);
    const miss = await get({ search: 'absent feedback entry', rating: '5' });
    expect(miss.status).toBe(200);
    expect(miss.body.items).toEqual([]);
    expect(miss.body.count).toBe(ratingTotal);
    for (const search of [
      'feedback page',
      'Complete trade',
      'Feedback reader',
      (await query('SELECT name FROM organizations WHERE id=$1', [owner.org])).rows[0].name,
    ]) {
      const result = await get({ search, limit: '1' });
      expect(result.status).toBe(200);
      expect(result.body.items).toHaveLength(1);
    }
    const total = await get({}, owner, '/pilot-feedback/summary');
    expect(total.status).toBe(200);
    expect(total.body.count).toBe(1005);
    expect(total.body.rating_5_count).toBe(ratingTotal);
    expect([1, 2, 3, 4, 5].reduce((sum, r) => sum + total.body[`rating_${r}_count`], 0)).toBe(1005);
  });
  it('returns only safe fields and isolates unrelated organization administrators', async () => {
    const page = await get({ limit: '1' });
    expect(page.status).toBe(200);
    expect(Object.keys(page.body.items[0]).sort()).toEqual(
      [
        'id',
        'page',
        'task',
        'rating',
        'comment',
        'created_at',
        'user_name',
        'organization_name',
      ].sort(),
    );
    const foreign = await get({ search: 'unrelated-private-feedback' });
    expect(foreign.status).toBe(200);
    expect(foreign.body.items).toEqual([]);
    const otherPage = await get({}, other);
    expect(otherPage.status).toBe(200);
    expect(otherPage.body.count).toBe(1);
    expect((await get({}, other, '/pilot-feedback/summary')).body.count).toBe(1);
    const shared = await get({ search: 'unrelated-private-feedback' }, network);
    expect(shared.status, JSON.stringify(shared.body)).toBe(200);
    expect(shared.body.items).toHaveLength(1);
    expect((await get({}, denied)).status).toBe(403);
    expect((await get({}, denied, '/pilot-feedback/summary')).status).toBe(403);
    expect((await request(app).get('/pilot-feedback/page')).status).toBe(401);
  });
  it('binds cursor to current organization, authorization and exact query filters', async () => {
    const first = await get({ limit: '1' });
    expect(first.status).toBe(200);
    const cursor = first.body.nextCursor;
    expect((await get({ cursor }, other)).status).toBe(400);
    expect((await get({ cursor, rating: '5' })).status).toBe(400);
    expect((await get({ cursor, search: 'changed' })).status).toBe(400);
    await query('UPDATE roles SET permissions=ARRAY[]::text[] WHERE id=$1', [owner.role]);
    try {
      expect((await get({ cursor })).status).toBe(403);
    } finally {
      await query("UPDATE roles SET permissions=ARRAY['organization.admin'] WHERE id=$1", [
        owner.role,
      ]);
    }
  });
  it('rejects malformed or duplicate page parameters and summary filters', async () => {
    for (const parameters of [
      { limit: '101' },
      { limit: '0' },
      { rating: '0' },
      { rating: '6' },
      { rating: '1.0' },
      { offset: '1' },
      { search: 'a'.repeat(81) },
      { cursor: 'bad' },
    ])
      expect((await get(parameters)).status, JSON.stringify(parameters)).toBe(400);
    expect(
      (
        await request(app)
          .get('/pilot-feedback/page?rating=1&rating=5')
          .set('Authorization', `Bearer ${owner.token}`)
      ).status,
    ).toBe(400);
    expect((await get({ rating: '5' }, owner, '/pilot-feedback/summary')).status).toBe(400);
    expect((await get({ search: 'changed' }, owner, '/pilot-feedback')).status).toBe(400);
  });
  it('preserves feedback creation attribution and reflects the new record in scoped totals', async () => {
    const response = await request(app)
      .post('/pilot-feedback')
      .set('Authorization', `Bearer ${other.token}`)
      .send({
        page: 'trade',
        task: 'Delivery acceptance',
        rating: 4,
        comment: 'Current user created feedback',
      });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    const row = (
      await query('SELECT user_id,organization_id FROM pilot_feedback WHERE id=$1', [
        response.body.id,
      ])
    ).rows[0];
    expect(row).toMatchObject({ user_id: other.user, organization_id: other.org });
    expect((await get({}, other, '/pilot-feedback/summary')).body).toMatchObject({
      count: 2,
      rating_1_count: 1,
      rating_4_count: 1,
    });
  });
});
