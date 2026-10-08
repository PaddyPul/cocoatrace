import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
type Actor = { org: string; user: string; token: string };
let issuer: Actor, recipient: Actor, outsider: Actor;
let late: string, foreign: string;
const notices: string[] = [],
  batches: string[] = [];
async function actor(): Promise<Actor> {
  const tag = crypto.randomUUID();
  const org = (
    await query(
      "INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'exporter','GH','verified') RETURNING id",
      ['Recall pages ' + tag],
    )
  ).rows[0].id;
  const email = `recall-pages-${tag}@integration.test`;
  const user = (
    await query(
      'INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',
      [org, email, await bcrypt.hash('RecallPages123!', 4), 'Recall reader'],
    )
  ).rows[0].id;
  const role = (
    await query(
      "INSERT INTO roles(name,permissions) VALUES($1,ARRAY['analytics.read.network']) RETURNING id",
      ['recall-pages-' + tag],
    )
  ).rows[0].id;
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [user, role]);
  const login = await request(app).post('/auth/login').send({ email, password: 'RecallPages123!' });
  expect(login.status).toBe(200);
  return { org, user, token: login.body.accessToken };
}
async function seed(who: Actor, count: number) {
  const rows = (
    await query(
      "INSERT INTO recall_notices(reference_code,title,reason,instructions,severity,status,initiated_by_user_id,initiated_by_organization_id) SELECT 'PAGE-'||gen_random_uuid(),'Notice '||n,'Test only','Hold suspect material','warning','active',$1,$2 FROM generate_series(1,$3::int) n RETURNING id",
      [who.user, who.org, count],
    )
  ).rows;
  const ids = rows.map((row) => row.id);
  notices.push(...ids);
  return ids;
}
function get(path: string, parameters: Record<string, unknown> = {}, who = issuer) {
  return request(app).get(path).query(parameters).set('Authorization', `Bearer ${who.token}`);
}
beforeAll(async () => {
  issuer = await actor();
  recipient = await actor();
  outsider = await actor();
  await seed(issuer, 1005);
  foreign = (await seed(outsider, 1))[0];
  late = (
    await query(
      'SELECT id FROM recall_notices WHERE initiated_by_organization_id=$1 ORDER BY id DESC LIMIT 1',
      [issuer.org],
    )
  ).rows[0].id;
  await query('INSERT INTO recall_participants(recall_id,organization_id) VALUES($1,$2)', [
    late,
    recipient.org,
  ]);
});
afterAll(async () => {
  try {
    await query('DELETE FROM recall_participants WHERE recall_id=ANY($1::uuid[])', [notices]);
    await query('DELETE FROM recall_affected_batches WHERE recall_id=ANY($1::uuid[])', [notices]);
    await query('DELETE FROM recall_notices WHERE id=ANY($1::uuid[])', [notices]);
    await query('DELETE FROM harvest_batches WHERE id=ANY($1::uuid[])', [batches]);
  } finally {
    await pool.end();
  }
});
describe('recall register pages and recipient boundaries', () => {
  it('pages 1,005 issuer notices with full totals, literal search and separate recipient scope', async () => {
    const first = await get('/recalls/page', { limit: '100' });
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(first.body.items).toHaveLength(100);
    const next = await get('/recalls/page', { limit: '100', cursor: first.body.nextCursor });
    expect(next.status).toBe(200);
    expect(
      new Set([...first.body.items, ...next.body.items].map((row: { id: string }) => row.id)).size,
    ).toBe(200);
    const found = await get('/recalls/page', { search: late });
    expect(found.status).toBe(200);
    expect(found.body.items.map((row: { id: string }) => row.id)).toEqual([late]);
    expect(found.body.items[0]).not.toHaveProperty('batch_ids');
    expect(found.body.items[0]).not.toHaveProperty('affected_lots');
    expect((await get('/recalls/page', { search: '%_' })).body.items).toEqual([]);
    expect((await get('/recalls/summary')).body).toEqual({ count: 1005, active_count: 1005 });
    expect((await get('/recalls/summary', {}, recipient)).body).toEqual({
      count: 1,
      active_count: 1,
    });
    expect(
      (await get('/recalls/page', {}, recipient)).body.items.map((row: { id: string }) => row.id),
    ).toEqual([late]);
    const response = await get(`/recalls/${late}/response`, {}, recipient);
    expect(response.status).toBe(200);
    expect(response.body.canManage).toBe(false);
    expect((await get('/recalls/page', { search: late }, outsider)).body.items).toEqual([]);
    expect((await get('/recalls/page', { cursor: first.body.nextCursor }, recipient)).status).toBe(
      400,
    );
    expect((await get('/recalls')).status).toBe(422);
  });
  it('counts linked scope without embedding arrays and preserves full totals across filters', async () => {
    const rows = (
      await query(
        "INSERT INTO harvest_batches(crop,harvest_date,quantity_kg,current_holder_id,source_mode) SELECT 'peanut','2026-01-01',10,$1,'direct_inventory' FROM generate_series(1,1005) RETURNING id",
        [issuer.org],
      )
    ).rows;
    batches.push(...rows.map((row) => row.id));
    await query(
      'INSERT INTO recall_affected_batches(recall_id,batch_id) SELECT $1,id FROM harvest_batches WHERE id=ANY($2::uuid[])',
      [late, batches],
    );
    await query("UPDATE recall_notices SET status='resolved',severity='critical' WHERE id=$1", [
      late,
    ]);
    const filtered = await get('/recalls/page', { status: 'resolved', severity: 'critical' });
    expect(filtered.status, JSON.stringify(filtered.body)).toBe(200);
    expect(filtered.body.items).toHaveLength(1);
    expect(filtered.body.items[0]).toMatchObject({
      id: late,
      batch_count: 1005,
      affected_lot_count: 0,
    });
    expect(filtered.body.items[0]).not.toHaveProperty('batch_ids');
    expect((await get('/recalls/summary')).body).toEqual({ count: 1005, active_count: 1004 });
    expect((await get('/recalls', {}, recipient)).status).toBe(422);
  });
  it('rechecks participant access and does not infer network access from analytics', async () => {
    const page = await get('/recalls/page', { limit: '1' }, recipient);
    expect(page.status).toBe(200);
    await query('DELETE FROM recall_participants WHERE recall_id=$1 AND organization_id=$2', [
      late,
      recipient.org,
    ]);
    expect((await get('/recalls/page', {}, recipient)).body.items).toEqual([]);
    expect((await get(`/recalls/${late}/response`, {}, recipient)).status).toBe(404);
    expect((await get('/recalls/page', { search: foreign })).body.items).toEqual([]);
    await query(
      "UPDATE roles r SET permissions=ARRAY['recall.manage.all'] FROM user_roles ur WHERE ur.role_id=r.id AND ur.user_id=$1",
      [recipient.user],
    );
    const network = await get('/recalls/page', { search: foreign }, recipient);
    expect(network.status).toBe(200);
    expect(network.body.items.map((row: { id: string }) => row.id)).toEqual([foreign]);
  });
  it('rejects malformed input, changed-filter cursors and anonymous reads', async () => {
    for (const parameters of [
      { limit: '101' },
      { status: 'invalid' },
      { severity: 'invalid' },
      { search: 'x'.repeat(81) },
      { all: 'true' },
    ])
      expect((await get('/recalls/page', parameters)).status).toBe(400);
    const first = await get('/recalls/page', { limit: '1' });
    expect(first.status).toBe(200);
    expect(
      (await get('/recalls/page', { status: 'active', cursor: first.body.nextCursor })).status,
    ).toBe(400);
    expect((await get('/recalls/summary', { search: 'x' })).status).toBe(400);
    expect((await request(app).get('/recalls/page')).status).toBe(401);
  });
});
