import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
import { createSession } from '../../src/services/authSessionService';
import { authenticator } from '../../src/testing/webauthnFixture';
import { requireDisposableTestDatabase } from '../../src/testing/databaseSafety';
type Actor = { user: string; org: string; token: string };
let owner: Actor, other: Actor, admin: Actor;
async function actor(permissions: string[] = []): Promise<Actor> {
  const tag = crypto.randomUUID();
  const org = (
    await query(
      "INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'exporter','GH','verified') RETURNING id",
      ['Support ' + tag],
    )
  ).rows[0].id as string;
  const user = (
    await query(
      'INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',
      [org, tag + '@support.test', await bcrypt.hash('SupportTest123!', 4), 'Support reporter'],
    )
  ).rows[0].id as string;
  const role = (
    await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id', [
      'support-' + tag,
      permissions,
    ])
  ).rows[0].id as string;
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [user, role]);
  const token = (await createSession(user)).token;
  if (permissions.includes('*')) {
    const options = await request(app)
      .post('/auth/mfa/registration/options')
      .set('Authorization', 'Bearer ' + token)
      .send({ currentPassword: 'SupportTest123!' });
    expect(options.status, JSON.stringify(options.body)).toBe(200);
    const key = authenticator();
    const registered = await request(app)
      .post('/auth/mfa/registration/verify')
      .set('Authorization', 'Bearer ' + token)
      .send({ response: key.registration(options.body.challenge), label: 'Support review key' });
    expect(registered.status, JSON.stringify(registered.body)).toBe(200);
  }
  return { user, org, token };
}
const input = () => ({
  idempotencyKey: crypto.randomUUID(),
  subject: 'Shipment question',
  description: 'The delivery receipt is unclear.',
  context: 'shipment',
  entityId: crypto.randomUUID(),
});
const post = (body: ReturnType<typeof input>, who = owner) =>
  request(app)
    .post('/support/requests')
    .set('Authorization', 'Bearer ' + who.token)
    .send(body);
const get = (path: string, who = owner) =>
  request(app)
    .get(path)
    .set('Authorization', 'Bearer ' + who.token);
beforeAll(async () => {
  owner = await actor();
  other = await actor();
  admin = await actor(['*']);
});
beforeEach(async () => {
  requireDisposableTestDatabase(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);
  await query('TRUNCATE auth_rate_limits');
});
afterAll(async () => {
  await pool.end();
});
describe('contextual support records', () => {
  it('creates one durable reference for concurrent retry and isolates requester reads', async () => {
    const body = input();
    const responses = await Promise.all([post(body), post(body)]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 201]);
    const id = responses[0].body.id as string;
    expect(responses[1].body.id).toBe(id);
    expect(responses[0].body.reference).toBe('BT-SUP-' + id);
    const mismatch = await post({ ...body, subject: 'Changed report' });
    expect(mismatch.status).toBe(409);
    expect((await get('/support/requests/' + id, other)).status).toBe(404);
    const foreign = await get('/support/requests/page', other);
    expect(foreign.body.total).toBe(0);
    expect(foreign.body.items).toEqual([]);
    const audit = await query(
      "SELECT metadata FROM audit_events WHERE entity_id=$1 AND action='support.request.created'",
      [id],
    );
    expect(audit.rows).toHaveLength(1);
    expect(JSON.stringify(audit.rows)).not.toContain(body.description);
    await expect(
      query("UPDATE support_requests SET description='Replacement' WHERE id=$1", [id]),
    ).rejects.toThrow('Support report is immutable');
  });
  it('pages a full aggregate and binds cursors to the requester and surface', async () => {
    const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
    for (const id of ids)
      await query(
        `INSERT INTO support_requests(id,reference,requester_user_id,organization_id,idempotency_key,body_hash,subject,description,context)
      VALUES($1,$2,$3,$4,$5,'fixture','Paging sentinel','Details','other')`,
        [id, 'BT-SUP-' + id, owner.user, owner.org, crypto.randomUUID()],
      );
    const first = await get('/support/requests/page?limit=1&search=Paging');
    expect(first.status).toBe(200);
    expect(first.body.total).toBe(3);
    expect(first.body.hasMore).toBe(true);
    const cursor = encodeURIComponent(first.body.nextCursor as string);
    expect(
      (await get('/support/requests/page?limit=1&search=Paging&cursor=' + cursor, other)).status,
    ).toBe(400);
    expect(
      (await get('/admin/support/requests/page?limit=1&search=Paging&cursor=' + cursor, admin))
        .status,
    ).toBe(400);
    const second = await get('/support/requests/page?limit=1&search=Paging&cursor=' + cursor);
    expect(second.body.total).toBe(3);
    expect(second.body.items[0].id).not.toBe(first.body.items[0].id);
    expect((await get('/support/requests/page?limit=101')).status).toBe(400);
  });
  it('requires wildcard and fresh enrolled assurance, audits reason, and preserves report body', async () => {
    const created = await post(input());
    expect(created.status).toBe(201);
    const path = '/admin/support/requests/' + created.body.id;
    expect((await get('/admin/support/requests/page')).status).toBe(403);
    const review = (who: Actor) =>
      request(app)
        .patch(path)
        .set('Authorization', 'Bearer ' + who.token)
        .send({
          status: 'in_review',
          expectedStatus: 'open',
          reason: 'Reviewing the delivery details',
        });
    expect((await review(owner)).status).toBe(403);
    const updated = await review(admin);
    expect(updated.status, JSON.stringify(updated.body)).toBe(200);
    expect(updated.body.status).toBe('in_review');
    expect(updated.body.description).toBe(created.body.description);
    const audit = await query(
      "SELECT metadata FROM audit_events WHERE entity_id=$1 AND action='support.request.reviewed'",
      [created.body.id],
    );
    expect(audit.rows[0].metadata.reason).toBe('Reviewing the delivery details');
    expect((await review(admin)).status).toBe(409);
    await query("UPDATE sessions SET mfa_verified_at=NOW()-INTERVAL '6 minutes' WHERE user_id=$1", [
      admin.user,
    ]);
    expect((await review(admin)).status).toBe(403);
    await query('UPDATE sessions SET mfa_verified_at=NOW() WHERE user_id=$1', [admin.user]);
  });
  it('rolls report and status changes back when their audit insert fails', async () => {
    const existing = await post(input());
    expect(existing.status).toBe(201);
    await query(`CREATE FUNCTION reject_support_test_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action LIKE 'support.request.%' THEN RAISE EXCEPTION 'Support audit unavailable'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_support_test_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_support_test_audit()`);
    const body = input();
    try {
      const failed = await post(body);
      expect(failed.status).toBe(500);
      const failedReview = await request(app)
        .patch('/admin/support/requests/' + existing.body.id)
        .set('Authorization', 'Bearer ' + admin.token)
        .send({ status: 'resolved', expectedStatus: 'open', reason: 'Investigated the request' });
      expect(failedReview.status).toBe(500);
      expect((await get('/support/requests/' + existing.body.id)).body.status).toBe('open');
      expect(
        (
          await query(
            'SELECT id FROM support_requests WHERE requester_user_id=$1 AND idempotency_key=$2',
            [owner.user, body.idempotencyKey],
          )
        ).rows,
      ).toHaveLength(0);
    } finally {
      await query(
        'DROP TRIGGER reject_support_test_audit ON audit_events; DROP FUNCTION reject_support_test_audit()',
      );
    }
    expect((await post(body)).status).toBe(201);
  });
});
