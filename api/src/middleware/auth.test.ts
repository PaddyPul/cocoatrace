import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticateSession } from '../services/authSessionService';
import { requireAuth } from './auth';
vi.mock('../services/authSessionService', () => ({ authenticateSession: vi.fn() }));
const app = express();
app.use(requireAuth);
app.get('/private', (req, res) => res.json({ id: req.user?.id }));
beforeEach(() => vi.mocked(authenticateSession).mockReset());
describe('authoritative credential selection', () => {
  it.each(['Basic invalid', 'Bearer', 'Bearer invalid extra'])(
    'never falls back to cookies after %s',
    async (authorization) => {
      expect(
        (
          await request(app)
            .get('/private')
            .set('Cookie', 'ct_session=good-cookie')
            .set('Authorization', authorization)
        ).status,
      ).toBe(401);
      expect(authenticateSession).not.toHaveBeenCalled();
    },
  );
  it('invalid bearer tokens do not fall back to valid cookies', async () => {
    vi.mocked(authenticateSession).mockResolvedValue(null);
    expect(
      (
        await request(app)
          .get('/private')
          .set('Cookie', 'ct_session=good-cookie')
          .set('Authorization', 'Bearer bad')
      ).status,
    ).toBe(401);
    expect(authenticateSession).toHaveBeenCalledExactlyOnceWith('bad');
  });
});

describe('passkey session boundary', () => {
  const actor = {
    id: 'actor',
    sessionId: 'session',
    organizationId: 'organization',
    email: 'fixture@example.test',
    name: 'Fixture',
    roles: ['admin'],
    permissions: ['*'],
    orgName: 'Fixture',
    orgType: 'admin',
  };
  it('blocks restricted sessions and permits exact account status', async () => {
    vi.mocked(authenticateSession).mockResolvedValue({
      ...actor,
      mfa: { required: true, enrolled: false, verified: false, fresh: false },
    });
    expect(
      (await request(app).get('/private').set('Authorization', 'Bearer fixture')).body.code,
    ).toBe('MFA_REQUIRED');
  });
  it('uses the original path inside a mounted MFA router', async () => {
    vi.mocked(authenticateSession).mockResolvedValue({
      ...actor,
      mfa: { required: true, enrolled: false, verified: false, fresh: false },
    });
    const mounted = express();
    const router = express.Router();
    router.use('/auth/mfa', requireAuth);
    router.get('/auth/mfa/keys', (_req, res) => res.json({ keys: [] }));
    mounted.use(router);
    expect(
      (await request(mounted).get('/auth/mfa/keys').set('Authorization', 'Bearer fixture')).status,
    ).toBe(200);
  });
  it('requires fresh assurance before writes while preserving read access', async () => {
    vi.mocked(authenticateSession).mockResolvedValue({
      ...actor,
      mfa: { required: true, enrolled: true, verified: true, fresh: false },
    });
    const writes = express();
    writes.use(requireAuth);
    writes.post('/private', (_req, res) => res.sendStatus(200));
    expect((await request(app).get('/private').set('Authorization', 'Bearer fixture')).status).toBe(
      200,
    );
    expect(
      (await request(writes).post('/private').set('Authorization', 'Bearer fixture')).body.code,
    ).toBe('MFA_STEP_UP_REQUIRED');
  });
});
