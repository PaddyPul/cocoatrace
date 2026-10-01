import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from './app';

describe('HTTP request correlation', () => {
  it('echoes a safe caller request ID in the response', async () => {
    const response = await request(app).get('/health/live').set('X-Request-Id', 'pilot-check-123');

    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBe('pilot-check-123');
  });

  it('generates a response request ID when the caller does not provide one', async () => {
    const response = await request(app).get('/health/live');

    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});
