import request from 'supertest';
import express from 'express';
import { afterAll, describe, expect, it, vi } from 'vitest';
// Rate persistence is covered separately; keep these ingress HTTP tests database-free.
vi.mock('./publicRateLimit', () => ({
  publicActionLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
import app from '../app';
import { pool } from '../db';
import { AppError } from '../errors';
import * as evidenceUploads from '../services/evidenceUploadService';
import { createQueryBudget, requestLimits, validateQueryBudget } from './requestLimits';

afterAll(() => pool.end());
describe('global ingress budgets', () => {
  it('preserves ordinary Express scalar, repeated and nested query semantics', async () => {
    const isolated = express();
    isolated.use(createQueryBudget(isolated));
    isolated.get('/query', (req, res) => res.json(req.query));
    const response = await request(isolated).get(
      '/query?search=green+beans&tag=a&tag=b&filter%5Bcrop%5D=peanut',
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      search: 'green beans',
      tag: ['a', 'b'],
      filter: { crop: 'peanut' },
    });
  });
  it('rejects excess parameters before parsing instead of silently truncating', async () => {
    const query = Array.from({ length: 65 }, (_, index) => `k${index}=x`).join('&');
    const response = await request(app).get(`/health/live?${query}`);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('REQUEST_QUERY_LIMIT');
    expect(response.headers['x-request-id']).toBeTruthy();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
  it('preserves an ordinary request at the parameter boundary', async () => {
    const query = Array.from({ length: 64 }, (_, index) => `k${index}=x`).join('&');
    expect((await request(app).get(`/health/live?${query}`)).status).toBe(200);
  });
  it.each([
    ['key', `${'k'.repeat(129)}=x`],
    ['value', `search=${'x'.repeat(2049)}`],
    ['encoded depth', 'a%5Bb%5D%5Bc%5D%5Bd%5D%5Be%5D%5Bf%5D=x'],
    ['unicode byte count', `search=${'é'.repeat(1025)}`],
    ['repeated keys', Array.from({ length: 65 }, () => 'same=x').join('&')],
  ])('rejects excessive %s', (_name, raw) => {
    expect(() => validateQueryBudget(raw)).toThrow();
  });
  it('rejects raw byte overflow independently of decoded field limits', async () => {
    const raw = Array.from({ length: 5 }, (_, index) => `k${index}=${'x'.repeat(1800)}`).join('&');
    expect(Buffer.byteLength(raw)).toBeGreaterThan(requestLimits.queryBytes);
    const response = await request(app).get(`/health/live?${raw}`);
    expect(response.status).toBe(414);
    expect(response.body).toEqual({
      error: 'Query string is too large',
      code: 'REQUEST_QUERY_TOO_LARGE',
    });
  });
  it('rejects oversized JSON with a generic request code, without echoing the body', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({ password: 'x'.repeat(requestLimits.jsonBytes) });
    expect(response.status).toBe(413);
    expect(response.body.code).toBe('REQUEST_BODY_TOO_LARGE');
    expect(JSON.stringify(response.body)).not.toContain('password');
  });
  it('returns a stable redacted 400 for malformed JSON', async () => {
    const response = await request(app)
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"password":"secret",');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Malformed JSON request body',
      code: 'REQUEST_JSON_INVALID',
    });
  });
  it('keeps the signed evidence capability boundary ahead of JSON parsing', async () => {
    const authorize = vi
      .spyOn(evidenceUploads, 'authorizeUploadContent')
      .mockRejectedValueOnce(
        new AppError('Invalid upload capability', 403, 'UPLOAD_CAPABILITY_INVALID'),
      );
    try {
      const response = await request(app)
        .put('/evidence/upload-intents/not-an-id/content')
        .set('Content-Type', 'application/json')
        .send('{');
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('UPLOAD_CAPABILITY_INVALID');
      expect(authorize).toHaveBeenCalledOnce();
    } finally {
      authorize.mockRestore();
    }
  });
});
