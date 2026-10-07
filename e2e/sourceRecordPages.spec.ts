import { test, expect, Page } from '@playwright/test';
async function fixture(page: Page, fail = false) {
  await page.addInitScript(() =>
    localStorage.setItem(
      'ct_user',
      JSON.stringify({
        id: 'supplier',
        organizationId: 'supplier',
        orgType: 'exporter',
        permissions: ['*'],
        roles: ['supplier_admin'],
        name: 'Supplier',
      }),
    ),
  );
  const queries: string[] = [];
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname;
    if (path === '/api/farms/page') {
      queries.push(url.search);
      if (fail) {
        await route.fulfill({ status: 503, json: { error: 'Farm read unavailable' } });
        return;
      }
      const later = Boolean(url.searchParams.get('search') || url.searchParams.get('cursor'));
      await route.fulfill({
        json: {
          items: [
            {
              id: later ? 'farm-later' : 'farm-first',
              name: later ? 'Later source' : 'First source',
              region: 'Northern',
              district: 'Tamale',
              country: 'GH',
              farmer_organization_id: 'supplier',
              verification_status: 'self_declared',
            },
          ],
          hasMore: !later,
          nextCursor: later ? null : 'next-farm',
        },
      });
      return;
    }
    if (path === '/api/batches/page') {
      const later = Boolean(url.searchParams.get('search') || url.searchParams.get('cursor'));
      await route.fulfill({
        json: {
          items: [
            {
              id: later ? 'batch-later' : 'batch-first',
              farm_id: 'farm-first',
              farm_name: later ? 'Later batch farm' : 'First batch farm',
              crop: 'shea',
              quantity_kg: 1,
              harvest_date: '2026-10-01',
              current_holder_id: 'supplier',
              organic_claim_status: 'self_declared',
            },
          ],
          hasMore: !later,
          nextCursor: later ? null : 'next-batch',
        },
      });
      return;
    }
    const json =
      path === '/api/me'
        ? {
            id: 'supplier',
            organization_id: 'supplier',
            org_type: 'exporter',
            permissions: ['*'],
            roles: ['supplier_admin'],
            name: 'Supplier',
          }
        : path === '/api/onboarding'
          ? { status: 'completed', primary_goal: 'sell' }
          : [];
    await route.fulfill({ json });
  });
  return queries;
}
test('farm list searches and pages without presenting a page count as a total', async ({
  page,
}) => {
  const queries = await fixture(page);
  await page.goto('/farms');
  await expect(page.getByRole('cell', { name: 'First source', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next farms', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Later source', exact: true })).toBeVisible();
  await page.getByLabel('Search farms', { exact: true }).fill('Later');
  await expect(page.getByRole('button', { name: 'Previous farms', exact: true })).toBeDisabled();
  await expect
    .poll(() =>
      queries.some((query) => query.includes('search=Later') && !query.includes('cursor=')),
    )
    .toBe(true);
  await expect(page.getByText('No farms registered', { exact: true })).toHaveCount(0);
});
test('batch list pages and harvest farm selector searches only owned farms while retaining selection across pages', async ({
  page,
}) => {
  const queries = await fixture(page);
  await page.goto('/batches');
  await expect(page.getByRole('cell', { name: 'First batch farm', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next batches', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Later batch farm', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '+ Create Batch', exact: true }).click();
  const selector = page.getByRole('region', { name: 'Source farm selector', exact: true });
  await selector.getByRole('button', { name: 'Next source farms', exact: true }).click();
  await selector.getByLabel('Select source farm', { exact: true }).selectOption('farm-later');
  await selector.getByRole('button', { name: 'Previous source farms', exact: true }).click();
  await expect(selector.getByLabel('Select source farm', { exact: true })).toHaveValue(
    'farm-later',
  );
  await selector.getByLabel('Search source farms', { exact: true }).fill('exact source');
  await expect(
    selector.getByRole('button', { name: 'Previous source farms', exact: true }),
  ).toBeDisabled();
  await expect
    .poll(() =>
      queries.some(
        (query) => query.includes('owned=true') && query.includes('search=exact+source'),
      ),
    )
    .toBe(true);
});
test('failed source read shows retry and keeps search controls available', async ({ page }) => {
  await fixture(page, true);
  await page.goto('/farms');
  await expect(page.getByRole('alert')).toContainText('Farm read unavailable');
  await expect(page.getByRole('button', { name: 'Retry farms', exact: true })).toBeEnabled();
  await expect(page.getByLabel('Search farms', { exact: true })).toBeVisible();
  await expect(page.getByText('No farms registered', { exact: true })).toHaveCount(0);
});
