import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';

type Actor = { org: string; user: string; token: string };
const actors: Actor[] = [];
let buyer: Actor, foreign: Actor, creator: Actor, responder: Actor;
let ordered: string[] = [];
let published: string, privateRequest: string, draftRequest: string, closedRequest: string;
let supplierOwn: string, supplierDraft: string;
async function actor(extraPermissions: string[]): Promise<Actor> {
  const suffix = crypto.randomUUID();
  const org = (
    await query(
      "INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'exporter','GH','verified') RETURNING id",
      [`Sourcing pages ${suffix}`],
    )
  ).rows[0].id;
  const email = `sourcing-pages-${suffix}@integration.test`;
  const user = (
    await query(
      'INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',
      [org, email, await bcrypt.hash('SourcingPages123!', 4), 'Sourcing pages reader'],
    )
  ).rows[0].id;
  const role = (
    await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id', [
      `sourcing-pages-${suffix}`,
      ['listing.read', ...extraPermissions],
    ])
  ).rows[0].id;
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [user, role]);
  const login = await request(app)
    .post('/auth/login')
    .send({ email, password: 'SourcingPages123!' });
  expect(login.status, JSON.stringify(login.body)).toBe(200);
  const result = { org, user, token: login.body.accessToken };
  actors.push(result);
  return result;
}
async function sourcing(who: Actor, title: string, status: string, visibility: string) {
  return (
    await query(
      `INSERT INTO sourcing_requests(buyer_organization_id,created_by_user_id,title,commodity,quantity_kg,delivery_location,status,visibility)
     VALUES($1,$2,$3,'peanut',35,'Accra',$4,$5) RETURNING id`,
      [who.org, who.user, title, status, visibility],
    )
  ).rows[0].id as string;
}
const get = (
  parameters: Record<string, string | undefined> = {},
  who = buyer,
  path = '/sourcing-requests/page',
) => request(app).get(path).query(parameters).set('Authorization', `Bearer ${who.token}`);
async function successful(
  parameters: Record<string, string | undefined> = {},
  who = buyer,
  path = '/sourcing-requests/page',
) {
  const response = await get(parameters, who, path);
  expect(
    response.status,
    `${path}: HTTP ${response.status}; code=${String(response.body.code || 'none')}`,
  ).toBe(200);
  return response;
}
beforeAll(async () => {
  buyer = await actor(['offer.create']);
  foreign = await actor(['offer.create']);
  creator = await actor(['listing.create']);
  responder = await actor(['offer.respond']);
  const rows = (
    await query(
      `INSERT INTO sourcing_requests(buyer_organization_id,created_by_user_id,title,commodity,quantity_kg,delivery_location,status,visibility)
     SELECT $1,$2,'Owned draft ' || n,'peanut',35,'Accra','draft','private' FROM generate_series(1,1005) n RETURNING id`,
      [buyer.org, buyer.user],
    )
  ).rows;
  ordered = rows
    .map((row) => String(row.id))
    .sort()
    .reverse();
  await query(
    "UPDATE sourcing_requests SET title='Literal %_ request',created_at=NOW()+INTERVAL '1 second' WHERE id=$1",
    [ordered[1004]],
  );
  published = await sourcing(foreign, 'Visible matched request', 'open', 'matched');
  privateRequest = await sourcing(foreign, 'Hidden private request', 'open', 'private');
  draftRequest = await sourcing(foreign, 'Hidden draft request', 'draft', 'matched');
  closedRequest = await sourcing(foreign, 'Hidden closed request', 'closed', 'matched');
  supplierOwn = await sourcing(creator, 'Supplier own private request', 'open', 'private');
  supplierDraft = await sourcing(creator, 'Newest supplier own draft', 'draft', 'private');
  await query(
    "UPDATE sourcing_requests SET created_at=CASE WHEN id=$1 THEN NOW()+INTERVAL '1 second' ELSE NOW()-INTERVAL '1 second' END WHERE id=ANY($2::uuid[])",
    [supplierDraft, [supplierOwn, supplierDraft]],
  );
});
afterAll(async () => {
  try {
    for (const who of actors) {
      await query('DELETE FROM sourcing_requests WHERE buyer_organization_id=$1', [who.org]);
    }
  } finally {
    await pool.end();
  }
});

