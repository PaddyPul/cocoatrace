import { test, expect, Page } from '@playwright/test';
async function fixture(page: Page, failure = false, recall = false) {
  await page.addInitScript(() =>
    localStorage.setItem(
      'ct_user',
      JSON.stringify({
        id: 'supplier',
        organizationId: 'supplier',
        orgType: 'exporter',
        roles: ['supplier_admin'],
        permissions: ['*'],
        name: 'Supplier',
      }),
    ),
  );
  const queries: string[] = [];
  let accepted = false;
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname;
    if (path === '/api/transfers/two/accept') {
      accepted = true;
      await route.fulfill({ json: { transfer: { id: 'two' } } });
      return;
    }
    if (path === '/api/transfers/page') {
      queries.push(url.search);
      if (failure) {
        await route.fulfill({ status: 503, json: { error: 'Unavailable' } });
        return;
      }
      const outgoing = url.searchParams.get('direction') === 'outgoing';
      const later = Boolean(url.searchParams.get('cursor') || url.searchParams.get('search'));
      const id = later ? 'two' : 'one';
      await route.fulfill({
        json: {
          items:
            accepted && later
              ? []
              : [
                  {
                    id,
                    from_organization_id: outgoing ? 'supplier' : 'other',
                    to_organization_id: outgoing ? 'other' : 'supplier',
                    from_org_name: outgoing ? 'Supplier' : 'Other',
                    to_org_name: outgoing ? 'Other' : 'Supplier',
                    crop: 'peanut',
                    quantity_kg: '1.000',
                    status: 'requested',
                    activeRecall: recall,
                  },
                ],
          hasMore: !later,
          nextCursor: later ? null : 'next-transfer',
        },
      });
      return;
    }
    await route.fulfill({
      json:
        path === '/api/me'
          ? {
              id: 'supplier',
              organization_id: 'supplier',
              org_type: 'exporter',
              roles: ['supplier_admin'],
              permissions: ['*'],
              name: 'Supplier',
            }
          : path === '/api/onboarding'
            ? { status: 'completed', primary_goal: 'sell' }
            : path === '/api/holdings/page'
              ? { items: [], hasMore: false, nextCursor: null }
              : [],
    });
  });
  return queries;
}
test('receiving supplier pages and searches transfer requests, accepts and refreshes inventory', async ({
  page,
}) => {
  const queries = await fixture(page);
  await page.goto('/holdings');
  const records = page.getByRole('region', { name: 'Custody transfer records', exact: true });
  await expect(
    records.getByRole('button', { name: 'Accept transfer one', exact: true }),
  ).toBeVisible();
  await records.getByRole('button', { name: 'Next transfers', exact: true }).click();
  await expect(
    records.getByRole('button', { name: 'Accept transfer two', exact: true }),
  ).toBeVisible();
  await records.getByLabel('Search transfers', { exact: true }).fill('two');
  await records.getByRole('button', { name: 'Search transfers', exact: true }).click();
  await expect(
    records.getByRole('button', { name: 'Previous transfers', exact: true }),
  ).toBeDisabled();
  expect(queries.some((query) => query.includes('search=two') && !query.includes('cursor='))).toBe(
    true,
  );
  await records.getByRole('button', { name: 'Accept transfer two', exact: true }).click();
  await expect(
    records.getByText('No transfers match this view. Adjust direction, status or search.', {
      exact: true,
    }),
  ).toBeVisible();
});
test('outgoing transfer view does not offer receiving-party acceptance', async ({ page }) => {
  await fixture(page);
  await page.goto('/holdings');
  const records = page.getByRole('region', { name: 'Custody transfer records', exact: true });
  await records.getByLabel('Transfer direction', { exact: true }).selectOption('outgoing');
  await expect(records.getByText('Supplier → Other', { exact: true })).toBeVisible();
  await expect(records.getByRole('button', { name: /^Accept transfer / })).toHaveCount(0);
});
test('failed transfer read has a retry action and does not imply empty history', async ({
  page,
}) => {
  await fixture(page, true);
  await page.goto('/holdings');
  const records = page.getByRole('region', { name: 'Custody transfer records', exact: true });
  await expect(records.getByRole('alert')).toContainText('Transfer records could not be loaded');
  await expect(
    records.getByRole('button', { name: 'Refresh transfers', exact: true }),
  ).toBeEnabled();
  await expect(
    records.getByText('No transfers match this view. Adjust direction, status or search.', {
      exact: true,
    }),
  ).toHaveCount(0);
});

test('recalled incoming supply shows a hold and blocks the acceptance control', async ({
  page,
}) => {
  await fixture(page, false, true);
  await page.goto('/holdings');
  const records = page.getByRole('region', { name: 'Custody transfer records', exact: true });
  await expect(
    records.getByText('Supply has a recall hold. Acceptance is blocked.', { exact: true }),
  ).toBeVisible();
  await expect(
    records.getByRole('button', { name: 'Accept transfer one', exact: true }),
  ).toBeDisabled();
});
