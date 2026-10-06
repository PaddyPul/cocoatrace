import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Request } from 'express';
import app from '../../src/app';
import { pool, query } from '../../src/db';
import { createSession } from '../../src/services/authSessionService';
import { checkSensitiveAction, PostgresRateStore, rateKey, sensitiveIpLimit, sensitiveTargetLimit } from '../../src/modules/security/rateLimits';

let userId: string;
beforeAll(async () => {
  const org = (await query("INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES('Boundary','exporter','GH','verified') RETURNING id")).rows[0];
  userId = (await query('INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id', [org.id, `boundary-${crypto.randomUUID()}@integration.test`, await bcrypt.hash('BoundaryPassword123!', 4), 'Boundary user'])).rows[0].id;
});
afterAll(async () => { await pool.end(); });

async function session() { return (await createSession(userId)).token; }
function limitRequest(operation: string, ip: string, email: string): Request {
  return { ip, path: operation, route: { path: operation }, body: { email }, params: {} } as unknown as Request;
}

describe('real cookie/origin and shared authentication boundary', () => {
  it.each([undefined, 'null', 'https://attacker.test'])('rejects cookie logout from %s without revoking its session', async (origin) => {
    const token = await session();
    const attempt = request(app).post('/auth/logout').set('Cookie', `ct_session=${token}`);
    if (origin !== undefined) attempt.set('Origin', origin);
    const response = await attempt;
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('ORIGIN_NOT_PERMITTED');
    expect((await request(app).get('/me').set('Authorization', `Bearer ${token}`)).status).toBe(200);
  });

  it('rejects malformed authorization even when a valid cookie and permitted origin exist', async () => {
    const token = await session();
    expect((await request(app).post('/auth/logout').set('Cookie', `ct_session=${token}`).set('Authorization', 'Basic bad').set('Origin', 'http://localhost:3000')).status).toBe(401);
    expect((await request(app).get('/me').set('Authorization', `Bearer ${token}`)).status).toBe(200);
  });

  it('rejects the former malformed-header origin bypass and forged target headers', async () => {
    const token = await session();
    const response = await request(app).post('/auth/logout').set('Cookie', `ct_session=${token}`).set('Authorization', 'Basic bad').set('Origin', 'https://attacker.test').set('Host', 'attacker.test').set('X-Forwarded-Host', 'attacker.test').set('X-Forwarded-Proto', 'https');
    expect(response.status).toBe(403);
    expect((await request(app).get('/me').set('Authorization', `Bearer ${token}`)).status).toBe(200);
  });

  it('permits same-origin cookie logout and revokes exactly that session', async () => {
    const token = await session();
    expect((await request(app).post('/auth/logout').set('Cookie', `ct_session=${token}`).set('Origin', 'http://localhost:3000')).status).toBe(204);
    expect((await request(app).get('/me').set('Authorization', `Bearer ${token}`)).status).toBe(401);
  });

  it('permits an explicit bearer client without an Origin or cookie fallback', async () => {
    const token = await session();
    expect((await request(app).post('/auth/logout').set('Cookie', 'ct_session=irrelevant').set('Authorization', `Bearer ${token}`)).status).toBe(204);
  });

  it('atomically allows only ten attempts across independent store instances', async () => {
    const key = rateKey('concurrent-test', 'target', crypto.randomUUID());
    const stores = [new PostgresRateStore(), new PostgresRateStore()];
    const attempts = await Promise.all(Array.from({ length: 24 }, (_, index) => stores[index % 2].consume(key, sensitiveTargetLimit)));
    expect(attempts.filter((result) => result.allowed)).toHaveLength(sensitiveTargetLimit);
    const row = (await query('SELECT attempts FROM auth_rate_limits WHERE bucket_key=$1', [key])).rows[0];
    expect(row.attempts).toBe(sensitiveTargetLimit + 1);
    expect((await new PostgresRateStore().consume(key, sensitiveTargetLimit)).allowed).toBe(false);
  });

  it('resets expired counters with database time and prunes at most 100 expired rows', async () => {
    const store = new PostgresRateStore();
    const key = rateKey('expiry-test', 'target', crypto.randomUUID());
    await store.consume(key, sensitiveTargetLimit);
    await query("UPDATE auth_rate_limits SET attempts=11,expires_at=NOW()-INTERVAL '1 minute' WHERE bucket_key=$1", [key]);
    expect((await store.consume(key, sensitiveTargetLimit)).remaining).toBe(9);
    const keys = Array.from({ length: 150 }, () => crypto.randomBytes(32).toString('hex'));
    await query("INSERT INTO auth_rate_limits(bucket_key,attempts,expires_at) SELECT unnest($1::text[]),1,NOW()-INTERVAL '1 minute'", [keys]);
    await store.consume(rateKey('prune-test', 'ip', crypto.randomUUID()), sensitiveIpLimit, true);
    expect((await query('SELECT COUNT(*)::integer AS count FROM auth_rate_limits WHERE bucket_key=ANY($1::text[])', [keys])).rows[0].count).toBe(50);
  });

  it('limits one account across IP changes but does not consume another account budget', async () => {
    const store = new PostgresRateStore();
    const operation = '/auth/login';
    const account = `${crypto.randomUUID()}@integration.test`;
    for (let index = 0; index < 10; index++) expect((await checkSensitiveAction(limitRequest(operation, `192.0.2.${index}`, account), store)).allowed).toBe(true);
    expect((await checkSensitiveAction(limitRequest(operation, '192.0.2.99', ` ${account.toUpperCase()} `), store)).allowed).toBe(false);
    expect((await checkSensitiveAction(limitRequest(operation, '192.0.2.99', 'other@integration.test'), store)).allowed).toBe(true);
  });

  it('bounds IP attempts across rotating account names without creating further target buckets', async () => {
    const store = new PostgresRateStore();
    const operation = '/auth/login';
    const ip = `192.0.2.200-${crypto.randomUUID()}`;
    for (let index = 0; index < sensitiveIpLimit; index++) expect((await checkSensitiveAction(limitRequest(operation, ip, `${index}@integration.test`), store)).allowed).toBe(true);
    expect((await checkSensitiveAction(limitRequest(operation, ip, 'blocked@integration.test'), store)).allowed).toBe(false);
    const blockedKey = rateKey(operation, 'target', 'email:blocked@integration.test');
    expect((await query('SELECT 1 FROM auth_rate_limits WHERE bucket_key=$1', [blockedKey])).rows).toHaveLength(0);
  });

  it('returns an API throttle with Retry-After and ignores untrusted forwarded IP rotation', async () => {
    const email = `throttle-${crypto.randomUUID()}@integration.test`;
    for (let index = 0; index < 10; index++) {
      const response = await request(app).post('/auth/password/forgot').set('X-Forwarded-For', `192.0.2.${index}`).send({ email, token: `ignored-${index}` });
      expect(response.status).toBe(202);
    }
    const denied = await request(app).post('/auth/password/forgot').set('X-Forwarded-For', '192.0.2.99').send({ email });
    expect(denied.status).toBe(429);
    expect(denied.body.code).toBe('AUTH_RATE_LIMITED');
    expect(Number(denied.headers['retry-after'])).toBeGreaterThan(0);
    expect(app.get('trust proxy')).toBe(false);
  });
});
