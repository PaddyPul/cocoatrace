import { expectIdenticalNotFound } from './support/errorAssertions';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
import { createSession } from '../../src/services/authSessionService';

type Route = {
  method: string;
  path: string;
  authentication: string;
  guards: { kind: string; permissions?: string[] }[];
};
const register = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../docs/security/route-authorization.json'),
    'utf8',
  ),
) as { routes: Route[] };
const permissionRoutes = register.routes.filter(
  (row) => row.authentication === 'session' && row.guards.some((guard) => guard.kind !== 'session'),
);
const concrete = (route: string) =>
  route.replace(/:([A-Za-z_]+)/g, (_, name: string) =>
    name === 'kind' ? 'users' : '11111111-1111-4111-8111-111111111111',
  );
let token: string, userId: string, foreignRecall: string;
async function account() {
  const tag = crypto.randomUUID();
  const org = (
    await query(
      "INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'exporter','GH','verified') RETURNING id",
      ['Boundary ' + tag],
    )
  ).rows[0].id;
  const id = (
    await query(
      "INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,'Boundary fixture') RETURNING id",
      [org, tag + '@integration.test', await bcrypt.hash('BoundaryFixture123!', 4)],
    )
  ).rows[0].id;
  return { id, org };
}
async function invoke(route: Route, url = concrete(route.path)) {
  const agent = request(app);
  const call =
    route.method === 'GET'
      ? agent.get(url)
      : route.method === 'POST'
        ? agent.post(url)
        : route.method === 'PUT'
          ? agent.put(url)
          : route.method === 'PATCH'
            ? agent.patch(url)
            : route.method === 'DELETE'
              ? agent.delete(url)
              : undefined;
  if (!call) throw new Error('Unsupported permission HTTP method ' + route.method);
  return call.set('Authorization', `Bearer ${token}`).timeout({ response: 5000, deadline: 8000 });
}
beforeAll(async () => {
  const own = await account(),
    foreign = await account();
  userId = own.id;
  const session = await createSession(userId);
  token = session.token;
  expect(session.actor.permissions).toEqual([]);
  foreignRecall = (
    await query(
      "INSERT INTO recall_notices(reference_code,title,reason,instructions,severity,initiated_by_user_id,initiated_by_organization_id) VALUES($1,'Private foreign boundary recall','Private reason','Private response instructions','warning',$2,$3) RETURNING id",
      [crypto.randomUUID(), foreign.id, foreign.org],
    )
  ).rows[0].id;
});
afterAll(async () => {
  if (foreignRecall) await query('DELETE FROM recall_notices WHERE id=$1', [foreignRecall]);
  if (userId)
    await query(
      "UPDATE sessions SET revoked_at=NOW(),revoked_reason='boundary fixture complete' WHERE user_id=$1 AND revoked_at IS NULL",
      [userId],
    );
  await pool.end();
});
describe('live-session permission gates across the reviewed route register', () => {
  it.each(permissionRoutes)(
    '$method $path rejects a live verified organization member without permissions',
    async (route) => {
      const response = await invoke(route);
      expect(
        response.status,
        `${route.method} ${route.path}: ${JSON.stringify(response.body)}`,
      ).toBe(403);
      expect(response.body.error).toMatch(/Permission|required/i);
    },
  );
  it('rejects non-admin access review before malformed ID, query and body processing', async () => {
    for (const endpoint of [
      '/access-applications/not-a-uuid/approve',
      '/access-applications/not-a-uuid/reject',
    ]) {
      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 123, recipient: 'unreviewed override' });
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.status, JSON.stringify(response.body)).toBe(403);
    }
    expect(
      (
        await request(app)
          .get('/access-applications/page?limit=not-a-number')
          .set('Authorization', `Bearer ${token}`)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .get('/access-applications/not-a-uuid')
          .set('Authorization', `Bearer ${token}`)
      ).status,
    ).toBe(403);
  });
  it('allows self identity while hiding foreign and absent recall response identities equally', async () => {
    const self = await request(app).get('/me').set('Authorization', `Bearer ${token}`);
    expect(self.status).toBe(200);
    expect(self.body.id).toBe(userId);
    const results = await Promise.all(
      [foreignRecall, crypto.randomUUID()].map((id) =>
        request(app).get(`/recalls/${id}/response`).set('Authorization', `Bearer ${token}`),
      ),
    );
    expect(results.map((row) => row.status)).toEqual([404, 404]);
    expectIdenticalNotFound(results[0], results[1]);
    expect(JSON.stringify(results[0].body)).not.toContain('Private foreign boundary recall');
  });
  it('permission failures create no business mutation audit for the denied actor', async () => {
    expect(
      (
        await query('SELECT COUNT(*)::int AS count FROM audit_events WHERE actor_user_id=$1', [
          userId,
        ])
      ).rows[0].count,
    ).toBe(0);
  });
});
