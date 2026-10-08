import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
type Actor = { org: string; user: string; token: string };
let own: Actor, other: Actor;
const batches: string[] = [];
let late: string, holding: string, recall: string;
async function actor(): Promise<Actor> {
  const tag = crypto.randomUUID();
  const org = (
    await query(
      "INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'exporter','GH','verified') RETURNING id",
      ['Product pages ' + tag],
    )
  ).rows[0].id;
  const email = `products-${tag}@integration.test`;
  const user = (
    await query(
      'INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',
      [org, email, await bcrypt.hash('ProductPages123!', 4), 'Product reader'],
    )
  ).rows[0].id;
  const role = (
    await query("INSERT INTO roles(name,permissions) VALUES($1,ARRAY['batch.read']) RETURNING id", [
      'products-' + tag,
    ])
  ).rows[0].id;
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [user, role]);
  const login = await request(app)
    .post('/auth/login')
    .send({ email, password: 'ProductPages123!' });
  expect(login.status).toBe(200);
  return { org, user, token: login.body.accessToken };
}
async function seed(who: Actor, count: number) {
  const rows = (
    await query(
      "INSERT INTO harvest_batches(crop,harvest_date,quantity_kg,current_holder_id,source_mode,source_country,source_region) SELECT 'peanut','2026-01-01',10,$1,'direct_inventory','GH','Northern' FROM generate_series(1,$2::int) RETURNING id",
      [who.org, count],
    )
  ).rows;
  const ids = rows.map((row) => row.id);
  batches.push(...ids);
  await query(
    "INSERT INTO product_profiles(batch_id,slug,display_name,lot_code,visibility) SELECT id,'pages-'||id,'Product '||id,'PP-'||id,'published' FROM harvest_batches WHERE id=ANY($1::uuid[])",
    [ids],
  );
  return ids;
}
function get(path: string, parameters: Record<string, unknown> = {}, who = own) {
  return request(app).get(path).query(parameters).set('Authorization', `Bearer ${who.token}`);
}
beforeAll(async () => {
  own = await actor();
  other = await actor();
  await seed(own, 1005);
  await seed(other, 1);
  late = (
    await query(
      'SELECT pp.id FROM product_profiles pp JOIN harvest_batches b ON b.id=pp.batch_id WHERE b.current_holder_id=$1 ORDER BY pp.id DESC LIMIT 1',
      [own.org],
    )
  ).rows[0].id;
});
afterAll(async () => {
  if (recall) await query('DELETE FROM recall_notices WHERE id=$1', [recall]);
  if (holding) await query('DELETE FROM batch_holdings WHERE id=$1', [holding]);
  await query(
    "DELETE FROM evidence_items WHERE linked_entity_type='batch' AND linked_entity_id=ANY($1::uuid[])",
    [batches],
  );
  await query('DELETE FROM product_profiles WHERE batch_id=ANY($1::uuid[])', [batches]);
  await query('DELETE FROM harvest_batches WHERE id=ANY($1::uuid[])', [batches]);
  await pool.end();
});
describe('product register pages and safety totals', () => {
  it('pages over 1,000 records, searches before limits and keeps full totals and tenant isolation', async () => {
    const first = await get('/product-profiles/page', { limit: '100' });
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(first.body.items).toHaveLength(100);
    const next = await get('/product-profiles/page', {
      limit: '100',
      cursor: first.body.nextCursor,
    });
    expect(next.status).toBe(200);
    expect(
      new Set([...first.body.items, ...next.body.items].map((row: { id: string }) => row.id)).size,
    ).toBe(200);
    const found = await get('/product-profiles/page', { search: late });
    expect(found.status).toBe(200);
    expect(found.body.items.map((row: { id: string }) => row.id)).toEqual([late]);
    const source = found.body.items[0].batch_id;
    await query(
      "INSERT INTO evidence_items(uploader_user_id,uploader_organization_id,type,file_name,sha256_hash,linked_entity_type,linked_entity_id,review_status) SELECT $1,$2,'source_proof','proof-'||n||'.pdf',repeat('a',64),'batch',$3,CASE WHEN n=1 THEN 'approved' ELSE 'pending' END FROM generate_series(1,2) n",
      [own.user, own.org, source],
    );
    const metadata = await get('/product-profiles/page', { search: late });
    expect(metadata.status).toBe(200);
    expect(metadata.body.items[0].evidence_count).toBe(2);
    expect(metadata.body.items[0].organic_claim_status).not.toBe('attested');

    expect((await get('/product-profiles/page', { search: '%_' })).body.items).toEqual([]);
    const totals = await get('/product-profiles/summary');
    expect(totals.status).toBe(200);
    expect(totals.body).toEqual({ count: 1005, published_count: 1005, held_count: 0 });
    expect((await get('/product-profiles/summary', {}, other)).body.count).toBe(1);
    expect((await get('/product-profiles/page', { search: late }, other)).body.items).toEqual([]);
    expect(
      (await get('/product-profiles/page', { cursor: first.body.nextCursor }, other)).status,
    ).toBe(400);
    expect((await get('/product-profiles')).status).toBe(422);
  });
  it('filters visibility and does not erase a retained hold on a resolved notice', async () => {
    const batch = (await query('SELECT batch_id FROM product_profiles WHERE id=$1', [late])).rows[0]
      .batch_id;
    holding = (
      await query(
        "INSERT INTO batch_holdings(batch_id,holder_organization_id,quantity_kg,status) VALUES($1,$2,10,'available') RETURNING id",
        [batch, own.org],
      )
    ).rows[0].id;
    recall = (
      await query(
        "INSERT INTO recall_notices(reference_code,title,reason,instructions,severity,status,initiated_by_user_id,initiated_by_organization_id) VALUES($1,'Retained hold','Test only','Hold stock','critical','resolved',$2,$3) RETURNING id",
        ['PP-' + crypto.randomUUID(), own.user, own.org],
      )
    ).rows[0].id;
    await query(
      "INSERT INTO recall_safety_holds(recall_id,entity_type,entity_id) VALUES($1,'holding',$2)",
      [recall, holding],
    );
    await query('INSERT INTO recall_affected_batches(recall_id,batch_id) VALUES($1,$2)', [
      recall,
      batch,
    ]);
    await query("UPDATE recall_notices SET status='active' WHERE id=$1", [recall]);
    const active = await get('/product-profiles/page', { search: late });
    expect(active.status).toBe(200);
    expect(active.body.items[0].safety_status).toBe('critical');
    await query("UPDATE recall_notices SET status='resolved' WHERE id=$1", [recall]);
    await query("UPDATE product_profiles SET visibility='draft' WHERE id=$1", [late]);
    const attention = await get('/product-profiles/page', { visibility: 'attention' });
    expect(attention.status, JSON.stringify(attention.body)).toBe(200);
    expect(attention.body.items).toHaveLength(1);
    expect(attention.body.items[0]).toMatchObject({
      id: late,
      inventory_held: true,
      safety_status: 'warning',
    });
    expect(
      (await get('/product-profiles/page', { visibility: 'published', search: late })).body.items,
    ).toEqual([]);
    expect((await get('/product-profiles/summary')).body).toEqual({
      count: 1005,
      published_count: 1004,
      held_count: 1,
    });
  });
  it('validates parameters, current permissions and stale filter cursors', async () => {
    for (const input of [
      { limit: '101' },
      { visibility: 'invalid' },
      { search: 'x'.repeat(81) },
      { all: 'true' },
    ])
      expect((await get('/product-profiles/page', input)).status).toBe(400);
    const first = await get('/product-profiles/page', { limit: '1' });
    expect(
      (await get('/product-profiles/page', { visibility: 'draft', cursor: first.body.nextCursor }))
        .status,
    ).toBe(400);
    expect((await get('/product-profiles/summary', { search: 'x' })).status).toBe(400);
    expect((await request(app).get('/product-profiles/page')).status).toBe(401);
    await query(
      "UPDATE roles r SET permissions=ARRAY['analytics.read.network'] FROM user_roles ur WHERE ur.role_id=r.id AND ur.user_id=$1",
      [other.user],
    );
    expect((await get('/product-profiles/page', {}, other)).status).toBe(403);
  });
});
