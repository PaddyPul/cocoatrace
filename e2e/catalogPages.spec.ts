import { test, expect, Page } from '@playwright/test';

async function mock(page: Page, failedTotals = false, malformedTransfers = false) {
  await page.addInitScript(() =>
    localStorage.setItem(
      'ct_user',
      JSON.stringify({
        id: 'seller',
        organizationId: 'supplier',
        orgType: 'exporter',
        roles: ['supplier_admin'],
        permissions: ['*'],
        name: 'Seller',
      }),
    ),
  );
  const requests: string[] = [];
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname;
    if (failedTotals && path.endsWith('/summary')) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Summary unavailable' }),
      });
      return;
    }
    if (path === '/api/transfers/page') {
      await route.fulfill({
        json: malformedTransfers ? [] : { items: [], hasMore: false, nextCursor: null },
      });
      return;
    }
    if (path === '/api/holdings/page') {
      requests.push(url.search);
      const later = Boolean(url.searchParams.get('search') || url.searchParams.get('cursor'));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: later ? 'holding-later' : 'holding-first',
              crop: later ? 'shea' : 'peanut',
              quantity_kg: 10,
              status: 'available',
              warehouse_location: 'Warehouse',
            },
          ],
          hasMore: !later,
          nextCursor: later ? null : 'next-stock',
        }),
      });
      return;
    }
    if (path === '/api/listings/page') {
      const later = Boolean(
        url.searchParams.get('cursor') ||
          url.searchParams.get('search') ||
          url.searchParams.get('id'),
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: later ? 'later-supply' : 'first-supply',
              source_name: later ? 'Later supply' : 'First supply',
              crop: 'peanut',
              source_mode: 'direct_inventory',
              seller_name: 'Supplier',
              available_quantity_kg: 10,
              price_per_kg: 5,
              currency: 'EUR',
              incoterm: 'FOB',
            },
          ],
          hasMore: !later,
          nextCursor: later ? null : 'next-supply',
        }),
      });
      return;
    }
    const body =
      path === '/api/me'
        ? {
            id: 'seller',
            organization_id: 'supplier',
            org_type: 'exporter',
            roles: ['supplier_admin'],
            permissions: ['*'],
            name: 'Seller',
          }
        : path === '/api/onboarding'
          ? { status: 'completed', primary_goal: 'sell' }
          : path === '/api/holdings/summary'
            ? { count: 1005, available_count: 1005, available_kg: '1005', commodities: ['peanut'] }
            : path === '/api/listings/summary'
              ? { count: 2000, own_count: 1005, quantity_kg: '2000' }
              : [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
  return requests;
}

test('inventory and publish selector navigate pages and search records beyond page one', async ({
  page,
}) => {
  const requests = await mock(page);
  await page.goto('/holdings');
  await expect(page.getByRole('cell', { name: 'peanut', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next inventory', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'shea', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Previous inventory', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'peanut', exact: true })).toBeVisible();
  await page.getByLabel('Search inventory', { exact: true }).fill('Later warehouse');
  await page.getByRole('button', { name: 'Search inventory', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'shea', exact: true })).toBeVisible();
  expect(
    requests.some(
      (query) => query.includes('search=Later+warehouse') && !query.includes('cursor='),
    ),
  ).toBe(true);
  await page.goto('/supply/new');
  await expect(page.getByRole('button', { name: /peanut.*10 kg/ })).toBeVisible();
  await page.getByRole('button', { name: 'Next inventory', exact: true }).click();
  await expect(page.getByRole('button', { name: /shea.*10 kg/ })).toBeVisible();
  await expect(page.getByText('Inventory required', { exact: true })).toHaveCount(0);
});

test('marketplace navigates and highlights an off-page published listing without applying an old request filter', async ({
  page,
}) => {
  await mock(page);
  await page.goto('/marketplace');
  await expect(page.getByRole('heading', { name: 'First supply', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next supply', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Later supply', exact: true })).toBeVisible();
  await page.getByLabel('Search marketplace supply', { exact: true }).fill('Later');
  await expect(page.getByRole('button', { name: 'Previous supply', exact: true })).toBeDisabled();
  await page.goto('/marketplace?published=later-supply');
  await expect(
    page.getByText('Your supply is visible in the marketplace', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Later supply', exact: true })).toBeVisible();
});

test('supplier home uses full aggregate counts, not the first inventory page', async ({ page }) => {
  await mock(page);
  await page.goto('/home?mode=sell');
  await expect(page.getByText('1005', { exact: true })).toBeVisible();
  const nextAction = page.locator('#supplier-path');
  await expect(nextAction.getByTestId('supply-path-choice')).toHaveCount(0);
  await expect(
    nextAction.getByText('Keep published supply current', { exact: true }),
  ).toBeVisible();
  await expect(
    nextAction.getByRole('button', { name: /^Keep published supply current/ }),
  ).toBeVisible();
  await expect(page.locator('#create-supply').getByTestId('supply-path-choice')).toBeVisible();
  await expect(
    page.locator('#create-supply').getByRole('button', { name: 'Create inventory', exact: true }),
  ).toBeVisible();
  await nextAction.getByRole('button', { name: /^Keep published supply current/ }).click();
  await expect(page).toHaveURL(/\/my-listings(?:\?|$)/);
});

test('failed supply summaries pause setup recommendations instead of showing an empty inventory', async ({
  page,
}) => {
  await mock(page, true);
  await page.goto('/home?mode=sell');
  await expect(page.getByRole('alert')).toContainText('Supply totals could not be refreshed');
  await expect(page.getByTestId('supply-path-choice')).toHaveCount(0);
});

test('malformed transfer page stays a panel error and does not hide inventory', async ({
  page,
}) => {
  await mock(page, false, true);
  await page.goto('/holdings');
  await expect(page.getByRole('cell', { name: 'peanut', exact: true })).toBeVisible();
  const transfers = page.getByRole('region', { name: 'Custody transfer records', exact: true });
  await expect(transfers.getByRole('alert')).toContainText('Transfer records could not be loaded');
  await expect(
    transfers.getByRole('button', { name: 'Refresh transfers', exact: true }),
  ).toBeEnabled();
});
