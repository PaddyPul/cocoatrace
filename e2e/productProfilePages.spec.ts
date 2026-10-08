import { test, expect, type Page } from '@playwright/test';
async function mock(
  page: Page,
  options: { failure?: boolean; malformed?: boolean; totalsFailure?: boolean; held?: boolean } = {},
) {
  const seen: string[] = [];
  let failed = false;
  const permissions = ['batch.read'];
  await page.addInitScript(
    ({ permissions }) =>
      localStorage.setItem(
        'ct_user',
        JSON.stringify({
          id: 'product-reader',
          organizationId: 'product-org',
          orgType: 'exporter',
          roles: [],
          permissions,
          name: 'Product reader',
        }),
      ),
    { permissions },
  );
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname;
    seen.push(path + url.search);
    if (path === '/api/me') {
      await route.fulfill({
        json: {
          id: 'product-reader',
          organization_id: 'product-org',
          org_type: 'exporter',
          roles: [],
          permissions,
          name: 'Product reader',
        },
      });
      return;
    }
    if (path === '/api/onboarding') {
      await route.fulfill({ json: { status: 'completed', primary_goal: 'sell' } });
      return;
    }
    if (path === '/api/product-profiles/summary') {
      if (options.totalsFailure) {
        await route.fulfill({ status: 503, json: { error: 'Unavailable' } });
        return;
      }
      await route.fulfill({ json: { count: 1005, published_count: 1004, held_count: 1 } });
      return;
    }
    if (path === '/api/product-profiles/page') {
      if (options.failure && !failed) {
        failed = true;
        await route.fulfill({ status: 503, json: { error: 'Products unavailable' } });
        return;
      }
      if (options.malformed) {
        await route.fulfill({ json: { items: [], hasMore: true, nextCursor: null } });
        return;
      }
      const later = Boolean(
        url.searchParams.get('search') ||
          url.searchParams.get('cursor') ||
          url.searchParams.get('visibility') === 'attention',
      );
      await route.fulfill({
        json: {
          items: [
            {
              id: later ? 'late-product' : 'first-product',
              batch_id: 'batch-one',
              slug: 'product-one',
              display_name: later ? 'LATE PRODUCT' : 'FIRST PRODUCT',
              description: '',
              lot_code: later ? 'LATE-LOT' : 'FIRST-LOT',
              visibility: 'published',
              profileUrl: '/p/product-one',
              qrSvgUrl: '/qr',
              crop: 'peanut',
              quantity_kg: 10,
              region: null,
              country: null,
              evidence_count: 2,
              scan_count: 3,
              safety_status: options.held ? 'warning' : 'clear',
              inventory_held: Boolean(options.held),
            },
          ],
          hasMore: !later,
          nextCursor: later ? null : 'products-next',
        },
      });
      return;
    }
    await route.fulfill({ status: 503, json: { error: 'Unused fixture path' } });
  });
  return seen;
}
test('product register searches and pages beyond page one with full independent totals', async ({
  page,
}) => {
  const seen = await mock(page);
  await page.goto('/products');
  await expect(page.getByText('1,005', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next product profiles', exact: true }).click();
  await expect(page.getByText('LATE PRODUCT', { exact: true })).toBeVisible();
  await page.getByLabel('Search product profiles', { exact: true }).fill('LATE');
  await expect(page.getByText('Page 1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'attention', exact: true }).click();
  await expect(page.getByText('LATE PRODUCT', { exact: true })).toBeVisible();
  expect(seen.some((value) => value.includes('cursor=products-next'))).toBe(true);
  expect(seen.some((value) => value.includes('visibility=attention'))).toBe(true);
  expect(seen.some((value) => value === '/api/product-profiles')).toBe(false);
});
test('product read failure retries without claiming an empty register', async ({ page }) => {
  await mock(page, { failure: true });
  await page.goto('/products');
  await expect(page.getByRole('alert')).toContainText('Products unavailable');
  await expect(page.getByText('No products found', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry product profiles', exact: true }).click();
  await expect(page.getByText('FIRST PRODUCT', { exact: true })).toBeVisible();
});
test('malformed product envelope is a visible error', async ({ page }) => {
  await mock(page, { malformed: true });
  await page.goto('/products');
  await expect(page.getByRole('alert')).toContainText('Invalid page response');
  await expect(page.getByText('No products found', { exact: true })).toHaveCount(0);
});
test('failed product totals do not invent zeros while scoped records remain usable', async ({
  page,
}) => {
  await mock(page, { totalsFailure: true });
  await page.goto('/products');
  await expect(page.getByRole('alert')).toContainText('Product totals unavailable');
  await expect(page.getByText('FIRST PRODUCT', { exact: true })).toBeVisible();
  await expect(page.getByText('0 published', { exact: true })).toHaveCount(0);
});
test('retained safety hold stays visible and evidence count makes no approval or origin claim', async ({
  page,
}) => {
  await mock(page, { held: true });
  await page.goto('/products');
  await expect(page.getByText('safety hold', { exact: true })).toBeVisible();
  await expect(page.getByText('2 recorded', { exact: true })).toBeVisible();
  await expect(page.getByText('Origin not recorded', { exact: true })).toBeVisible();
  await expect(page.getByText('2 approved', { exact: true })).toHaveCount(0);
  await expect(page.getByText('clear', { exact: true })).toHaveCount(0);
});
