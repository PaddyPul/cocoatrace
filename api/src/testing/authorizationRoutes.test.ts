import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import app from '../app';
import { pool } from '../db';

type Route = { method: string; path: string; authentication: string };
const register = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../docs/security/route-authorization.json'),
    'utf8',
  ),
) as { routes: Route[] };
const protectedRoutes = register.routes.filter((row) => row.authentication === 'session');
const concrete = (route: string) =>
  route.replace(/:([A-Za-z_]+)/g, (_, name: string) =>
    name === 'kind' ? 'users' : '11111111-1111-4111-8111-111111111111',
  );
type Layer = {
  route?: { path: unknown; methods: Record<string, boolean> };
  handle?: { stack?: Layer[] };
};
function runtimeRoutes(layers: Layer[]): string[] {
  return layers.flatMap((layer) => {
    if (layer.route) {
      if (typeof layer.route.path !== 'string')
        throw new Error('Non-literal runtime route needs inventory support');
      return Object.entries(layer.route.methods)
        .filter(([, enabled]) => enabled)
        .map(([method]) => method.toUpperCase() + ' ' + layer.route!.path);
    }
    return layer.handle?.stack ? runtimeRoutes(layer.handle.stack) : [];
  });
}
async function invoke(method: string, url: string, token?: string) {
  const agent = request(app);
  const call =
    method === 'GET'
      ? agent.get(url)
      : method === 'HEAD'
        ? agent.head(url)
        : method === 'POST'
          ? agent.post(url)
          : method === 'PUT'
            ? agent.put(url)
            : method === 'PATCH'
              ? agent.patch(url)
              : method === 'DELETE'
                ? agent.delete(url)
                : undefined;
  if (!call) throw new Error('Unsupported protected HTTP method ' + method);
  return (token ? call.set('Authorization', `Bearer ${token}`) : call).timeout({
    response: 3000,
    deadline: 5000,
  });
}
afterAll(async () => {
  await pool.end();
});
describe('complete registered-route credential boundary without database access', () => {
  it('matches the actual Express route stack including router factories and nested registrations', () => {
    const runtime = runtimeRoutes(
      (app as unknown as { _router: { stack: Layer[] } })._router.stack,
    ).sort();
    const expected = register.routes.map((row) => row.method + ' ' + row.path).sort();
    expect(runtime).toEqual(expected);
    expect(new Set(runtime).size).toBe(runtime.length);
  });
  it.each(protectedRoutes)(
    '$method $path denies missing and invalid credentials before resource processing',
    async (route) => {
      const url = concrete(route.path);
      for (const token of [undefined, 'boundary-regression.invalid.signature']) {
        const response = await invoke(route.method, url, token);
        expect(
          response.status,
          `${route.method} ${route.path}: ${JSON.stringify(response.body)}`,
        ).toBe(401);
      }
      if (route.method === 'GET') expect((await invoke('HEAD', url)).status).toBe(401);
    },
  );
});
