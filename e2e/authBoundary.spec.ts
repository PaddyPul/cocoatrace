import { request as apiRequest } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { baseURL } from './support/environment';
import { createWorkspace } from './support/identity';

test('cookie writes reject absent/foreign origin and malformed-header bypass while normal sign-out works', async ({ page, browser }) => {
  await createWorkspace(page, browser, 'buyer');
  // An independently constructed API client deliberately has no default Origin.
  const client = await apiRequest.newContext({ baseURL, storageState: await page.context().storageState() });
  try {
    const absent = await client.post('/api/auth/logout');
    expect(absent.status()).toBe(403);
    expect((await absent.json()).code).toBe('ORIGIN_NOT_PERMITTED');
    const bypass = await client.post('/api/auth/logout', { headers: { Origin: 'https://attacker.test', Authorization: 'Basic malformed', 'X-Forwarded-Host': 'attacker.test' } });
    expect(bypass.status()).toBe(403);
    const malformed = await client.post('/api/auth/logout', { headers: { Origin: baseURL, Authorization: 'Basic malformed' } });
    expect(malformed.status()).toBe(401);
    expect((await client.get('/api/me')).status()).toBe(200);
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect((await client.get('/api/me')).status()).toBe(401);
  } finally { await client.dispose(); }
});
