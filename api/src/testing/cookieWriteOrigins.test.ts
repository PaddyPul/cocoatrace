import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';
import app from '../app';
import { config } from '../config/env';
import { pool } from '../db';
import logger from '../logger';

type Route = { method: string; path: string };
type Layer = {
  route?: { path: unknown; methods: Record<string, boolean> };
  handle?: { stack?: Layer[] };
};
const originalLogLevel = logger.level;
logger.level = 'silent';
const writes = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const register = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../docs/security/route-authorization.json'),
    'utf8',
  ),
) as { routes: Route[] };
const routes = register.routes.filter((route) => writes.has(route.method));
const permitted = new URL(config.webUrl).origin;
const foreign =
  permitted === 'https://origin-boundary.invalid'
    ? 'https://other.invalid'
    : 'https://origin-boundary.invalid';
const cookie = 'ct_session=origin-boundary.invalid.signature';
const queryProbe = vi.spyOn(pool, 'query');
const connectProbe = vi.spyOn(pool, 'connect');
function runtimeWrites(layers: Layer[]): string[] {
  return layers.flatMap((layer) => {
    if (!layer.route) return layer.handle?.stack ? runtimeWrites(layer.handle.stack) : [];
    if (typeof layer.route.path !== 'string')
      throw new Error('Non-literal route requires explicit inventory support');
    return Object.entries(layer.route.methods)
      .filter(([method, enabled]) => enabled && writes.has(method.toUpperCase()))
      .map(([method]) => `${method.toUpperCase()} ${layer.route!.path}`);
  });
}
function invoke(route: Route) {
  const url = route.path.replace(/:([A-Za-z_]+)/g, (_, name: string) =>
    name === 'kind' ? 'users' : '11111111-1111-4111-8111-111111111111',
  );
  const client = request(app);
  const call =
    route.method === 'POST'
      ? client.post(url)
      : route.method === 'PUT'
        ? client.put(url)
        : route.method === 'PATCH'
          ? client.patch(url)
          : client.delete(url);
  return call.set('Cookie', cookie).timeout({ response: 3000, deadline: 5000 });
}
const scenarios: { name: string; origin?: string; authorization?: string; spoof?: boolean }[] = [
  { name: 'absent origin' },
  { name: 'foreign origin', origin: foreign },
  { name: 'opaque null origin', origin: 'null' },
  { name: 'malformed bearer without origin', authorization: 'Bearer token extra' },
  { name: 'basic authorization without origin', authorization: 'Basic invalid' },
  {
    name: 'malformed bearer with foreign origin',
    authorization: 'Bearer token extra',
    origin: foreign,
  },
  {
    name: 'canonical bearer with foreign origin',
    authorization: 'Bearer invalid-token',
    origin: foreign,
  },
  { name: 'forged target identity', origin: foreign, spoof: true },
];
afterAll(async () => {
  try {
    expect(queryProbe).not.toHaveBeenCalled();
    expect(connectProbe).not.toHaveBeenCalled();
  } finally {
    logger.level = originalLogLevel;
    queryProbe.mockRestore();
    connectProbe.mockRestore();
    await pool.end();
  }
});
describe('every registered cookie write rejects untrusted browser origins before resource processing', () => {
  it('covers all actual runtime state-changing routes including public and upload entry points', () => {
    const actual = runtimeWrites(
      (app as unknown as { _router: { stack: Layer[] } })._router.stack,
    ).sort();
    expect(routes.length).toBeGreaterThan(0);
    expect(actual).toEqual(routes.map((route) => `${route.method} ${route.path}`).sort());
    expect(new Set(actual).size).toBe(actual.length);
  });
  it.each(routes)('$method $path enforces every origin rejection scenario', async (route) => {
    for (const scenario of scenarios) {
      let call = invoke(route);
      if (scenario.origin !== undefined) call = call.set('Origin', scenario.origin);
      if (scenario.authorization !== undefined)
        call = call.set('Authorization', scenario.authorization);
      if (scenario.spoof)
        call = call
          .set('Host', new URL(foreign).host)
          .set('X-Forwarded-Host', new URL(foreign).host)
          .set('X-Forwarded-Proto', 'https')
          .set('X-Forwarded-For', '127.0.0.1')
          .set('Forwarded', `host=${new URL(foreign).host};proto=https`);
      const response = await call;
      expect(response.status, `${route.method} ${route.path}: ${scenario.name}`).toBe(403);
      expect(response.body.code).toBe('ORIGIN_NOT_PERMITTED');
    }
  });
  it('passes the configured browser origin through to credential validation without treating it as authentication', async () => {
    const response = await invoke({ method: 'POST', path: '/auth/logout' }).set(
      'Origin',
      permitted,
    );
    expect(response.status).toBe(401);
    expect(response.body.code).not.toBe('ORIGIN_NOT_PERMITTED');
  });
  it('retains canonical bearer precedence without exempting supplied foreign origins', async () => {
    const response = await invoke({ method: 'POST', path: '/auth/logout' }).set(
      'Authorization',
      'Bearer invalid-token',
    );
    expect(response.status).toBe(401);
    expect(response.body.code).not.toBe('ORIGIN_NOT_PERMITTED');
  });
});
