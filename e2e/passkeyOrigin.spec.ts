import { test, expect } from '@playwright/test';

test('legacy IP rehearsal explains localhost and prevents passkey writes while preserving account state', async ({
  page,
  baseURL,
}) => {
  const user = {
    id: 'local-passkey-origin-user',
    organizationId: 'local-passkey-origin-org',
    orgType: 'importer',
    roles: ['buyer'],
    permissions: ['offer.create'],
    name: 'Synthetic Buyer',
    mfa: { required: false, verified: false },
  };
  let writes = 0;
  await page.addInitScript((value) => localStorage.setItem('ct_user', JSON.stringify(value)), user);
  await page.route('**/api/**', async (route) => {
    if (route.request().method() !== 'GET') writes++;
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/me')
      return route.fulfill({
        json: { ...user, organization_id: user.organizationId, org_type: user.orgType },
      });
    if (pathname === '/api/onboarding')
      return route.fulfill({ json: { status: 'completed', pilot_mode: true } });
    if (pathname === '/api/auth/mfa/keys') return route.fulfill({ json: { keys: [] } });
    return route.fulfill({ json: {} });
  });
  const legacy = new URL('/account/passkeys', baseURL!);
  legacy.hostname = '127.0.0.1';
  await page.goto(legacy.toString());
  await expect(page.getByRole('alert')).toContainText('Passkeys cannot use an IP address');
  await expect(page.getByRole('button', { name: 'Enroll passkey', exact: true })).toBeDisabled();
  const canonical = new URL('/account/passkeys', baseURL!);
  canonical.hostname = 'localhost';
  await expect(page.getByRole('link', { name: 'Open localhost for passkeys' })).toHaveAttribute(
    'href',
    canonical.toString(),
  );
  expect(writes).toBe(0);
  await page.goto(canonical.toString());
  await expect(page.getByRole('button', { name: 'Enroll passkey', exact: true })).toBeEnabled();
  await expect(page.getByRole('link', { name: 'Open localhost for passkeys' })).toHaveCount(0);
  expect(writes).toBe(0);
});
