import test from 'node:test';
import assert from 'node:assert/strict';
import { projectStatus, observeService } from '../web/src/components/serviceStatus/status.ts';
test('health observations never promote malformed, rejected or missing state to available', () => {
  assert.equal(projectStatus(true, { status: 'ok' }, 'ok'), 'available');
  assert.equal(projectStatus(true, { status: 'ready' }, 'ready'), 'available');
  assert.equal(projectStatus(false, { status: 'not_ready' }, 'ready'), 'unavailable');
  for (const value of [null, [], {}, { status: 'ok' }, { status: 'unknown' }])
    assert.equal(projectStatus(true, value, 'ready'), 'unknown');
  assert.equal(projectStatus(false, { status: 'ready' }, 'ready'), 'unknown');
});
test('public checks omit credentials, avoid cache and project only fixed status fields', async () => {
  const seen = [];
  const signal = new AbortController().signal;
  const result = await observeService(async (url, options) => {
    seen.push({ url, options });
    return new Response(
      JSON.stringify({
        status: String(url).endsWith('/live') ? 'ok' : 'ready',
        secret: 'must-not-project',
      }),
      { status: 200 },
    );
  }, signal);
  assert.deepEqual(result, { process: 'available', dependencies: 'available' });
  assert.equal(seen.length, 2);
  for (const { options } of seen) {
    assert.equal(options.credentials, 'omit');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.signal, signal);
    assert.deepEqual(options.headers, { Accept: 'application/json' });
  }
  assert.ok(!JSON.stringify(result).includes('secret'));
});
test('network and invalid JSON failures stay unknown and do not retry', async () => {
  let calls = 0;
  const result = await observeService(async () => {
    calls++;
    throw new Error('provider secret');
  }, new AbortController().signal);
  assert.deepEqual(result, { process: 'unknown', dependencies: 'unknown' });
  assert.equal(calls, 2);
  assert.equal(
    (await observeService(async () => new Response('<html>'), new AbortController().signal))
      .dependencies,
    'unknown',
  );
});
