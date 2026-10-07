import { test, expect, Page } from '@playwright/test';

async function fixture(page: Page, mode = 'pages') {
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
  let reads = 0;
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/evidence/page') {
      queries.push(url.search);
      reads++;
      if (mode === 'retry' && reads === 1) {
        await route.fulfill({ status: 503, json: { error: 'Evidence read unavailable' } });
        return;
      }
      if (mode === 'malformed') {
        await route.fulfill({ json: [] });
        return;
      }
      if (url.searchParams.get('search') === 'no match') {
        await route.fulfill({ json: { items: [], hasMore: false, nextCursor: null } });
        return;
      }
      const later = Boolean(url.searchParams.get('cursor') || url.searchParams.get('search'));
      await route.fulfill({
        json: {
          items: [
            {
              id: later ? 'later' : 'first',
              file_name: later ? 'Later proof.pdf' : 'First proof.pdf',
              type: 'origin_document',
              sha256_hash: 'test-hash',
              linked_entity_type: 'farm',
              linked_entity_id: '11111111-1111-1111-1111-111111111111',
              review_status: 'pending',
              malware_scan_status: 'legacy_unscanned',
              created_at: '2026-10-07T00:00:00Z',
            },
          ],
          hasMore: !later,
          nextCursor: later ? null : 'next-evidence',
        },
      });
      return;
    }
    await route.fulfill({
      json:
        url.pathname === '/api/me'
          ? {
              id: 'supplier',
              organization_id: 'supplier',
              org_type: 'exporter',
              permissions: ['*'],
              roles: ['supplier_admin'],
              name: 'Supplier',
            }
          : url.pathname === '/api/onboarding'
            ? { status: 'completed', primary_goal: 'sell' }
            : [],
    });
  });
  return queries;
}
test('evidence pages search beyond page one and separate review and scan status without inventing a total', async ({
  page,
}) => {
  const queries = await fixture(page);
  await page.goto('/evidence');
  await expect(page.getByRole('cell', { name: 'First proof.pdf', exact: true })).toBeVisible();
  await expect(page.getByText('1 file on this page', { exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'legacy unscanned', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next evidence', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Later proof.pdf', exact: true })).toBeVisible();
  await page.getByLabel('Search evidence', { exact: true }).fill('Later');
  await expect(page.getByRole('button', { name: 'Previous evidence', exact: true })).toBeDisabled();
  await expect
    .poll(() =>
      queries.some((query) => query.includes('search=Later') && !query.includes('cursor=')),
    )
    .toBe(true);
  await page.getByLabel('Search evidence', { exact: true }).fill('no match');
  await expect(
    page.getByText(
      'No evidence matches this page and search. Change the search or return to the previous page.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByText(/^No evidence uploaded/)).toHaveCount(0);
});
test('record-scoped evidence keeps entity filters on every page', async ({ page }) => {
  const queries = await fixture(page);
  await page.goto('/evidence?entityType=farm&entityId=11111111-1111-1111-1111-111111111111');
  await expect(page.getByRole('cell', { name: 'First proof.pdf', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next evidence', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Later proof.pdf', exact: true })).toBeVisible();
  expect(queries.length).toBeGreaterThanOrEqual(2);
  expect(
    queries.every(
      (query) =>
        query.includes('entityType=farm') &&
        query.includes('entityId=11111111-1111-1111-1111-111111111111'),
    ),
  ).toBe(true);
});
test('failed evidence read keeps search and allows retry without presenting an empty workspace', async ({
  page,
}) => {
  await fixture(page, 'retry');
  await page.goto('/evidence');
  await expect(page.getByRole('alert')).toContainText('Evidence read unavailable');
  await expect(page.getByLabel('Search evidence', { exact: true })).toBeVisible();
  await expect(page.getByText(/^No evidence uploaded/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry evidence', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'First proof.pdf', exact: true })).toBeVisible();
});
test('malformed evidence page stays an explicit read error', async ({ page }) => {
  await fixture(page, 'malformed');
  await page.goto('/evidence');
  await expect(page.getByRole('alert')).toContainText('Invalid page response');
  await expect(page.getByRole('button', { name: 'Retry evidence', exact: true })).toBeEnabled();
  await expect(page.getByText(/^No evidence uploaded/)).toHaveCount(0);
});
