import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
type Actor = { org: string; user: string; token: string };
const farms: string[] = [],
  batches: string[] = [];
let own: Actor, other: Actor;
let farm: string, batch: string;
async function actor(evidence = true): Promise<Actor> {
  const tag = crypto.randomUUID();
  const org = (
    await query(
      "INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'exporter','GH','verified') RETURNING id",
      ['Source detail ' + tag],
    )
  ).rows[0].id;
  const email = `detail-${tag}@integration.test`;
  const user = (
    await query(
      'INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',
      [org, email, await bcrypt.hash('DetailPages123!', 4), 'Detail tester'],
    )
  ).rows[0].id;
  const role = (
    await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id', [
      'detail-' + tag,
      ['farm.read', 'batch.read', ...(evidence ? ['evidence.read'] : [])],
    ])
  ).rows[0].id;
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [user, role]);
  const signed = await request(app)
    .post('/auth/login')
    .send({ email, password: 'DetailPages123!' });
  expect(signed.status).toBe(200);
  return { org, user, token: signed.body.accessToken };
}
async function seed(who: Actor, count: number) {
  const f = (
    await query(
      "INSERT INTO farms(farmer_organization_id,name,country,region,district) VALUES($1,'Detail source','GH','Northern','Tamale') RETURNING id",
      [who.org],
    )
  ).rows[0].id;
  farms.push(f);
  await query(
    "INSERT INTO farm_plots(farm_id,plot_code,area_hectares) SELECT $1,'PLOT-'||n,1 FROM generate_series(1,$2::int) n",
    [f, count],
  );
  const b = (
    await query(
      "INSERT INTO harvest_batches(farm_id,crop,harvest_date,quantity_kg,current_holder_id) VALUES($1,'cocoa','2026-01-01',10,$2) RETURNING id",
      [f, who.org],
    )
  ).rows[0].id;
  batches.push(b);
  await query(
    "INSERT INTO evidence_items(uploader_user_id,uploader_organization_id,type,file_name,sha256_hash,linked_entity_type,linked_entity_id,review_status) SELECT $1,$2,'source_proof','proof-'||n||'.pdf',repeat('a',64),'batch',$3,'pending' FROM generate_series(1,$4::int) n",
    [who.user, who.org, b, count],
  );
  return { f, b };
}
function get(path: string, parameters: Record<string, unknown> = {}, who = own) {
  return request(app).get(path).query(parameters).set('Authorization', `Bearer ${who.token}`);
}
beforeAll(async () => {
  own = await actor();
  other = await actor();
  const stock = await seed(own, 1005);
  farm = stock.f;
  batch = stock.b;
  await seed(other, 1);
});
afterAll(async () => {
  await query(
    "DELETE FROM evidence_items WHERE linked_entity_type='batch' AND linked_entity_id=ANY($1::uuid[])",
    [batches],
  );
  await query('DELETE FROM harvest_batches WHERE id=ANY($1::uuid[])', [batches]);
  await query('DELETE FROM farm_plots WHERE farm_id=ANY($1::uuid[])', [farms]);
  await query('DELETE FROM farms WHERE id=ANY($1::uuid[])', [farms]);
  await pool.end();
});
describe('source detail collections', () => {
  it('pages 1,005 plots and searches beyond page one under live farm access', async () => {
    const first = await get(`/farms/${farm}/plots/page`, { limit: '100' });
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(first.body.items).toHaveLength(100);
    const next = await get(`/farms/${farm}/plots/page`, {
      limit: '100',
      cursor: first.body.nextCursor,
    });
    expect(next.status).toBe(200);
    const ids = [...first.body.items, ...next.body.items].map((p: { id: string }) => p.id);
    expect(new Set(ids).size).toBe(200);
    const late = (
      await query(
        'SELECT id FROM farm_plots WHERE farm_id=$1 AND NOT(id=ANY($2::uuid[])) LIMIT 1',
        [farm, ids],
      )
    ).rows[0].id;
    expect(
      (await get(`/farms/${farm}/plots/page`, { search: late })).body.items.map(
        (p: { id: string }) => p.id,
      ),
    ).toEqual([late]);
    expect((await get(`/farms/${farm}/plots/summary`)).body.count).toBe(1005);
    expect((await get(`/farms/${farm}/plots/page`, {}, other)).status).toBe(403);
    expect(
      (
        await get(`/farms/${farm}/plots/page`, {
          search: 'different',
          cursor: first.body.nextCursor,
        })
      ).status,
    ).toBe(400);
    expect((await get(`/farms/${farm}/plots/page`, { search: '%' })).body.items).toEqual([]);
  });
  it('pages 1,005 safe evidence metadata rows and counts only an authorized entity', async () => {
    const parameters = { entityType: 'batch', entityId: batch };
    const first = await get('/evidence/page', { ...parameters, limit: '100' });
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(first.body.items).toHaveLength(100);
    const next = await get('/evidence/page', {
      ...parameters,
      limit: '100',
      cursor: first.body.nextCursor,
    });
    expect(next.status).toBe(200);
    const ids = [...first.body.items, ...next.body.items].map((r: { id: string }) => r.id);
    expect(new Set(ids).size).toBe(200);
    const late = (
      await query(
        "SELECT id FROM evidence_items WHERE linked_entity_type='batch' AND linked_entity_id=$1 AND NOT(id=ANY($2::uuid[])) LIMIT 1",
        [batch, ids],
      )
    ).rows[0].id;
    expect(
      (await get('/evidence/page', { ...parameters, search: late })).body.items.map(
        (r: { id: string }) => r.id,
      ),
    ).toEqual([late]);
    expect((await get('/evidence/summary', parameters)).body.count).toBe(1005);
    expect((await get('/evidence/summary', parameters, other)).status).toBe(403);
    for (const field of [
      'storage_key',
      'storage_path',
      'uploader_user_id',
      'uploader_organization_id',
      'downloadUrl',
    ])
      expect(first.body.items[0]).not.toHaveProperty(field);
  });
  it('omits paged detail arrays, refuses legacy overflow and keeps missing evidence permission distinct', async () => {
    const f = await get(`/farms/${farm}`, { plotMode: 'paged', certificateMode: 'paged' });
    expect(f.status).toBe(200);
    expect(f.body.plots).toBeNull();
    expect(f.body.plot_collection).toBe('paged');
    expect((await get(`/farms/${farm}`)).status).toBe(422);
    const b = await get(`/batches/${batch}`, { evidenceMode: 'paged' });
    expect(b.status).toBe(200);
    expect(b.body.evidence).toBeNull();
    expect(b.body.evidence_collection).toBe('paged');
    expect((await get(`/batches/${batch}`)).status).toBe(422);
    const restricted = await actor(false),
      stock = await seed(restricted, 1);
    const detail = await get(`/batches/${stock.b}`, {}, restricted);
    expect(detail.status).toBe(200);
    expect(detail.body.evidence).toBeNull();
    expect(detail.body.evidence_collection).toBe('unavailable');
    expect(
      (await get('/evidence/page', { entityType: 'batch', entityId: stock.b }, restricted)).status,
    ).toBe(403);
    expect((await get(`/batches/${batch}`, { evidenceMode: 'all' })).status).toBe(400);
    expect((await get(`/farms/${farm}`, { plotMode: 'all' })).status).toBe(400);
  });
  it('enforces query bounds and authorization on each cursor request', async () => {
    for (const input of [{ limit: '101' }, { search: 'x'.repeat(81) }, { unknown: 'x' }])
      expect((await get(`/farms/${farm}/plots/page`, input)).status).toBe(400);
    expect(
      (await get('/evidence/summary', { entityType: 'batch', entityId: batch, search: 'x' }))
        .status,
    ).toBe(400);
    const page = await get(`/farms/${farm}/plots/page`, { limit: '1' });
    await query('UPDATE farms SET farmer_organization_id=$1 WHERE id=$2', [other.org, farm]);
    expect((await get(`/farms/${farm}/plots/page`, { cursor: page.body.nextCursor })).status).toBe(
      403,
    );
    await query('UPDATE farms SET farmer_organization_id=$1 WHERE id=$2', [own.org, farm]);
    expect((await request(app).get(`/farms/${farm}/plots/page`)).status).toBe(401);
  });
});
