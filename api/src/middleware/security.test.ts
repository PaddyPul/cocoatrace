import express from 'express';
import request from 'supertest';
import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { config } from '../config/env';
import { AppError } from '../errors';
import { sensitiveLimiter, verifyBrowserOrigin } from './security';
import { sessionCredential } from './credentials';
import {
  checkSensitiveAction,
  rateKey,
  sensitiveIpLimit,
  sensitiveTargetLimit,
  type RateStore,
} from '../modules/security/rateLimits';

function originApp() {
  const app = express();
  app.use(verifyBrowserOrigin);
  app.all('/write', (_req, res) => res.sendStatus(204));
  return app;
}

describe('browser write boundary', () => {
  it.each(['post', 'put', 'patch', 'delete'] as const)(
    'blocks cookie %s without an origin',
    async (method) => {
      const client = request(originApp());
      const response = await client[method]('/write').set('Cookie', 'ct_session=valid');
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('ORIGIN_NOT_PERMITTED');
    },
  );
  it.each([
    'null',
    'https://attacker.test',
    `${config.webUrl}.attacker.test`,
    `${config.webUrl}/path`,
    `${config.webUrl}/`,
  ])('rejects untrusted origin %s', async (origin) => {
    expect(
      (
        await request(originApp())
          .post('/write')
          .set('Cookie', 'ct_session=valid')
          .set('Origin', origin)
      ).status,
    ).toBe(403);
  });
  it.each(['Basic junk', 'Bearer', 'Bearer ', 'Bearer token extra'])(
    'cannot bypass origin with malformed authorization %s',
    async (authorization) => {
      expect(
        (
          await request(originApp())
            .post('/write')
            .set('Cookie', 'ct_session=valid')
            .set('Authorization', authorization)
            .set('Origin', 'https://attacker.test')
        ).status,
      ).toBe(403);
      expect(
        sessionCredential({ headers: { authorization, cookie: 'ct_session=valid' } }),
      ).toBeUndefined();
    },
  );
  it('accepts configured origin and ignores forged target headers', async () => {
    expect(
      (
        await request(originApp())
          .post('/write')
          .set('Cookie', 'ct_session=valid')
          .set('Origin', new URL(config.webUrl).origin)
      ).status,
    ).toBe(204);
    expect(
      (
        await request(originApp())
          .post('/write')
          .set('Cookie', 'ct_session=valid')
          .set('Origin', 'https://attacker.test')
          .set('Host', 'attacker.test')
          .set('X-Forwarded-Host', 'attacker.test')
          .set('X-Forwarded-Proto', 'https')
      ).status,
    ).toBe(403);
  });
  it('checks origins on public and explicit bearer writes', async () => {
    expect((await request(originApp()).post('/write').set('Origin', 'null')).status).toBe(403);
    expect(
      (
        await request(originApp())
          .post('/write')
          .set('Authorization', 'Bearer token')
          .set('Origin', 'https://attacker.test')
      ).status,
    ).toBe(403);
  });
  it('allows explicit bearer clients without origin and safe methods', async () => {
    expect(
      (
        await request(originApp())
          .post('/write')
          .set('Authorization', 'Bearer token')
          .set('Cookie', 'ct_session=unused')
      ).status,
    ).toBe(204);
    expect(
      (await request(originApp()).get('/write').set('Cookie', 'ct_session=valid')).status,
    ).toBe(204);
    expect((await request(originApp()).post('/write')).status).toBe(204);
  });
  it('extracts only exact session cookies and prefers explicit bearer', () => {
    expect(
      sessionCredential({ headers: { cookie: 'not_ct_session=secret; theme=light' } }),
    ).toBeUndefined();
    expect(sessionCredential({ headers: { cookie: 'theme=light; ct_session=real' } })).toBe('real');
    expect(
      sessionCredential({ headers: { cookie: 'ct_session=old', authorization: 'Bearer new' } }),
    ).toBe('new');
  });
});

const allowed = { allowed: true, limit: 10, remaining: 9, resetAt: 100, retryAfterSeconds: 90 };
function req(ip: string, email?: string, params = {}): Request {
  return {
    ip,
    path: '/auth/invitations/raw-secret/accept',
    route: { path: Object.keys(params).length ? '/auth/invitations/:token/accept' : '/auth/login' },
    body: email === undefined ? {} : { email },
    params,
  } as unknown as Request;
}

