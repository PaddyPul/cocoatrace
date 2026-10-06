import http from 'node:http';
import { request as apiRequest, test, expect } from '@playwright/test';
import { baseURL } from './support/environment';

// Run under the actual Playwright runner: standalone Node does not apply use headers.
test('explicit empty API headers remove inherited Origin while preserving the test cookie', async () => {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ origin: req.headers.origin ?? null, cookie: req.headers.cookie ?? null }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Disposable request probe failed to bind');
  const target = `http://127.0.0.1:${address.port}`;
  const inherited = await apiRequest.newContext();
  const isolated = await apiRequest.newContext({
    extraHTTPHeaders: {},
    storageState: {
      cookies: [{ name: 'ct_session', value: 'synthetic-probe', domain: '127.0.0.1', path: '/', expires: -1, httpOnly: true, secure: false, sameSite: 'Lax' }],
      origins: [],
    },
  });
  try {
    expect((await (await inherited.post(target)).json()).origin).toBe(baseURL);
    const observed = await (await isolated.post(target)).json();
    expect(observed.origin).toBeNull();
    expect(observed.cookie).toBe('ct_session=synthetic-probe');
  } finally {
    await inherited.dispose();
    await isolated.dispose();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
