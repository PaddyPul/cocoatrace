import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
import { authenticator } from '../../src/testing/webauthnFixture';
type Actor = { org: string; user: string; token: string; role: string };
const prefix = 'Access application pages ' + crypto.randomUUID();
let reviewer: Actor, otherReviewer: Actor, tenant: Actor, unrelatedReader: Actor;
let ids: string[] = [];
let invitationId: string;
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
  return { org, user, token, role };
}
const get = (
  path = '/access-applications/page',
  parameters: Record<string, string | undefined> = {},
  who = reviewer,
) => request(app).get(path).query(parameters).set('Authorization', `Bearer ${who.token}`);
async function success(
  path = '/access-applications/page',
  parameters: Record<string, string | undefined> = {},
  who = reviewer,
) {
  const r = await get(path, parameters, who);
  expect(r.status, `${path}: HTTP ${r.status}; code=${String(r.body.code || 'none')}`).toBe(200);
  return r;
}
beforeAll(async () => {
  reviewer = await actor(['*']);
  otherReviewer = await actor(['*']);
  tenant = await actor(['organization.admin']);
  unrelatedReader = await actor(['audit.read.all', 'analytics.read.network']);
  invitationId = (
    await query(
      "INSERT INTO user_invitations(organization_id,email,role_id,token_hash,invited_by_user_id,expires_at) VALUES($1,$2,$3,$4,$5,NOW()+INTERVAL '1 day') RETURNING id",
      [
        reviewer.org,
        `access-pages-approved-${crypto.randomUUID()}@integration.test`,
        reviewer.role,
        crypto.randomBytes(32).toString('hex'),
        reviewer.user,
      ],
    )
  ).rows[0].id;
  ids = (
    await query(
      `INSERT INTO organization_access_applications(organization_name,organization_type,jurisdiction,legal_registration_number,admin_name,admin_email,status,verification_token_hash,verification_expires_at,email_verified_at,approved_organization_id,first_admin_invitation_id)
    SELECT $1 || ' ' || n,'supplier','GH','REGISTRATION-METADATA','Applicant ' || n,'access-pages-' || $2 || '-' || n || '@integration.test',
      CASE n%4 WHEN 0 THEN 'pending_email_verification' WHEN 1 THEN 'pending_review' WHEN 2 THEN 'approved' ELSE 'rejected' END,
      md5($2 || '-' || n),NOW()+INTERVAL '1 day',CASE WHEN n%4=0 THEN NULL ELSE NOW() END,
      CASE WHEN n%4=2 THEN $3::uuid ELSE NULL END,CASE WHEN n%4=2 THEN $4::uuid ELSE NULL END
    FROM generate_series(1,1005)n RETURNING id`,
      [prefix, crypto.randomUUID(), reviewer.org, invitationId],
    )
  ).rows
    .map((row) => String(row.id))
    .sort()
    .reverse();
  await query('UPDATE organization_access_applications SET organization_name=$1 WHERE id=$2', [
    prefix + ' Literal %_',
    ids[1004],
  ]);
});
afterAll(async () => {
  try {
    if (ids.length)
      await query('DELETE FROM organization_access_applications WHERE id=ANY($1::uuid[])', [ids]);
    if (invitationId) await query('DELETE FROM user_invitations WHERE id=$1', [invitationId]);
  } finally {
    await pool.end();
  }
});
describe('platform access application pages', () => {
  it('pages 1,005 matching applicants exactly once and excludes token hashes from camelCase DTOs', async () => {
    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await success('/access-applications/page', {
        search: prefix,
        limit: '100',
        ...(cursor ? { cursor } : {}),
      });
      expect(page.headers['cache-control']).toBe('no-store');
      expect(page.body.items.length).toBeLessThanOrEqual(100);
      expect(page.body.count).toBeGreaterThanOrEqual(1005);
      for (const row of page.body.items) {
        expect(row.organizationType).toBe('supplier');
        expect(row.adminEmail).toContain('@integration.test');
        expect(Object.keys(row)).not.toContain('verificationTokenHash');
        expect(Object.keys(row)).not.toContain('verification_token_hash');
      }
      seen.push(...page.body.items.map((row: { id: string }) => row.id));
      cursor = page.body.nextCursor || undefined;
    } while (cursor);
    expect(seen).toEqual(ids);
    expect(new Set(seen).size).toBe(1005);
  });
  it('searches literal wildcards before limiting and filters by exact stored status', async () => {
    const literal = await success('/access-applications/page', {
      search: prefix + ' Literal %_',
      limit: '1',
    });
    expect(literal.body.items.map((row: { id: string }) => row.id)).toEqual([ids[1004]]);
    for (const status of ['pending_email_verification', 'pending_review', 'approved', 'rejected']) {
      const rows = (
        await query(
          'SELECT id FROM organization_access_applications WHERE id=ANY($1::uuid[]) AND status=$2 ORDER BY id DESC',
          [ids, status],
        )
      ).rows;
      const seen: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await success('/access-applications/page', {
          search: prefix,
          status,
          limit: '100',
          ...(cursor ? { cursor } : {}),
        });
        expect(page.body.items.every((row: { status: string }) => row.status === status)).toBe(
          true,
        );
        seen.push(...page.body.items.map((row: { id: string }) => row.id));
        cursor = page.body.nextCursor || undefined;
      } while (cursor);
      expect(seen).toEqual(rows.map((row) => row.id));
    }
  });
  it('keeps complete disjoint state totals independent of narrowed search and pages', async () => {
    const expected = (
      await query(
        `SELECT COUNT(*)::int AS count,COUNT(*) FILTER(WHERE status='pending_email_verification')::int AS pending_email_verification_count,COUNT(*) FILTER(WHERE status='pending_review')::int AS pending_review_count,COUNT(*) FILTER(WHERE status='approved')::int AS approved_count,COUNT(*) FILTER(WHERE status='rejected')::int AS rejected_count FROM organization_access_applications`,
      )
    ).rows[0];
    await success('/access-applications/page', { search: 'Nothing matches ' + prefix, limit: '1' });
    const summary = await success('/access-applications/summary');
    expect(summary.body).toEqual(expected);
    expect(summary.headers['cache-control']).toBe('no-store');
    expect(
      summary.body.pending_email_verification_count +
        summary.body.pending_review_count +
        summary.body.approved_count +
        summary.body.rejected_count,
    ).toBe(summary.body.count);
    const filtered = await success('/access-applications/page', {
      status: 'pending_review',
      search: prefix + ' Literal %_',
      limit: '1',
    });
    expect(filtered.body.count).toBe(expected.pending_review_count);
  });
  it('denies tenant administration, unrelated network permissions and anonymous applicant access', async () => {
    for (const who of [tenant, unrelatedReader])
      for (const path of [
        '/access-applications',
        '/access-applications/page',
        '/access-applications/summary',
      ])
        expect((await get(path, {}, who)).status).toBe(403);
    expect((await request(app).get('/access-applications/page')).status).toBe(401);
    expect(
      (await success('/access-applications/page', { search: prefix, limit: '1' }, otherReviewer))
        .body.items[0].id,
    ).toBe(ids[0]);
  });
  it('binds cursors to reviewer organization, permissions, search and status and rejects malformed reads', async () => {
    const first = await success('/access-applications/page', { search: prefix, limit: '1' });
    const cursor = first.body.nextCursor;
    for (const parameters of [{ search: 'changed' }, { search: prefix, status: 'rejected' }])
      expect((await get('/access-applications/page', { cursor, ...parameters })).status).toBe(400);
    expect(
      (await get('/access-applications/page', { search: prefix, cursor }, otherReviewer)).status,
    ).toBe(400);
    for (const parameters of [
      { limit: '101' },
      { status: 'expired' },
      { search: 'x'.repeat(81) },
      { unknown: 'yes' },
    ])
      expect((await get('/access-applications/page', parameters)).status).toBe(400);
    expect((await get('/access-applications/summary', { status: 'approved' })).status).toBe(400);
    expect((await get('/access-applications/page', { cursor: 'malformed' })).status).toBe(400);
  });
  it('explicitly rejects oversized legacy history and retains exact detail access', async () => {
    const legacy = await get('/access-applications');
    expect(legacy.status).toBe(422);
    expect(legacy.body.code).toBe('CATALOG_READ_LIMIT');
    const detail = await success(`/access-applications/${ids[1004]}`);
    expect(detail.body.id).toBe(ids[1004]);
    expect(detail.body.organizationName).toBe(prefix + ' Literal %_');
    expect(JSON.stringify(detail.body)).not.toContain('verification_token_hash');
  });
});
