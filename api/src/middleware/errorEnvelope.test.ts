import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError } from '../errors';
import { assignRequestId } from '../requestContext';
import { TraceIncompleteError } from '../modules/trace/limits';
import validate from './validate';
import { apiErrorHandler, errorEnvelope, normalizeErrorEnvelope } from './errorEnvelope';

function fixture() {
  const app = express();
  app.use((req, res, next) => {
    assignRequestId(req, res);
    next();
  });
  app.use(errorEnvelope);
  app.use(express.json({ limit: 100 }));
  app.get('/success', (_req, res) => res.json({ status: 'ok', items: [1] }));
  app.get('/manual', (_req, res) =>
    res
      .status(429)
      .set('Retry-After', '12')
      .json({ error: 'Try later', code: 'AUTH_RATE_LIMITED', secret: 'private' }),
  );
  app.get('/domain', (_req, _res, next) =>
    next(new AppError('Current version changed', 409, 'STALE_REVISION')),
  );
  app.get('/trace', (_req, _res, next) => next(new TraceIncompleteError('DATABASE_TIMEOUT')));
  app.get('/unexpected', (_req, _res, next) => next(new Error('SQL password secret')));
  app.get('/manual-server', (_req, res) =>
    res.status(503).json({
      error: 'Provider secret',
      code: 'STORAGE_UNAVAILABLE',
      details: [{ path: 'secret', message: 'credential' }],
      stack: 'secret',
      status: 'not_ready',
      dependency: 'database_storage_or_evidence_scanner',
    }),
  );
  app.post(
    '/validate',
    validate(z.object({ name: z.string().min(3, 'secret custom message') })),
    (_req, res) => res.json({ ok: true }),
  );
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use(apiErrorHandler);
  return app;
}
describe('JSON failure envelope through Express', () => {
  it('leaves success responses unchanged', async () => {
    expect((await request(fixture()).get('/success')).body).toEqual({ status: 'ok', items: [1] });
  });
  it('retains manual status, domain code and retry header while dropping arbitrary metadata', async () => {
    const result = await request(fixture()).get('/manual').set('X-Request-Id', 'review-123');
    expect(result.status).toBe(429);
    expect(result.headers['retry-after']).toBe('12');
    expect(result.body).toEqual({
      error: 'Try later',
      code: 'AUTH_RATE_LIMITED',
      requestId: 'review-123',
    });
  });
  it('retains thrown domain conflicts and trace uncertainty', async () => {
    const app = fixture();
    const conflict = await request(app).get('/domain');
    expect(conflict.status).toBe(409);
    expect(conflict.body).toMatchObject({
      error: 'Current version changed',
      code: 'STALE_REVISION',
      requestId: conflict.headers['x-request-id'],
    });
    expect((await request(app).get('/trace')).body.analysis).toEqual({
      status: 'incomplete',
      reason: 'DATABASE_TIMEOUT',
      safetyClearance: false,
    });
  });
  it('redacts unexpected and manually generated server details while retaining fixed health metadata', async () => {
    for (const path of ['/unexpected', '/manual-server']) {
      const result = await request(fixture()).get(path);
      expect(result.body.error).toBe('Internal server error');
      expect(result.body.requestId).toBe(result.headers['x-request-id']);
      expect(JSON.stringify(result.body)).not.toMatch(/secret|credential|SQL|stack|details/);
      if (path === '/manual-server')
        expect(result.body).toMatchObject({
          code: 'STORAGE_UNAVAILABLE',
          status: 'not_ready',
          dependency: 'database_storage_or_evidence_scanner',
        });
    }
  });
  it('handles parser failures and sanitized Zod fields without reflecting submitted data or custom messages', async () => {
    const app = fixture();
    const malformed = await request(app)
      .post('/validate')
      .set('Content-Type', 'application/json')
      .send('{');
    expect(malformed.status).toBe(400);
    expect(malformed.body.code).toBe('REQUEST_JSON_INVALID');
    const large = await request(app)
      .post('/validate')
      .send({ name: 'x'.repeat(150) });
    expect(large.status).toBe(413);
    expect(large.body.code).toBe('REQUEST_BODY_TOO_LARGE');
    const invalid = await request(app).post('/validate').send({ name: 'x' });
    expect(invalid.status).toBe(400);
    expect(invalid.body).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: [{ path: 'name', message: 'Value is below the required minimum' }],
    });
    expect(JSON.stringify(invalid.body)).not.toContain('secret');
  });
  it('retains only known transport arrangement fields', () => {
    expect(
      normalizeErrorEnvelope(
        409,
        {
          error: 'Complete departure record',
          code: 'TRANSPORT_ARRANGEMENT_REQUIRED',
          missingFields: ['origin', 'private secret', 'destination'],
        },
        'test',
      ).missingFields,
    ).toEqual(['origin', 'destination']);
  });
  it('gives missing routes a matching correlation ID', async () => {
    const result = await request(fixture()).get('/missing');
    expect(result.status).toBe(404);
    expect(result.body).toEqual({
      error: 'Not found',
      code: 'NOT_FOUND',
      requestId: result.headers['x-request-id'],
    });
  });
});