describe('shared sensitive-action limiter', () => {
  it('uses separate IP and normalized account keys across IP rotation', async () => {
    const consume = vi.fn().mockResolvedValue(allowed);
    await checkSensitiveAction(req('192.0.2.1', 'Admin@browser.test'), { consume });
    await checkSensitiveAction(req('192.0.2.2', ' admin@browser.test '), { consume });
    expect(consume.mock.calls[0][0]).not.toBe(consume.mock.calls[2][0]);
    expect(consume.mock.calls[1][0]).toBe(consume.mock.calls[3][0]);
    expect(consume.mock.calls[0][1]).toBe(sensitiveIpLimit);
    expect(consume.mock.calls[1][1]).toBe(sensitiveTargetLimit);
    expect(consume.mock.calls.every(([key]) => /^[0-9a-f]{64}$/.test(key))).toBe(true);
  });
  it('stops before creating more target records after IP exhaustion', async () => {
    const consume = vi.fn().mockResolvedValue({ ...allowed, allowed: false });
    expect(
      (await checkSensitiveAction(req('192.0.2.1', 'new@browser.test'), { consume })).allowed,
    ).toBe(false);
    expect(consume).toHaveBeenCalledOnce();
  });
  it('uses full tokens and route templates rather than raw secret URLs', async () => {
    const consume = vi.fn().mockResolvedValue(allowed);
    await checkSensitiveAction(req('192.0.2.1', undefined, { token: 'same-prefix-first' }), {
      consume,
    });
    await checkSensitiveAction(req('192.0.2.1', undefined, { token: 'same-prefix-second' }), {
      consume,
    });
    expect(consume.mock.calls[0][0]).toBe(consume.mock.calls[2][0]);
    expect(consume.mock.calls[1][0]).not.toBe(consume.mock.calls[3][0]);
    expect(consume.mock.calls[0][0]).toBe(
      rateKey('/auth/invitations/:token/accept', 'ip', '192.0.2.1'),
    );
  });
  it('ignored identity fields cannot alter login or reset budgets', async () => {
    const consume = vi.fn().mockResolvedValue(allowed);
    const login = req('192.0.2.1', 'same@browser.test');
    login.body.token = 'rotating-ignored-token';
    await checkSensitiveAction(login, { consume });
    expect(consume.mock.calls[1][0]).toBe(
      rateKey('/auth/login', 'target', 'email:same@browser.test'),
    );
    const reset = req('192.0.2.1', 'rotating-ignored-email@browser.test');
    reset.route = { path: '/auth/password/reset' };
    reset.body.token = 'actual-reset-token';
    await checkSensitiveAction(reset, { consume });
    expect(consume.mock.calls[3][0]).toBe(
      rateKey('/auth/password/reset', 'target', 'token:actual-reset-token'),
    );
  });
  it('does not trust client-supplied forwarded IPs', async () => {
    const consume = vi.fn().mockResolvedValue(allowed);
    const app = express();
    app.set('trust proxy', false);
    app.use(express.json());
    app.post('/auth/login', sensitiveLimiter({ consume }), (_req, res) => res.sendStatus(204));
    await request(app)
      .post('/auth/login')
      .set('X-Forwarded-For', '192.0.2.1')
      .send({ email: 'account@browser.test' });
    await request(app)
      .post('/auth/login')
      .set('X-Forwarded-For', '192.0.2.2')
      .send({ email: 'account@browser.test' });
    expect(consume.mock.calls[0][0]).toBe(consume.mock.calls[2][0]);
  });
  it('returns retry headers and a stable throttled error', async () => {
    const app = express();
    app.use(
      sensitiveLimiter({
        consume: vi.fn().mockResolvedValue({ ...allowed, allowed: false, remaining: 0 }),
      }),
    );
    app.post('/write', (_req, res) => res.sendStatus(204));
    const result = await request(app).post('/write');
    expect(result.status).toBe(429);
    expect(result.body.code).toBe('AUTH_RATE_LIMITED');
    expect(result.headers['retry-after']).toBe('90');
  });
  it('fails closed without leaking store error details', async () => {
    const app = express();
    const store: RateStore = {
      consume: async () => {
        throw new Error('secret database details');
      },
    };
    app.use(sensitiveLimiter(store));
    app.post('/write', (_req, res) => res.sendStatus(204));
    app.use(
      (
        error: AppError,
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction,
      ) => res.status(error.statusCode).json({ code: error.code, error: error.message }),
    );
    const result = await request(app).post('/write');
    expect(result.status).toBe(503);
    expect(result.body.code).toBe('AUTH_RATE_LIMIT_UNAVAILABLE');
    expect(JSON.stringify(result.body)).not.toContain('secret database details');
  });
});
