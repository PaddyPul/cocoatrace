import { test, expect, type Page } from '@playwright/test';
async function mock(
  page: Page,
  options: { failure?: boolean; malformed?: boolean; evidence?: boolean } = {},
) {
  const permissions = [
    'farm.read',
    'batch.read',
    ...(options.evidence === false ? [] : ['evidence.read']),
  ];
  const seen: string[] = [];
  let failed = false;
  await page.addInitScript(
    ({ permissions }) =>
      localStorage.setItem(
        'ct_user',
        JSON.stringify({
          id: 'source-reader',
          organizationId: 'source-org',
          orgType: 'exporter',
          roles: [],
          permissions,
          name: 'Source reader',
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
          id: 'source-reader',
          organization_id: 'source-org',
          org_type: 'exporter',
          roles: [],
          permissions,
          name: 'Source reader',
        },
      });
      return;
    }
    if (path === '/api/onboarding') {
      await route.fulfill({ json: { status: 'completed', primary_goal: 'sell' } });
      return;
    }
    if (path === '/api/farms/farm-one') {
      await route.fulfill({
        json: {
          farm: {
            id: 'farm-one',
            name: 'Paged farm',
            region: 'Northern',
            district: 'Tamale',
            country: 'GH',
            verification_status: 'self_declared',
          },
          plots: null,
          plot_collection: 'paged',
          certificates: null,
          certificate_collection: 'unavailable',
        },
      });
      return;
    }
    if (path === '/api/batches/batch-one') {
      await route.fulfill({
        json: {
          batch: {
            id: 'batch-one',
            farm_id: 'farm-one',
            crop: 'cocoa',
            quantity_kg: 10,
            harvest_date: '2026-01-01',
            organic_claim_status: 'self_declared',
          },
          evidence: null,
          evidence_collection: 'paged',
        },
      });
      return;
    }
    if (path === '/api/farms/farm-one/plots/summary' || path === '/api/evidence/summary') {
      await route.fulfill({ json: { count: 1005 } });
      return;
    }
    if (path === '/api/farms/farm-one/plots/page' || path === '/api/evidence/page') {
      if (options.failure && !failed) {
        failed = true;
        await route.fulfill({ status: 503, json: { error: 'Detail records unavailable' } });
        return;
      }
      if (options.malformed) {
        await route.fulfill({ json: { items: [], hasMore: true, nextCursor: null } });
        return;
      }
      const later = Boolean(url.searchParams.get('cursor') || url.searchParams.get('search'));
      const item = path.includes('/plots/')
        ? {
            id: later ? 'late-plot' : 'first-plot',
            plot_code: later ? 'LATE PLOT' : 'FIRST PLOT',
            area_hectares: 1,
            crops: ['cocoa'],
          }
        : {
            id: later ? 'late-proof' : 'first-proof',
            type: 'source_proof',
            file_name: later ? 'late-proof.pdf' : 'first-proof.pdf',
            review_status: 'pending',
          };
      await route.fulfill({
        json: { items: [item], hasMore: !later, nextCursor: later ? null : 'detail-next' },
      });
      return;
    }
    await route.fulfill({ status: 503, json: { error: 'Unused fixture path' } });
  });
  return seen;
}
test('farm plots page and search beyond the first page with full registered counts', async ({
  page,
}) => {
  const seen = await mock(page);
  await page.goto('/farms/farm-one');
  const panel = page.getByRole('region', { name: 'Farm plot records', exact: true });
  await expect(panel.getByText('Plots — 1005 registered records', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Next farm plots', exact: true }).click();
  await expect(panel.getByText('LATE PLOT', { exact: true })).toBeVisible();
  await panel.getByLabel('Search farm plots', { exact: true }).fill('LATE');
  await expect(panel.getByText('Page 1', { exact: true })).toBeVisible();
  expect(seen.some((value) => value.includes('plotMode=paged'))).toBe(true);
  expect(seen.some((value) => value.includes('cursor=detail-next'))).toBe(true);
  expect(seen.some((value) => value.includes('farmScope='))).toBe(false);
});
test('batch evidence pages/searches metadata without an embedded history or approval claim', async ({
  page,
}) => {
  const seen = await mock(page);
  await page.goto('/batches/batch-one');
  const panel = page.getByRole('region', { name: 'Batch evidence records', exact: true });
  await expect(panel.getByText('Evidence — 1005 recorded items', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Next batch evidence', exact: true }).click();
  await expect(panel.getByText('late-proof.pdf', { exact: true })).toBeVisible();
  await panel.getByLabel('Search batch evidence', { exact: true }).fill('late');
  await expect(panel.getByText('Page 1', { exact: true })).toBeVisible();
  expect(seen.some((value) => value.includes('evidenceMode=paged'))).toBe(true);
  expect(
    seen.some((value) => value.includes('/evidence/summary?entityType=batch&entityId=batch-one')),
  ).toBe(true);
});
test('plot read failure retries rather than presenting no plots', async ({ page }) => {
  await mock(page, { failure: true });
  await page.goto('/farms/farm-one');
  const panel = page.getByRole('region', { name: 'Farm plot records', exact: true });
  await expect(panel.getByRole('alert')).toContainText('Plots unavailable');
  await expect(panel.getByText('No plots match', { exact: false })).toHaveCount(0);
  await panel.getByRole('button', { name: 'Retry farm plots', exact: true }).click();
  await expect(panel.getByText('FIRST PLOT', { exact: true })).toBeVisible();
});
test('malformed batch evidence envelope is an explicit failure', async ({ page }) => {
  await mock(page, { malformed: true });
  await page.goto('/batches/batch-one');
  const panel = page.getByRole('region', { name: 'Batch evidence records', exact: true });
  await expect(panel.getByRole('alert')).toContainText('Invalid page response');
  await expect(panel.getByText('No evidence matches', { exact: false })).toHaveCount(0);
});
test('batch-only access never requests evidence metadata or totals', async ({ page }) => {
  const seen = await mock(page, { evidence: false });
  await page.goto('/batches/batch-one');
  await expect(
    page.getByText('Evidence records are unavailable with your access.', { exact: true }),
  ).toBeVisible();
  expect(seen.some((value) => value.startsWith('/api/evidence/'))).toBe(false);
});
