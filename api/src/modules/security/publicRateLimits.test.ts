import express from 'express';
import type { Request } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { AppError } from '../../errors';
import { publicActionLimiter } from '../../middleware/publicRateLimit';
import { checkPublicAction, publicBudgets, type PublicOperation } from './publicRateLimits';
import { rateKey, type RateStore } from './rateLimits';

class MemoryStore implements RateStore {
  readonly counts = new Map<string, number>();
  readonly calls: string[] = [];
  async consume(key: string, limit: number) {
    this.calls.push(key);
    const attempts = (this.counts.get(key) || 0) + 1;
    this.counts.set(key, attempts);
    return {
      allowed: attempts <= limit,
      limit,
      remaining: Math.max(0, limit - attempts),
      resetAt: 123456,
      retryAfterSeconds: 30,
    };
  }
}
function input(ip = 'peer', userId = 'member', organizationId = 'organization'): Request {
  return {
    ip,
    user: { id: userId, organizationId },
    headers: {},
    params: { slug: 'anything' },
    body: {},
    query: {},
  } as unknown as Request;
}
describe('bounded public and resource budgets', () => {
  it.each(Object.keys(publicBudgets) as PublicOperation[])(
    '%s uses fixed hashed scope keys and rejects after its smallest budget',
    async (operation) => {
      const store = new MemoryStore(),
        req = input();
      const b = publicBudgets[operation];
      const limit = 'user' in b ? b.user : b.ip;
      for (let n = 0; n < limit; n++)
        expect((await checkPublicAction(req, store, operation)).allowed).toBe(true);
      expect((await checkPublicAction(req, store, operation)).allowed).toBe(false);
      expect([...store.counts.keys()].every((key) => /^[0-9a-f]{64}$/.test(key))).toBe(true);
      expect(store.counts.size).toBe('user' in b ? 4 : 2);
    },
  );
  it('rotating slugs, ignored identity fields and forwarded headers cannot select new buckets', async () => {
    const store = new MemoryStore();
    for (let n = 0; n < publicBudgets.scan.ip; n++) {
      const req = input();
      req.params.slug = `slug-${n}`;
      req.body = { organizationId: `fake-${n}`, email: `fake-${n}@test` };
      req.headers = { 'x-forwarded-for': `192.0.2.${n}` };
      expect((await checkPublicAction(req, store, 'scan')).allowed).toBe(true);
    }
    expect((await checkPublicAction(input(), store, 'scan')).allowed).toBe(false);
    expect(store.counts.size).toBe(2);
  });
  it('organization budget survives member/IP rotation without charging an unrelated organization', async () => {
    const store = new MemoryStore();
    for (let n = 0; n < publicBudgets.invitationCreate.organization; n++)
      expect(
        (await checkPublicAction(input(`ip-${n}`, `member-${n}`, 'one'), store, 'invitationCreate'))
          .allowed,
      ).toBe(true);
    expect(
      (await checkPublicAction(input('new-ip', 'new-member', 'one'), store, 'invitationCreate'))
        .allowed,
    ).toBe(false);
    expect(
      (await checkPublicAction(input('new-ip', 'new-member', 'two'), store, 'invitationCreate'))
        .allowed,
    ).toBe(true);
  });
  it('global exhaustion stops before creating an attacker-selected peer or actor bucket', async () => {
    const store = new MemoryStore();
    store.counts.set(
      rateKey('public:uploadIntent', 'deployment', 'all'),
      publicBudgets.uploadIntent.deployment,
    );
    const req = input('never-stored-peer', 'never-stored-member', 'never-stored-org');
    expect((await checkPublicAction(req, store, 'uploadIntent')).allowed).toBe(false);
    expect(store.counts.size).toBe(1);
    expect(store.calls).toHaveLength(1);
  });
  it('authenticated policies never accept an identity from request data', async () => {
    const req = input();
    delete req.user;
    req.body = { user: { id: 'fake', organizationId: 'fake' } };
    await expect(checkPublicAction(req, new MemoryStore(), 'uploadIntent')).rejects.toThrow(
      'live actor',
    );
  });
  it('middleware sends retry guidance, ignores spoofed IP and prevents handler side effects', async () => {
    const store = new MemoryStore(),
      app = express();
    let calls = 0;
    app.set('trust proxy', false);
    app.post('/scan/:slug', publicActionLimiter('scan', store), (_req, res) => {
      calls++;
      res.sendStatus(204);
    });
    for (let n = 0; n < publicBudgets.scan.ip; n++)
      expect(
        (await request(app).post(`/scan/${n}`).set('X-Forwarded-For', `192.0.2.${n}`)).status,
      ).toBe(204);
    const response = await request(app).post('/scan/new');
    expect(response.status).toBe(429);
    expect(response.body.code).toBe('RESOURCE_RATE_LIMITED');
    expect(response.headers['retry-after']).toBe('30');
    expect(response.headers['ratelimit-remaining']).toBe('0');
    expect(calls).toBe(publicBudgets.scan.ip);
  });
  it('store outage fails closed before parsing raw uploads or calling a scanner', async () => {
    const store: RateStore = {
      consume: async () => {
        throw new Error('DB connection details must not leak');
      },
    };
    const app = express();
    let processed = false;
    app.put(
      '/upload',
      publicActionLimiter('uploadContent', store),
      express.raw({ type: '*/*', limit: 1 }),
      (_req, res) => {
        processed = true;
        res.sendStatus(201);
      },
    );
    app.use((err: AppError, _req: Request, res: express.Response, _next: express.NextFunction) =>
      res.status(err.statusCode).json({ code: err.code, error: err.message }),
    );
    const response = await request(app)
      .put('/upload')
      .set('Content-Type', 'application/pdf')
      .send(Buffer.alloc(10));
    expect(response.status).toBe(503);
    expect(response.body.code).toBe('RESOURCE_RATE_LIMIT_UNAVAILABLE');
    expect(JSON.stringify(response.body)).not.toContain('connection details');
    expect(processed).toBe(false);
  });
});
