import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
import { createSession } from '../../src/services/authSessionService';
import { authenticator } from '../../src/testing/webauthnFixture';
type Actor = { id: string; organizationId: string; sessionId: string; token: string };
let admin: Actor, ordinary: Actor;
async function actor(privileged: boolean): Promise<Actor> {
  const tag = crypto.randomUUID();
  const org = (
    await query(
      "INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'exporter','GH','verified') RETURNING id",
      ['Operations ' + tag],
    )
  ).rows[0].id;
  const id = (
    await query(
      "INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,'Operations test') RETURNING id",
      [org, tag + '@integration.test', await bcrypt.hash('OperationsFixture123!', 4)],
    )
  ).rows[0].id;
  const role = (
    await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id', [
      'ops-' + tag,
      privileged ? ['*'] : ['batch.read'],
    ])
  ).rows[0].id;
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [id, role]);
  const session = await createSession(id);
  if (privileged) {
    const device = authenticator();
    const options = await request(app)
      .post('/auth/mfa/registration/options')
      .set('Authorization', `Bearer ${session.token}`)
      .send({ currentPassword: 'OperationsFixture123!' });
    expect(options.status, JSON.stringify(options.body)).toBe(200);
    const verified = await request(app)
      .post('/auth/mfa/registration/verify')
      .set('Authorization', `Bearer ${session.token}`)
      .send({
        response: device.registration(options.body.challenge),
        label: 'Operations regression authenticator',
      });
    expect(verified.status, JSON.stringify(verified.body)).toBe(200);
  }
  return { id, organizationId: org, sessionId: session.actor.sessionId, token: session.token };
}

beforeAll(async () => {
  admin = await actor(true);
  ordinary = await actor(false);
});
afterAll(async () => {
  await pool.end();
});
describe('protected build diagnostics', () => {
  it('denies unauthenticated and ordinary members before returning metadata', async () => {
    expect((await request(app).get('/operations/deployment')).status).toBe(401);
    const denied = await request(app)
      .get('/operations/deployment')
      .set('Authorization', `Bearer ${ordinary.token}`);
    expect(denied.status).toBe(403);
    expect(denied.headers['cache-control']).toBe('no-store');
    expect(denied.body.gitSha).toBeUndefined();
  });
  it('projects only bounded release identifiers to an assured administrator', async () => {
    const result = await request(app)
      .get('/operations/deployment')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(Object.keys(result.body).sort()).toEqual(
      ['schemaVersion', 'environment', 'metadataStatus', 'gitSha', 'builtAt', 'provenance'].sort(),
    );
    expect(result.body.environment).toBe('test');
    expect(['complete', 'incomplete']).toContain(result.body.metadataStatus);
    if (result.body.gitSha !== null) expect(result.body.gitSha).toMatch(/^[0-9a-f]{40}$/);
    expect(
      (
        await request(app)
          .get('/operations/deployment?secret=1')
          .set('Authorization', `Bearer ${admin.token}`)
      ).status,
    ).toBe(400);
  });
});
