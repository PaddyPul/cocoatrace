import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
import { createSession } from '../../src/services/authSessionService';
import { authenticator } from '../../src/testing/webauthnFixture';
import bcrypt from 'bcryptjs';
async function account(permissions: string[]) {
  const suffix = crypto.randomUUID(),
    password = 'AccessReviewPassword123!';
  const org = (
    await query(
      "INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'admin','GH','verified') RETURNING id",
      [`Access review ${suffix}`],
    )
  ).rows[0].id;
  const id = (
    await query(
      'INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',
      [org, `${suffix}@integration.test`, await bcrypt.hash(password, 4), 'Access reviewer'],
    )
  ).rows[0].id;
  const role = (
    await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id', [
      `access-review-${suffix}`,
      permissions,
    ])
  ).rows[0].id;
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [id, role]);
  const session = await createSession(id);
  return { id, role, password, ...session };
}
afterAll(async () => pool.end());
describe('private periodic privileged-access reviews', () => {
  it('requires wildcard access and disables caching even on denied requests', async () => {
    const response = await request(app).get('/admin/access-review');
    expect(response.status).toBe(401);
    expect(response.headers['cache-control']).toBe('no-store');
    const ordinary = await account(['organization.admin']);
    expect(
      (
        await request(app)
          .get('/admin/access-review')
          .set('Authorization', `Bearer ${ordinary.token}`)
      ).status,
    ).toBe(403);
  });
  it('retains findings, rejects changed snapshots and records an atomic review/audit receipt', async () => {
    const admin = await account(['*']);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const options = await request(app)
      .post('/auth/mfa/registration/options')
      .set(auth)
      .send({ currentPassword: admin.password });
    expect(options.status).toBe(200);
    const key = authenticator();
    expect(
      (
        await request(app)
          .post('/auth/mfa/registration/verify')
          .set(auth)
          .send({ response: key.registration(options.body.challenge), label: 'Review test' })
      ).status,
    ).toBe(200);
    const get = () => request(app).get('/admin/access-review').set(auth);
    let report = await get();
    expect(report.status).toBe(200);
    expect(report.body.snapshot.rows.some((row: { id: string }) => row.id === admin.id)).toBe(true);
    const noEvidence = await account(['*']);
    await query('DELETE FROM sessions WHERE user_id=$1', [noEvidence.id]);
    const input = {
      reason: 'Reviewed roster; unknown activity requires investigation',
      confirmed: true,
      expectedSnapshotHash: report.body.snapshotHash,
    };
    expect((await request(app).post('/admin/access-review').set(auth).send(input)).status).toBe(
      409,
    );
    report = await get();
    expect(
      report.body.snapshot.rows.find((row: { id: string }) => row.id === noEvidence.id)
        .activityFinding,
    ).toBe('unknown');
    const saved = await request(app)
      .post('/admin/access-review')
      .set(auth)
      .send({ ...input, expectedSnapshotHash: report.body.snapshotHash });
    expect(saved.status).toBe(201);
    expect(
      new Date(saved.body.next_due_at).getTime() - new Date(saved.body.reviewed_at).getTime(),
    ).toBe(30 * 86400000);
    expect(saved.body.snapshot.counts.unknownActivity).toBeGreaterThan(0);
    expect(
      (
        await query(
          "SELECT id FROM audit_events WHERE action='access.review.recorded' AND entity_id=$1",
          [saved.body.id],
        )
      ).rows,
    ).toHaveLength(1);
    await query("UPDATE sessions SET mfa_verified_at=NOW()-INTERVAL '6 minutes' WHERE id=$1", [
      admin.actor.sessionId,
    ]);
    expect(
      (
        await request(app)
          .post('/admin/access-review')
          .set(auth)
          .send({ ...input, expectedSnapshotHash: report.body.snapshotHash })
      ).status,
    ).toBe(403);
  });
});
