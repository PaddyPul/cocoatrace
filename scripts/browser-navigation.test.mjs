import test from 'node:test';
import assert from 'node:assert/strict';
import { gotoWithNetworkRecovery } from '../e2e/support/navigation.ts';

test('a successful navigation runs once with its original options and result', async () => {
  const calls = [];
  const result = { status: 200 };
  const page = {
    goto: async (...args) => {
      calls.push(args);
      return result;
    },
  };
  const options = { waitUntil: 'load', timeout: 1234 };
  assert.equal(await gotoWithNetworkRecovery(page, '/farms/farm-one', options), result);
  assert.deepEqual(calls, [['/farms/farm-one', options]]);
});
test('only ERR_NETWORK_CHANGED retries the original document navigation once', async () => {
  let calls = 0;
  const page = {
    goto: async () => {
      if (++calls === 1) throw new Error('page.goto: net::ERR_NETWORK_CHANGED');
      return 'loaded';
    },
  };
  assert.equal(await gotoWithNetworkRecovery(page, '/batches/batch-one'), 'loaded');
  assert.equal(calls, 2);
});
test('a repeated network change fails after two attempts without restarting the test', async () => {
  let calls = 0;
  const failure = new Error('page.goto: net::ERR_NETWORK_CHANGED');
  const page = {
    goto: async () => {
      calls++;
      throw failure;
    },
  };
  await assert.rejects(
    gotoWithNetworkRecovery(page, '/farms/farm-one'),
    (error) => error === failure,
  );
  assert.equal(calls, 2);
});
test('timeouts, HTTP failures and other network errors do not receive a retry', async () => {
  for (const message of [
    'Timeout 30000ms exceeded',
    'net::ERR_CONNECTION_REFUSED',
    'net::ERR_ABORTED',
  ]) {
    let calls = 0;
    const failure = new Error(message);
    const page = {
      goto: async () => {
        calls++;
        throw failure;
      },
    };
    await assert.rejects(
      gotoWithNetworkRecovery(page, '/farms/farm-one'),
      (error) => error === failure,
    );
    assert.equal(calls, 1);
  }
  let calls = 0;
  const response = { status: 500 };
  assert.equal(
    await gotoWithNetworkRecovery(
      {
        goto: async () => {
          calls++;
          return response;
        },
      },
      '/farms/farm-one',
    ),
    response,
  );
  assert.equal(calls, 1);
});
test('API endpoints and external origins are refused before any navigation', async () => {
  let calls = 0;
  for (const path of [
    '/api/contracts',
    'https://example.com/',
    'http://user:password@localhost:13000/',
  ])
    await assert.rejects(
      gotoWithNetworkRecovery(
        {
          goto: async () => {
            calls++;
          },
        },
        path,
      ),
      /restricted/,
    );
  assert.equal(calls, 0);
});
