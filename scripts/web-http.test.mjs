import test from 'node:test';
import assert from 'node:assert/strict';
import { api, getToken, setAuthToken } from '../web/src/api/http.ts';
import * as compatibility from '../web/src/api.ts';
import { auth } from '../web/src/api/identity.ts';
import { evidence } from '../web/src/api/evidence.ts';

function environment(run) {
  const originals = Object.fromEntries(
    ['fetch', 'window', 'localStorage'].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  const removed = [];
  const location = {
    href: '',
    assign(path) {
      this.href = path;
    },
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location } });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      removeItem(key) {
        removed.push(key);
      },
    },
  });
  return Promise.resolve()
    .then(() => run({ removed, location }))
    .finally(() => {
      setAuthToken(null);
      for (const [key, descriptor] of Object.entries(originals)) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    });
}

test('compatibility barrel and feature clients share the live session without persisting its bearer token', () =>
  environment(async ({ removed }) => {
    assert.equal(compatibility.api, api);
    assert.equal(compatibility.auth, auth);
    compatibility.setAuthToken('session-one');
    assert.equal(getToken(), 'session-one');
    const requests = [];
    globalThis.fetch = async (url, options) => {
      requests.push({ url, options });
      return Response.json({ id: 'me' });
    };
    await auth.me();
    setAuthToken('session-two');
    await compatibility.organizations.summary();
    assert.equal(requests[0].options.headers.Authorization, 'Bearer session-one');
    assert.equal(requests[1].options.headers.Authorization, 'Bearer session-two');
    assert.ok(requests.every((request) => request.options.credentials === 'include'));
    assert.deepEqual(removed, ['ct_token', 'ct_token']);
  }));

test('JSON requests keep validation errors while rejected login does not clear the workspace or navigate', () =>
  environment(async ({ removed, location }) => {
    setAuthToken('existing-session');
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/auth/login');
      assert.equal(options.headers['Content-Type'], 'application/json');
      assert.deepEqual(JSON.parse(options.body), { email: 'test@example.test', password: 'wrong' });
      return Response.json(
        { error: 'Invalid login', details: [{ message: 'Check credentials' }] },
        { status: 401 },
      );
    };
    await assert.rejects(
      auth.login('test@example.test', 'wrong'),
      /Invalid login: Check credentials/,
    );
    assert.equal(getToken(), 'existing-session');
    assert.equal(location.href, '');
    assert.deepEqual(removed, ['ct_token']);
  }));

test('expired feature request clears the shared session and redirects once its 401 is received', () =>
  environment(async ({ removed, location }) => {
    setAuthToken('expired');
    globalThis.fetch = async () => new Response('', { status: 401 });
    await assert.rejects(auth.me(), /Session expired/);
    assert.equal(compatibility.getToken(), null);
    assert.equal(location.href, '/login');
    assert.deepEqual(removed, ['ct_token', 'ct_token', 'ct_user']);
  }));

test('MFA enrollment denial navigates to passkeys and never retries the protected write', () =>
  environment(async ({ location }) => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return Response.json({ code: 'MFA_REQUIRED' }, { status: 403 });
    };
    await assert.rejects(
      api('POST', '/contracts/example/payment-terms', {}),
      /Passkey verification required/,
    );
    assert.equal(location.href, '/account/passkeys');
    assert.equal(calls, 1);
  }));

test('multipart and empty responses preserve browser encoding and successful sign-out handling', () =>
  environment(async () => {
    const body = new FormData();
    body.set('note', 'hello');
    globalThis.fetch = async (_url, options) => {
      assert.equal(options.body, body);
      assert.equal(options.headers['Content-Type'], undefined);
      return new Response(null, { status: 204 });
    };
    assert.deepEqual(await api('POST', '/example', body, true), {});
  }));

test('evidence download reads the latest shared bearer token after feature extraction', () =>
  environment(async () => {
    setAuthToken('download-session');
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/evidence/doc/download');
      assert.equal(options.headers.Authorization, 'Bearer download-session');
      assert.equal(options.credentials, 'include');
      return new Response('', { status: 403 });
    };
    await assert.rejects(evidence.download('doc', 'proof.pdf'), /Could not download document/);
  }));
