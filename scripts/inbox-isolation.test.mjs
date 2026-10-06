import assert from 'node:assert/strict';
import http from 'node:http';
import { after, test } from 'node:test';
import { request } from '@playwright/test';

let mode = 'success';
const observed = [];
const appOrigin = 'http://127.0.0.1:13000';
let inboxOrigin;
const server = http.createServer((req, res) => {
  observed.push(req.headers);
  if (req.headers.origin !== inboxOrigin || req.headers.cookie || req.headers.authorization) {
    res.writeHead(403).end();
    return;
  }
  if (mode === 'denied') {
    res.writeHead(403).end('Private diagnostic body must not appear in errors');
    return;
  }
  res.setHeader('Content-Type', 'application/json');
  if (req.url.startsWith('/api/v1/messages?')) {
    res.end(JSON.stringify({ messages: [
      { ID: 'old', Subject: 'Verify email', To: [{ Address: 'person@browser.test' }] },
      { ID: 'new', Subject: 'Verify email', To: [{ Address: 'PERSON@browser.test' }] },
    ] }));
  } else {
    res.end(JSON.stringify({ Text: `${mode === 'foreign' ? 'https://foreign.invalid' : appOrigin}/verify-access?token=synthetic` }));
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
inboxOrigin = `http://127.0.0.1:${server.address().port}`;
process.env.COCOATRACE_BROWSER_BASE_URL = appOrigin;
process.env.COCOATRACE_BROWSER_INBOX_URL = inboxOrigin;
const { emailLink } = await import('../e2e/support/inbox.ts');
after(() => new Promise(resolve => server.close(resolve)));

test('inbox reads isolate app Origin, Authorization and session cookies and select the rotated link', async () => {
  mode = 'success';
  const app = await request.newContext({
    extraHTTPHeaders: { Origin: appOrigin, Authorization: 'Bearer synthetic' },
    storageState: { cookies: [{ name: 'ct_session', value: 'synthetic', domain: '127.0.0.1', path: '/', expires: -1, httpOnly: true, secure: false, sameSite: 'Lax' }], origins: [] },
  });
  try {
    assert.equal((await app.get(`${inboxOrigin}/api/v1/messages?limit=100`)).status(), 403);
    observed.length = 0;
    const result = await emailLink('person@browser.test', 'verification', 'old');
    assert.equal(result.id, 'new');
    assert.equal(result.link, `${appOrigin}/verify-access?token=synthetic`);
    assert.equal(observed.length, 2);
    for (const headers of observed) {
      assert.equal(headers.origin, inboxOrigin);
      assert.equal(headers.cookie, undefined);
      assert.equal(headers.authorization, undefined);
    }
  } finally {
    await app.dispose();
  }
});

test('inbox HTTP rejection fails immediately with status but no message contents', async () => {
  mode = 'denied';
  const start = Date.now();
  await assert.rejects(emailLink('person@browser.test', 'verification'), error => {
    assert.match(error.message, /Disposable inbox listing failed \(HTTP 403\)/);
    assert.doesNotMatch(error.message, /Private diagnostic|person@|synthetic/);
    return true;
  });
  assert.ok(Date.now() - start < 5000, 'HTTP rejection must not use the twenty-second missing-email poll');
});

test('captured identity links remain restricted to the disposable app origin', async () => {
  mode = 'foreign';
  await assert.rejects(emailLink('person@browser.test', 'verification'), /outside the disposable test origin/);
});
