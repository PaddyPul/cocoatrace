import { test, expect, type Page } from '@playwright/test';
const totals = {
  batches: { count: 1005, reviewed_count: 0 },
  products: { count: 1005, published_count: 1005, held_count: 1 },
  lots: { count: 1005, source_kg: '1005.000' },
  evidence: { count: 1005 },
  recalls: { count: 1, active_count: 0 },
  shipments: { count: 1005, active_count: 1002, delivered_count: 1, cancelled_count: 1 },
  farms: null,
  listings: null,
  contracts: null,
  offers: null,
  payments: null,
};
async function fixture(
  page: Page,
  options: { fail?: boolean; malformed?: boolean; restricted?: boolean } = {},
) {
  await page.addInitScript(() =>
    localStorage.setItem(
      'ct_user',
      JSON.stringify({
        id: 'overview',
        organizationId: 'party',
        orgType: 'exporter',
        permissions: ['batch.read', 'evidence.read', 'shipment.read'],
        roles: [],
        name: 'Trader',
      }),
    ),
  );
  let fail = options.fail;
  const legacy: string[] = [];
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/me') {
      await route.fulfill({
        json: {
          id: 'overview',
          organization_id: 'party',
          org_type: 'exporter',
          permissions: options.restricted ? [] : ['batch.read', 'evidence.read', 'shipment.read'],
          roles: [],
          name: 'Trader',
        },
      });
      return;
    }
    if (path === '/api/onboarding') {
      await route.fulfill({ json: { status: 'completed', primary_goal: 'sell' } });
      return;
    }
    if (path === '/api/workspace/overview') {
      if (fail) {
        fail = false;
        await route.fulfill({ status: 503, json: { error: 'Unavailable' } });
        return;
      }
      const row = options.restricted
        ? Object.fromEntries(
            Object.keys(totals).map((key) => [
              key,
              key === 'recalls' ? { count: 0, active_count: 0 } : null,
            ]),
          )
        : totals;
      await route.fulfill({ json: options.malformed ? { ...row, batches: { count: -1 } } : row });
      return;
    }
    if (path === '/api/readiness') {
      await route.fulfill({ status: 503, json: { error: 'Readiness unavailable' } });
      return;
    }
    if (
      [
        '/api/batches',
        '/api/product-profiles',
        '/api/traceability/lots',
        '/api/recalls',
        '/api/shipments',
        '/api/evidence',
      ].includes(path)
    ) {
      legacy.push(path);
      await route.fulfill({ status: 500, json: { error: 'Full arrays forbidden' } });
      return;
    }
    await route.fulfill({ json: [] });
  });
  return legacy;
}
test('overview uses complete counts without legacy lists, approval claims or invented network readiness', async ({
  page,
}) => {
  const legacy = await fixture(page);
  await page.goto('/dashboard');
  await expect(
    page.getByRole('heading', { name: 'Workspace overview', exact: true }),
  ).toBeVisible();
  const products = page.getByRole('button', { name: 'Open Published products', exact: true });
  await expect(products).toContainText('1005');
  await expect(
    page.getByRole('button', { name: 'Open Evidence records', exact: true }),
  ).toContainText('1005');
  await expect(
    page.getByRole('button', { name: 'Open Products with safety holds', exact: true }),
  ).toContainText('1');
  await expect(page.getByText('Approved evidence', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Network is operating normally', { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('alert').filter({ hasText: 'Material safety holds remain' }),
  ).toBeVisible();
  expect(legacy).toEqual([]);
  await products.click();
  await expect(page).toHaveURL(/\/products$/);
});
test('failed overview pauses recommendations and retries instead of showing zero or healthy state', async ({
  page,
}) => {
  await fixture(page, { fail: true });
  await page.goto('/dashboard');
  await expect(
    page.getByRole('alert').filter({ hasText: 'Workspace totals could not be refreshed' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Open Published products', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry workspace totals', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Open Published products', exact: true }),
  ).toContainText('1005');
});
test('malformed aggregate rejects the whole overview without inventing empty history', async ({
  page,
}) => {
  await fixture(page, { malformed: true });
  await page.goto('/dashboard');
  await expect(
    page.getByRole('alert').filter({ hasText: 'Workspace totals could not be refreshed' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Open Published products', exact: true }),
  ).toHaveCount(0);
});
test('missing resource permissions omit source and trade summaries and mission shortcuts', async ({
  page,
}) => {
  await fixture(page, { restricted: true });
  await page.goto('/dashboard');
  await expect(
    page.getByText('This account has no readable source or trade summaries.', { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Open Published products', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start mission', exact: true })).toHaveCount(0);
});
