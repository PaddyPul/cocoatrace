import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
import { authenticator } from '../../src/testing/webauthnFixture';
import { auditRecordPage } from '../../src/modules/catalog/auditRecords';
import { withCatalogRead } from '../../src/modules/catalog/paging';
type Actor = { org: string; user: string; token: string; permissions: string[] };
let owner: Actor, other: Actor, network: Actor, exporter: Actor;
const entity = crypto.randomUUID(),
  foreign = crypto.randomUUID();
let ordered: string[] = [];
async function actor(permissions: string[]): Promise<Actor> {
  const tag = crypto.randomUUID();
  const org = (
    await query(
      "INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'exporter','GH','verified') RETURNING id",
      ['Audit register ' + tag],
    )
  ).rows[0].id;
  const email = 'audit-register-' + tag + '@integration.test';
  const user = (
    await query(
      'INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',
      [org, email, await bcrypt.hash('AuditRegister123!', 4), 'Audit reader'],
    )
  ).rows[0].id;
  const role = (
    await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id', [
      'audit-register-' + tag,
      permissions,
    ])
  ).rows[0].id;
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [user, role]);
  const login = await request(app)
    .post('/auth/login')
    .send({ email, password: 'AuditRegister123!' });
  expect(login.status, JSON.stringify(login.body)).toBe(200);
  const token = login.body.accessToken;
  if (permissions.some((p) => ['audit.read.all', 'audit.export.all'].includes(p))) {
    const options = await request(app)
      .post('/auth/mfa/registration/options')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'AuditRegister123!' });
    expect(options.status, JSON.stringify(options.body)).toBe(200);
    const key = authenticator();
    const enrolled = await request(app)
      .post('/auth/mfa/registration/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({
        response: key.registration(options.body.challenge),
        label: 'Audit register test key',
      });
    expect(enrolled.status, JSON.stringify(enrolled.body)).toBe(200);
  }
  return { org, user, token, permissions };
}
const get = (
  parameters: Record<string, string | undefined> = {},
  who = owner,
  path = '/audit/events/page',
) => request(app).get(path).query(parameters).set('Authorization', `Bearer ${who.token}`);
beforeAll(async () => {
  owner = await actor(['audit.read']);
  other = await actor(['audit.read']);
  network = await actor(['audit.read', 'audit.read.all']);
  exporter = await actor(['audit.read', 'audit.export.all', 'analytics.read.network']);
  const rows = (
    await query(
      `INSERT INTO audit_events(actor_user_id,actor_organization_id,action,entity_type,entity_id,occurred_at,reason,metadata,new_state_hash) SELECT $1,$2,'register.change','audit_fixture',$3,'2026-01-01T00:00:00.123456Z','Recorded audit reason',jsonb_build_object('secret','metadata-only-search'),'sha256:audit' FROM generate_series(1,1005) RETURNING id`,
      [owner.user, owner.org, entity],
    )
  ).rows;
  ordered = rows
    .map((r) => r.id)
    .sort()
    .reverse();
  await query("UPDATE audit_events SET reason='Literal %_ late reason' WHERE id=$1", [
    ordered[1004],
  ]);
  await query("UPDATE audit_events SET occurred_at='2026-01-01T00:00:00.123457Z' WHERE id=$1", [
    ordered[0],
  ]);
  await query(
    "INSERT INTO audit_events(actor_user_id,actor_organization_id,action,entity_type,entity_id,new_state_hash) VALUES($1,$2,'foreign.change','audit_fixture',$3,'sha256:foreign')",
    [other.user, other.org, foreign],
  );
});
afterAll(async () => {
  try {
    for (const who of [owner, other, network, exporter])
      if (who) await query('DELETE FROM audit_events WHERE actor_organization_id=$1', [who.org]);
  } finally {
    await pool.end();
  }
});
describe('audit register pagination and read boundaries', () => {
  it('pages over1,000 same-time rows exactly once and reports full scoped totals', async () => {
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const response = await get({
        entityType: 'audit_fixture',
        entityId: entity,
        limit: '100',
        ...(cursor ? { cursor } : {}),
      });
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body.count).toBe(1005);
      expect(response.body.items.length).toBeLessThanOrEqual(100);
      expect(response.headers['cache-control']).toBe('no-store');
      ids.push(...response.body.items.map((r: { id: string }) => r.id));
      cursor = response.body.nextCursor || undefined;
    } while (cursor);
    const first = await get({ limit: '1', entityId: entity });
    const next = await get({ limit: '1', entityId: entity, cursor: first.body.nextCursor });
    expect(next.status, JSON.stringify(next.body)).toBe(200);
    expect(next.body.items[0].id).toBe(ordered[1]);
    expect(ids).toEqual(ordered);
    expect(new Set(ids).size).toBe(1005);
    expect((await get({}, owner, '/audit/events')).body.code).toBe('CATALOG_READ_LIMIT');
  });
  it('uses literal search before limiting without searching or returning metadata', async () => {
    const response = await get({ limit: '1', search: '%_', entityId: entity });
    expect(response.status).toBe(200);
    expect(response.body.items.map((r: { id: string }) => r.id)).toEqual([ordered[1004]]);
    expect(response.body.count).toBe(1005);
    expect(JSON.stringify(response.body.items)).not.toContain('metadata');
    expect((await get({ search: 'metadata-only-search', entityId: entity })).body.items).toEqual(
      [],
    );
    const total = await get(
      { entityType: 'audit_fixture', entityId: entity },
      owner,
      '/audit/events/summary',
    );
    expect(total.status).toBe(200);
    expect(total.body.count).toBe(1005);
  });
  it('never substitutes export or analytics privileges for network read permission', async () => {
    for (const who of [owner, exporter]) {
      const response = await get({ entityId: foreign }, who);
      expect(response.status).toBe(200);
      expect(response.body.items).toEqual([]);
      expect(response.body.count).toBe(0);
    }
    const shared = await get({ entityId: foreign }, network);
    expect(shared.status).toBe(200);
    expect(shared.body.items[0].actor_organization_id).toBe(other.org);
    expect((await request(app).get('/audit/events/page')).status).toBe(401);
  });
  it('rejects cursors with changed organization, current permissions or filters', async () => {
    const first = await get({ limit: '1', entityId: entity });
    const cursor = first.body.nextCursor;
    expect((await get({ cursor, entityId: entity }, other)).status).toBe(400);
    expect((await get({ cursor, entityId: entity, search: 'different' })).status).toBe(400);
    expect((await get({ cursor, entityId: entity, action: 'other' })).status).toBe(400);
    await query(
      "UPDATE roles SET permissions=ARRAY['audit.read','audit.export'] WHERE id IN(SELECT role_id FROM user_roles WHERE user_id=$1)",
      [owner.user],
    );
    try {
      expect((await get({ cursor, entityId: entity })).status).toBe(400);
    } finally {
      await query(
        "UPDATE roles SET permissions=ARRAY['audit.read'] WHERE id IN(SELECT role_id FROM user_roles WHERE user_id=$1)",
        [owner.user],
      );
    }
  });
  it('legacy small reads stay complete and invalid or repeated parameters fail explicitly', async () => {
    const legacy = await get({ entityId: foreign }, other, '/audit/events');
    expect(legacy.status).toBe(200);
    expect(legacy.body).toHaveLength(1);
    for (const parameters of [
      { entityId: 'bad' },
      { entityType: 'bad type' },
      { offset: '0' },
      { limit: '101' },
      { sort: 'id' },
    ])
      expect((await get(parameters)).status).toBe(400);
    expect(
      (
        await request(app)
          .get('/audit/events/page?entityType=a&entityType=b')
          .set('Authorization', `Bearer ${owner.token}`)
      ).status,
    ).toBe(400);
    expect((await get({ offset: '0' }, owner, '/audit/events')).status).toBe(400);
  });
  it('production page selection retains a bounded limit and migration indexes are installed', async () => {
    const indexes = (
      await query(
        "SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='audit_events' AND indexname=ANY($1::text[])",
        [['audit_events_org_chronology', 'audit_events_chronology']],
      )
    ).rows;
    expect(indexes.map((row) => row.indexname).sort()).toEqual([
      'audit_events_chronology',
      'audit_events_org_chronology',
    ]);
    await query('ANALYZE audit_events');
    let checked = false;
    await withCatalogRead((execute) =>
      auditRecordPage(
        async (sql, parameters) => {
          if (sql.startsWith('WITH candidates AS MATERIALIZED')) {
            const explained = await execute(
              `EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${sql}`,
              parameters,
            );
            const plan = (explained.rows[0]['QUERY PLAN'] as { Plan: Record<string, unknown> }[])[0]
              .Plan;
            function nodes(node: Record<string, unknown>): Record<string, unknown>[] {
              return [node, ...((node.Plans || []) as Record<string, unknown>[]).flatMap(nodes)];
            }
            const limits = nodes(plan).filter((node) => node['Node Type'] === 'Limit');
            expect(limits.length).toBeGreaterThan(0);
            expect(limits.some((node) => Number(node['Actual Rows']) <= 101)).toBe(true);
            checked = true;
          }
          return execute(sql, parameters);
        },
        { organizationId: owner.org, permissions: owner.permissions },
        { limit: '100', entityId: entity },
      ),
    );
    expect(checked).toBe(true);
  });
});
