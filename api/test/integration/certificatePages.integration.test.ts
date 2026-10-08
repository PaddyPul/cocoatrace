import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { certificatePage } from '../../src/modules/catalog/certificates';
import { withCatalogRead } from '../../src/modules/catalog/paging';
import { pool, query } from '../../src/db';
type Actor = { org: string; token: string };
const orgs: string[] = [];
let owner: Actor, other: Actor, reviewer: Actor;
let farm: string, foreignFarm: string;
async function actor(all = false): Promise<Actor> {
  const unique = crypto.randomUUID();
  const org = (
    await query(
      "INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'exporter','GH','verified') RETURNING id",
      ['Certificates ' + unique],
    )
  ).rows[0].id;
  orgs.push(org);
  const email = `cert-${unique}@integration.test`;
  const user = (
    await query(
      'INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',
      [org, email, await bcrypt.hash('CertPages123!', 4), 'Certificate pages'],
    )
  ).rows[0].id;
  const role = (
    await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id', [
      'cert-' + unique,
      ['certificate.read', ...(all ? ['certificate.read.all'] : [])],
    ])
  ).rows[0].id;
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [user, role]);
  const login = await request(app).post('/auth/login').send({ email, password: 'CertPages123!' });
  expect(login.status).toBe(200);
  return { org, token: login.body.accessToken };
}
async function seed(who: Actor, count: number) {
  const f = (
    await query(
      "INSERT INTO farms(farmer_organization_id,name,country,region,district) VALUES($1,'Certificate farm','GH','Northern','Tamale') RETURNING id",
      [who.org],
    )
  ).rows[0].id;
  await query(
    `INSERT INTO organic_certificates(certifier_organization_id,farmer_organization_id,farm_id,standard,valid_from,valid_to,issuing_authority,accreditation_reference)
 SELECT $1,$1,$2,'CERT-'||n,'2026-01-01','2027-01-01','Test issuer','Test reference' FROM generate_series(1,$3::int) n`,
    [who.org, f, count],
  );
  return f;
}
function get(path: string, parameters: Record<string, unknown> = {}, who = owner) {
  return request(app).get(path).query(parameters).set('Authorization', `Bearer ${who.token}`);
}
beforeAll(async () => {
  owner = await actor();
  other = await actor();
  reviewer = await actor(true);
  farm = await seed(owner, 1005);
  foreignFarm = await seed(other, 1);
});
afterAll(async () => {
  await query('DELETE FROM organic_certificates WHERE farmer_organization_id=ANY($1::uuid[])', [
    orgs,
  ]);
  await query('DELETE FROM farms WHERE farmer_organization_id=ANY($1::uuid[])', [orgs]);
  await pool.end();
});
describe('certificate pages and full recorded-state counts', () => {
  it('pages over 1,000 visible records, searches off-page and refuses legacy overflow', async () => {
    const first = await get('/certificates/page', { limit: '100' });
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(first.body.items).toHaveLength(100);
    const next = await get('/certificates/page', { limit: '100', cursor: first.body.nextCursor });
    expect(next.status).toBe(200);
    const ids = [...first.body.items, ...next.body.items].map((r: { id: string }) => r.id);
    expect(new Set(ids).size).toBe(200);
    expect(ids).toEqual([...ids].sort());
    const outside = (
      await query(
        'SELECT id FROM organic_certificates WHERE farm_id=$1 AND NOT(id=ANY($2::uuid[])) LIMIT 1',
        [farm, ids],
      )
    ).rows[0].id;
    const found = await get('/certificates/page', { search: outside });
    expect(found.status).toBe(200);
    expect(found.body.items.map((r: { id: string }) => r.id)).toEqual([outside]);
    const total = await get('/certificates/summary');
    expect(total.status).toBe(200);
    expect(total.body).toMatchObject({ count: 1005, active_count: 1005 });
    await withCatalogRead(async (execute) => {
      const page = await certificatePage(
        async (sql, parameters) => {
          const plan = (await execute(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${sql}`, parameters))
            .rows[0]['QUERY PLAN'] as { Plan: Record<string, unknown> }[];
          expect(plan[0].Plan['Node Type']).toBe('Limit');
          expect(Number(plan[0].Plan['Actual Rows'])).toBeLessThanOrEqual(101);
          return execute(sql, parameters);
        },
        { organizationId: owner.org, permissions: ['certificate.read'] },
        { limit: '100' },
      );
      expect(page.items).toHaveLength(100);
    });
    expect((await get('/certificates')).status).toBe(422);
    expect((await get('/certificates', { farmId: foreignFarm })).body).toEqual([]);
  });
  it('isolates tenants, literal filters and cursor scope without widening detail access', async () => {
    expect((await get('/certificates/page', { farmId: farm }, other)).body.items).toEqual([]);
    expect((await get('/certificates/summary', {}, other)).body.count).toBe(1);
    expect((await get('/certificates/summary', {}, reviewer)).body.count).toBe(
      Number(
        (await query('SELECT COUNT(*)::int AS count FROM organic_certificates')).rows[0].count,
      ),
    );
    expect((await get('/certificates/page', { search: '%' })).body.items).toEqual([]);
    const page = await get('/certificates/page', { limit: '1' });
    expect(
      (await get('/certificates/page', { cursor: page.body.nextCursor, status: 'suspended' }))
        .status,
    ).toBe(400);
    expect((await get('/certificates/page', { cursor: page.body.nextCursor }, other)).status).toBe(
      400,
    );
    const id = page.body.items[0].id;
    expect((await get('/certificates/' + id, {}, other)).status).toBe(403);
    await query("UPDATE organic_certificates SET status='suspended' WHERE id=$1", [id]);
    const suspended = await get('/certificates/page', { status: 'suspended' });
    expect(suspended.status).toBe(200);
    expect(suspended.body.items.map((r: { id: string }) => r.id)).toEqual([id]);
    expect((await get('/certificates/summary')).body).toMatchObject({
      count: 1005,
      active_count: 1004,
      suspended_count: 1,
    });
  });
  it('enforces authentication and strict query bounds', async () => {
    expect((await request(app).get('/certificates/page')).status).toBe(401);
    for (const input of [
      { limit: '101' },
      { status: 'bad' },
      { farmId: 'bad' },
      { search: 'x'.repeat(81) },
      { unexpected: 'true' },
    ])
      expect((await get('/certificates/page', input)).status).toBe(400);
    expect((await get('/certificates/summary', { search: 'anything' })).status).toBe(400);
  });
});
