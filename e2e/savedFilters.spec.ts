import { test, expect, type Page } from '@playwright/test';
async function fixture(page: Page, mode: 'normal' | 'malformed' | 'blocked' = 'normal') {
  await page.addInitScript(
    ({ mode }) => {
      localStorage.setItem(
        'ct_user',
        JSON.stringify({
          id: 'filter-user',
          organizationId: 'filter-org',
          orgType: 'exporter',
          permissions: ['*'],
          roles: ['supplier_admin'],
          name: 'Filter User',
        }),
      );
      localStorage.setItem(
        'ct_saved_filters:v1:other-user:filter-org:offers',
        JSON.stringify([
          {
            id: '12345678-1234-1234-1234-123456789abc',
            name: 'Other account private filter',
            values: { search: 'private' },
          },
        ]),
      );
      localStorage.setItem(
        'ct_saved_filters:v1:filter-user:other-org:offers',
        JSON.stringify([
          {
            id: '12345678-1234-1234-1234-123456789abc',
            name: 'Other organization private filter',
            values: { search: 'private' },
          },
        ]),
      );
      if (mode === 'malformed')
        localStorage.setItem('ct_saved_filters:v1:filter-user:filter-org:offers', '{broken');
      if (mode === 'blocked') {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (key.startsWith('ct_saved_filters:'))
            throw new DOMException('Blocked', 'SecurityError');
          return original.call(this, key, value);
        };
      }
    },
    { mode },
  );
  const requests: string[] = [];
  const mutations: string[] = [];
  const unexpected: string[] = [];
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== 'GET') mutations.push(`${request.method()} ${url.pathname}`);
    if (url.pathname === '/api/me')
      return route.fulfill({
        json: {
          id: 'filter-user',
          organization_id: 'filter-org',
          org_type: 'exporter',
          permissions: ['*'],
          roles: ['supplier_admin'],
          name: 'Filter User',
        },
      });
    if (url.pathname === '/api/onboarding')
      return route.fulfill({ json: { status: 'completed', primary_goal: 'sell' } });
    if (url.pathname === '/api/offers/summary')
      return route.fulfill({
        json: { received_count: 2, sent_count: 0, received_pending: 0, sent_pending: 0 },
      });
    if (url.pathname === '/api/offers/page') {
      requests.push(url.search);
      return route.fulfill({
        json: {
          items: [],
          hasMore: !url.searchParams.has('cursor'),
          nextCursor: url.searchParams.has('cursor') ? null : 'second-page',
        },
      });
    }
    unexpected.push(`${request.method()} ${url.pathname}`);
    return route.fulfill({ status: 404, json: { error: 'Unexpected fixture endpoint' } });
  });
  return { requests, mutations, unexpected };
}
test('device-local filters save, survive reload, apply to first page and delete', async ({
  page,
}) => {
  const { requests, mutations, unexpected } = await fixture(page);
  await page.goto('/offers');
  await expect(
    page
      .getByLabel('Saved filter', { exact: true })
      .getByRole('option', { name: /Other (account|organization) private filter/ }),
  ).toHaveCount(0);
  await page.getByLabel('Search offers', { exact: true }).fill('cocoa');
  await page.getByLabel('Saved filter name', { exact: true }).fill('Cocoa offers');
  await page.getByRole('button', { name: 'Save current filters', exact: true }).click();
  await page.reload();
  await page.getByLabel('Saved filter', { exact: true }).selectOption({ label: 'Cocoa offers' });
  await page.getByRole('button', { name: 'Apply saved filter', exact: true }).click();
  await expect(page.getByLabel('Search offers', { exact: true })).toHaveValue('cocoa');
  await page.getByRole('button', { name: 'Next offers', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Page 2' })).toBeVisible();
  await page.getByRole('button', { name: 'Apply saved filter', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Page 1' })).toBeVisible();
  await expect.poll(() => new URLSearchParams(requests.at(-1)).has('cursor')).toBe(false);
  await page.getByRole('button', { name: 'Delete saved filter', exact: true }).click();
  await page.reload();
  await expect(
    page
      .getByLabel('Saved filter', { exact: true })
      .getByRole('option', { name: 'Cocoa offers', exact: true }),
  ).toHaveCount(0);
  expect(mutations).toEqual([]);
  expect(unexpected).toEqual([]);
});
for (const mode of ['malformed', 'blocked'] as const)
  test(`${mode} storage shows session-only notice and preserves existing bytes`, async ({
    page,
  }) => {
    const { mutations, unexpected } = await fixture(page, mode);
    await page.goto('/offers');
    await page.getByLabel('Saved filter name', { exact: true }).fill('Session preset');
    await page.getByRole('button', { name: 'Save current filters', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'session-only' })).toBeVisible();
    await page
      .getByLabel('Saved filter', { exact: true })
      .selectOption({ label: 'Session preset' });
    await page.getByRole('button', { name: 'Apply saved filter', exact: true }).click();
    expect(
      await page.evaluate(() =>
        localStorage.getItem('ct_saved_filters:v1:filter-user:filter-org:offers'),
      ),
    ).toBe(mode === 'malformed' ? '{broken' : null);
    expect(mutations).toEqual([]);
    expect(unexpected).toEqual([]);
  });
