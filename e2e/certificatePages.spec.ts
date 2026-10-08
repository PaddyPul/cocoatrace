import { test, expect, type Page } from '@playwright/test';
async function mock(page: Page, failure = false, malformed = false) {
  const seen: string[] = [];
  await page.addInitScript(() =>
    localStorage.setItem(
      'ct_user',
      JSON.stringify({
        id: 'certificate-user',
        organizationId: 'certificate-org',
        orgType: 'exporter',
        roles: [],
        permissions: ['certificate.read'],
        name: 'Certificate reader',
      }),
    ),
  );
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === '/api/me') {
      await route.fulfill({
        json: {
          id: 'certificate-user',
          organization_id: 'certificate-org',
          org_type: 'exporter',
          roles: [],
          permissions: ['certificate.read'],
          name: 'Certificate reader',
        },
      });
      return;
    }
    if (path === '/api/onboarding') {
      await route.fulfill({ json: { status: 'completed', primary_goal: 'sell' } });
      return;
    }
    if (path === '/api/certificates/summary') {
      await route.fulfill({
        json: {
          count: 1005,
          active_count: 1004,
          suspended_count: 1,
          revoked_count: 0,
          expired_count: 0,
        },
      });
      return;
    }
    if (path === '/api/certificates/page') {
      seen.push(url.search);
      if (failure) {
        failure = false;
        await route.fulfill({ status: 503, json: { error: 'Certificate register unavailable' } });
        return;
      }
      if (malformed) {
        await route.fulfill({ json: { items: [], hasMore: true, nextCursor: null } });
        return;
      }
      const later = Boolean(url.searchParams.get('cursor'));
      const search = url.searchParams.get('search');
      const suspended = url.searchParams.get('status') === 'suspended';
      const certificate = {
        id: later || search ? 'late-certificate' : 'first-certificate',
        farm_id: 'farm-one',
        standard: search ? 'OFFPAGE' : suspended ? 'SUSPENDED' : 'FIRST',
        certifier_name: 'Recorded issuer',
        status: suspended ? 'suspended' : 'active',
        valid_from: '2026-01-01',
        valid_to: '2027-01-01',
      };
      await route.fulfill({
        json: {
          items: [certificate],
          hasMore: !later && !search && !suspended,
          nextCursor: !later && !search && !suspended ? 'certificate-cursor' : null,
        },
      });
      return;
    }
    await route.fulfill({ status: 503, json: { error: 'Unexpected certificate fixture request' } });
  });
  return seen;
}
test('certificate register pages and searches server-side, preserving full totals', async ({
  page,
}) => {
  const seen = await mock(page);
  await page.goto('/certs');
  await expect(page.getByText('1005 accessible certificates', { exact: false })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'FIRST', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next certificates', exact: true }).click();
  await expect(page.getByText('Page 2', { exact: true })).toBeVisible();
  await page.getByLabel('Search certificates', { exact: true }).fill('OFFPAGE');
  await expect(page.getByRole('cell', { name: 'OFFPAGE', exact: true })).toBeVisible();
  await expect(page.getByText('Page 1', { exact: true })).toBeVisible();
  await page.getByLabel('Search certificates', { exact: true }).fill('');
  await page.getByLabel('Certificate status', { exact: true }).selectOption('suspended');
  await expect(page.getByRole('cell', { name: 'SUSPENDED', exact: true })).toBeVisible();
  expect(seen.some((query) => query.includes('cursor=certificate-cursor'))).toBe(true);
  expect(seen.some((query) => query.includes('search=OFFPAGE'))).toBe(true);
  expect(seen.some((query) => query.includes('status=suspended'))).toBe(true);
  await expect(page.getByRole('button', { name: '+ Issue Certificate', exact: true })).toHaveCount(
    0,
  );
});
test('certificate request failure has explicit retry rather than an empty history', async ({
  page,
}) => {
  await mock(page, true);
  await page.goto('/certs');
  await expect(
    page.getByRole('alert').filter({ hasText: 'Certificate register unavailable' }),
  ).toBeVisible();
  await expect(page.getByText('No certificates', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry certificates', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'FIRST', exact: true })).toBeVisible();
});
test('malformed certificate page cannot present an empty register', async ({ page }) => {
  await mock(page, false, true);
  await page.goto('/certs');
  await expect(page.getByRole('alert').filter({ hasText: 'Invalid page response.' })).toBeVisible();
  await expect(page.getByText('No certificates', { exact: true })).toHaveCount(0);
});
