import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseWorkspaceEnvironment,
  readWorkspaceEnvironment,
} from '../web/src/components/environment/environment.ts';

test('only recognized successful server environment responses can label a workspace', () => {
  for (const environment of ['demo', 'development', 'test', 'staging', 'production'])
    assert.equal(parseWorkspaceEnvironment({ status: 'ok', environment }), environment);
  for (const input of [
    null,
    {},
    { status: 'error', environment: 'production' },
    { status: 'ok', environment: 'live' },
    { status: 'ok', environment: ['production'] },
  ])
    assert.equal(parseWorkspaceEnvironment(input), 'unknown');
});
test('public environment probe cannot forward a workspace cookie or bearer credential', async () => {
  const signal = new AbortController().signal;
  const fetcher = async (url, options) => {
    assert.equal(url, '/api/health/live');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.signal, signal);
    assert.deepEqual(options.headers, { Accept: 'application/json' });
    return { ok: true, json: async () => ({ status: 'ok', environment: 'staging' }) };
  };
  assert.equal(await readWorkspaceEnvironment(fetcher, signal), 'staging');
});
test('unavailable, malformed and aborted probes never claim production or demo', async () => {
  for (const fetcher of [
    async () => {
      throw new Error('offline');
    },
    async () => ({ ok: false }),
    async () => ({
      ok: true,
      json: async () => {
        throw new Error('not JSON');
      },
    }),
  ])
    assert.equal(await readWorkspaceEnvironment(fetcher, new AbortController().signal), 'unknown');
});