describe('sourcing request pages and visible demand summaries', () => {
  it('pages all 1,005 owned drafts exactly once and retains full independent own totals', async () => {
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const response = await successful({ limit: '100', ...(cursor ? { cursor } : {}) });
      expect(response.body.items.length).toBeLessThanOrEqual(100);
      expect(
        response.body.items.every(
          (row: { buyer_organization_id: string }) => row.buyer_organization_id === buyer.org,
        ),
      ).toBe(true);
      expect(JSON.stringify(response.body.items)).not.toContain('created_by_user_id');
      ids.push(...response.body.items.map((row: { id: string }) => row.id));
      cursor = response.body.nextCursor || undefined;
    } while (cursor);
    expect(ids).toEqual(ordered);
    expect(new Set(ids).size).toBe(1005);
    const summary = await successful({}, buyer, '/sourcing-requests/summary');
    expect(summary.body).toMatchObject({
      own_count: 1005,
      open_count: 0,
      latest_open: null,
      latest_own_open: null,
    });
    expect(summary.body.latest_own.id).toBe(ordered[1004]);
  });
  it('searches literally before limiting and retrieves a chosen off-page request by exact ID', async () => {
    const filtered = await successful({ limit: '1', search: '%_' });
    expect(filtered.body.items.map((row: { id: string }) => row.id)).toEqual([ordered[1004]]);
    expect(filtered.body.hasMore).toBe(false);
    const direct = await successful({ id: ordered[1004], mine: 'true' });
    expect(direct.body.items.map((row: { id: string }) => row.id)).toEqual([ordered[1004]]);
    const summary = await successful({}, buyer, '/sourcing-requests/summary');
    expect(summary.body.own_count).toBe(1005);
    expect(summary.body.latest_own.id).toBe(ordered[1004]);
  });
  it('requires supplier capabilities for foreign open matched demand while keeping own private requests visible', async () => {
    expect((await successful({ id: published })).body.items).toEqual([]);
    for (const who of [creator, responder]) {
      expect(
        (await successful({ id: published }, who)).body.items.map((row: { id: string }) => row.id),
      ).toEqual([published]);
      for (const hidden of [privateRequest, draftRequest, closedRequest, ordered[1004]]) {
        expect((await successful({ id: hidden }, who)).body.items).toEqual([]);
      }
      expect((await successful({ id: published, mine: 'true' }, who)).body.items).toEqual([]);
    }
    expect(
      (await successful({ id: supplierOwn, mine: 'true' }, creator)).body.items.map(
        (row: { id: string }) => row.id,
      ),
    ).toEqual([supplierOwn]);
    const own = await successful({}, foreign);
    expect(own.body.items.map((row: { id: string }) => row.id).sort()).toEqual(
      [published, privateRequest, draftRequest, closedRequest].sort(),
    );
  });
  it('reports foreign visible demand independently from own requests and matches the latest authorized row', async () => {
    for (const who of [creator, responder]) {
      const expected = (
        await query(
          `SELECT COUNT(*)::int AS count FROM sourcing_requests WHERE buyer_organization_id<>$1 AND status='open' AND visibility='matched'`,
          [who.org],
        )
      ).rows[0].count;
      const latest = (
        await query(
          `SELECT id FROM sourcing_requests WHERE buyer_organization_id<>$1 AND status='open' AND visibility='matched' ORDER BY created_at DESC,id DESC LIMIT 1`,
          [who.org],
        )
      ).rows[0].id;
      await successful({ limit: '1', search: 'no matching request' }, who);
      const summary = await successful({}, who, '/sourcing-requests/summary');
      expect(summary.body.open_count).toBe(expected);
      expect(summary.body.latest_open.id).toBe(latest);
      expect(summary.body.own_count).toBe(who === creator ? 2 : 0);
      expect(summary.body.latest_own?.id ?? null).toBe(who === creator ? supplierDraft : null);
      expect(summary.body.latest_own_open?.id ?? null).toBe(who === creator ? supplierOwn : null);
      if (who === creator) {
        expect(summary.body.latest_own.status).toBe('draft');
        expect(summary.body.latest_own_open.status).toBe('open');
        expect(summary.body.latest_own_open.visibility).toBe('private');
      }
    }
  });
  it('binds cursors to organization, search and exact filters and rejects invalid limits and IDs', async () => {
    const first = await successful({ limit: '1' });
    const cursor = first.body.nextCursor;
    expect(typeof cursor).toBe('string');
    for (const changed of [{ search: 'changed' }, { mine: 'true' }, { id: ordered[1004] }]) {
      expect((await get({ cursor, ...changed })).status).toBe(400);
    }
    expect((await get({ cursor }, foreign)).status).toBe(400);
    for (const parameters of [
      { limit: '101' },
      { id: 'invalid' },
      { mine: 'yes' },
      { unknown: 'true' },
      { search: 'x'.repeat(81) },
    ]) {
      expect((await get(parameters)).status).toBe(400);
    }
  });
  it('fails an oversized legacy history explicitly and keeps small legacy results scoped', async () => {
    const oversized = await get({}, buyer, '/sourcing-requests');
    expect(oversized.status).toBe(422);
    expect(oversized.body.code).toBe('CATALOG_READ_LIMIT');
    const own = await successful({}, foreign, '/sourcing-requests');
    expect(own.body.map((row: { id: string }) => row.id).sort()).toEqual(
      [published, privateRequest, draftRequest, closedRequest].sort(),
    );
    const supplied = await successful({}, creator, '/sourcing-requests');
    const ids = supplied.body.map((row: { id: string }) => row.id);
    expect(ids).toContain(published);
    expect(ids).toContain(supplierOwn);
    expect(ids).toContain(supplierDraft);
    expect(ids).not.toContain(privateRequest);
    expect(ids).not.toContain(draftRequest);
    expect(ids).not.toContain(closedRequest);
    expect(ids).not.toContain(ordered[1004]);
  });
});
