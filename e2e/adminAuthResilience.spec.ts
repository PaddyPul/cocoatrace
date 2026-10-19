import { test, expect } from '@playwright/test';

test('unavailable and malformed passkey reads remain unknown and explicit retry never performs enrollment', async ({
  page,
}) => {
  const user = {
    id: 'passkey-read-user',
    organizationId: 'passkey-read-org',
    orgType: 'importer',
    roles: ['buyer'],
    permissions: ['offer.create'],
    name: 'Pilot Buyer',
    mfa: { required: false, verified: false },
  };
  let reads = 0;
  let writes = 0;
  await page.addInitScript((value) => localStorage.setItem('ct_user', JSON.stringify(value)), user);
  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    if (route.request().method() !== 'GET') writes++;
    if (pathname === '/api/me')
      return route.fulfill({
        json: { ...user, organization_id: user.organizationId, org_type: user.orgType },
      });
    if (pathname === '/api/onboarding')
      return route.fulfill({ json: { status: 'completed', pilot_mode: true } });
    if (pathname === '/api/auth/mfa/keys') {
      reads++;
      if (reads === 1)
        return route.fulfill({ status: 503, json: { error: 'Passkey read unavailable' } });
      if (reads === 2) return route.fulfill({ json: { keys: [{ id: 'broken' }] } });
      return route.fulfill({
        json: { keys: [{ id: 'retained-key', label: 'Retained device key' }] },
      });
    }
    return route.fulfill({ json: {} });
  });
  await page.goto('/account/passkeys');
  await expect(page.getByRole('alert')).toContainText('Existing protection is unknown');
  await expect(page.getByRole('button', { name: 'Enroll passkey', exact: true })).toBeDisabled();
  await expect(page.getByText('No enrolled passkeys were returned for this account.')).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Retry passkeys', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Invalid passkey list response');
  await page.getByRole('button', { name: 'Retry passkeys', exact: true }).click();
  await expect(page.getByText('Retained device key', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Add a backup passkey', exact: true }),
  ).toBeEnabled();
  expect(writes).toBe(0);
});

test('invitation read failure retries without creating an account or losing the unavailable distinction', async ({
  page,
}) => {
  let reads = 0;
  let writes = 0;
  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    if (route.request().method() !== 'GET') writes++;
    if (pathname === '/api/auth/invitations/read-retry-token') {
      reads++;
      if (reads === 1)
        return route.fulfill({ status: 503, json: { error: 'Invitation read unavailable' } });
      return route.fulfill({
        json: {
          email: 'invited@example.test',
          organization_name: 'Invited organization',
          role: 'buyer',
        },
      });
    }
    return route.fulfill({ json: {} });
  });
  await page.goto('/accept-invite/read-retry-token');
  await expect(
    page.getByRole('heading', { name: 'Invitation unavailable', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Retry invitation', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Create your workspace', exact: true }),
  ).toBeVisible();
  expect(writes).toBe(0);
});
