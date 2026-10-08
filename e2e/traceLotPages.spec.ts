import { test, expect } from '@playwright/test';

test('trace selector pages and searches without treating a filtered miss or failure as an empty workspace', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'ct_user',
      JSON.stringify({
        id: 'manager',
        organizationId: 'supplier',
        roles: ['supplier_admin'],
        permissions: ['*'],
        name: 'Manager',
      }),
    ),
  );
  const requests: string[] = [];
  let failed = false;
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === '/api/traceability/lots/page') {
      requests.push(url.search);
      if (failed) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Temporarily unavailable' }),
        });
        return;
      }
      const search = url.searchParams.get('search');
      const second = url.searchParams.get('cursor') === 'second-page';
      const code = search ? 'FOUND-LATER' : second ? 'LOT-51' : 'LOT-1';
      const items =
        search === 'absent'
          ? []
          : [{ id: code, lotCode: code, lotType: 'source', productName: 'Peanut', quantityKg: 10 }];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items,
          nextCursor: search || second ? null : 'second-page',
          hasMore: !search && !second,
        }),
      });
      return;
    }
    if (path === '/api/recalls/page') {
      await route.fulfill({ json: { items: [], hasMore: false, nextCursor: null } });
      return;
    }
    if (path === '/api/recalls/summary') {
      await route.fulfill({ json: { count: 0, active_count: 0 } });
      return;
    }
    const body =
      path === '/api/me'
        ? {
            id: 'manager',
            organization_id: 'supplier',
            roles: ['supplier_admin'],
            permissions: ['*'],
            name: 'Manager',
          }
        : path === '/api/onboarding'
          ? { status: 'completed' }
          : [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
  await page.goto('/recalls');
  await expect(page.getByLabel('Trace lot', { exact: true })).toHaveValue('LOT-1');
  await page.getByRole('button', { name: 'Next lots', exact: true }).click();
  await expect(page.getByLabel('Trace lot', { exact: true })).toHaveValue('LOT-51');
  await page.getByRole('button', { name: 'Previous lots', exact: true }).click();
  await expect(page.getByLabel('Trace lot', { exact: true })).toHaveValue('LOT-1');
  await page.getByLabel('Search trace lots', { exact: true }).fill('Peanut');
  await page.getByRole('button', { name: 'Search lots', exact: true }).click();
  await expect(page.getByLabel('Trace lot', { exact: true })).toHaveValue('FOUND-LATER');
  await expect(page.getByRole('button', { name: 'Previous lots', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Next lots', exact: true })).toBeDisabled();
  expect(
    requests.some((search) => search.includes('search=Peanut') && !search.includes('cursor=')),
  ).toBe(true);
  await page.getByLabel('Search trace lots', { exact: true }).fill('absent');
  await page.getByRole('button', { name: 'Search lots', exact: true }).click();
  await expect(
    page.getByText('No permitted lots match this search. Change the search to try again.'),
  ).toBeVisible();
  await expect(page.getByText('No traceable material records yet')).toHaveCount(0);
  failed = true;
  await page.getByRole('button', { name: 'Search lots', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Lot search failed');
  await expect(page.getByText('No traceable material records yet')).toHaveCount(0);
});
