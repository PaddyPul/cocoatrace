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
