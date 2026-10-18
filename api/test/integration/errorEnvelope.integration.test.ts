import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool } from '../../src/db';

afterAll(async () => {
  await pool.end();
});
describe('application JSON failure contract', () => {
  it('correlates actual authorization, validation, parser and missing-route failures', async () => {
    const checks = [
      { response: await request(app).get('/me'), status: 401, code: 'AUTHENTICATION_REQUIRED' },
      {
        response: await request(app).post('/auth/login').send({ email: 'invalid', password: '' }),
        status: 400,
        code: 'VALIDATION_ERROR',
      },
      {
        response: await request(app)
          .post('/auth/login')
          .set('Content-Type', 'application/json')
          .send('{'),
        status: 400,
        code: 'REQUEST_JSON_INVALID',
      },
      {
        response: await request(app).get('/missing-envelope-regression'),
        status: 404,
        code: 'NOT_FOUND',
      },
    ];
    for (const { response, status, code } of checks) {
      expect(response.status, JSON.stringify(response.body)).toBe(status);
      expect(response.body).toMatchObject({ code, requestId: response.headers['x-request-id'] });
      expect(typeof response.body.error).toBe('string');
      expect(JSON.stringify(response.body)).not.toMatch(/stack|sql/i);
    }
    expect((await request(app).get('/health/live')).body).toMatchObject({ status: 'ok' });
  });
});
