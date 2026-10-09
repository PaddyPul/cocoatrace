import { expect, Page, test } from '@playwright/test';
async function mock(page: Page) {
  let mode: 'normal' | 'failed' | 'malformed' | 'held' = 'normal';
  const queries: string[] = [];
  await page.route('**/api/public/products/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/scans')) {
      await route.fulfill({ json: {} });
      return;
    }
    if (url.pathname.endsWith('/journey/page') || url.pathname.endsWith('/evidence/page')) {
      await route.fulfill({ json: { items: [], count: 0, nextCursor: null, hasMore: false } });
      return;
    }
    if (url.pathname.endsWith('/notices/page')) {
      queries.push(url.search);
      if (mode === 'failed') {
        await route.fulfill({ status: 503, json: { error: 'Safety read unavailable' } });
        return;
      }
      if (mode === 'malformed') {
        await route.fulfill({
          json: {
            items: [],
            count: 1005,
            hasMore: false,
            nextCursor: null,
            safety: { status: 'clear', inventoryHeld: false },
          },
        });
        return;
      }
      const later = Boolean(url.searchParams.get('cursor'));
      const filtered = Boolean(url.searchParams.get('search'));
      const resolved = url.searchParams.get('status') === 'resolved';
      const safety =
        mode === 'held'
          ? {
              status: 'warning',
              inventoryHeld: true,
              activeCount: 0,
              resolvedCount: 1005,
              criticalCount: 0,
              warningCount: 0,
              advisoryCount: 0,
              checkedAt: '2026-01-01',
            }
          : {
              status: 'critical',
              inventoryHeld: false,
              activeCount: 1004,
              resolvedCount: 1,
              criticalCount: 1,
              warningCount: 0,
              advisoryCount: 1003,
              checkedAt: '2026-01-01',
            };
      await route.fulfill({
        json: {
          items:
            filtered || (mode === 'held' && !resolved)
              ? []
              : [
                  {
                    id: later ? 'late' : 'first',
                    reference_code: 'R-1',
                    title: later ? 'Late notice' : 'First notice',
                    reason: 'Recorded safety investigation',
                    instructions: 'Follow recall instructions',
                    severity: 'advisory',
                    status: resolved ? 'resolved' : 'active',
                    initiated_at: '2026-01-01',
                    resolved_at: null,
                    issued_by: 'Issuer',
                  },
                ],
          count: 1005,
          hasMore: !later && !filtered,
          nextCursor: !later && !filtered ? 'next' : null,
          safety,
        },
      });
      return;
    }
    await route.fulfill({
      json: {
        profile: {
          displayName: 'Public notices lot',
          slug: 'notices',
          description: 'Published lot',
          lotCode: 'N-1',
        },
        product: { harvestDate: '2026-01-01' },
        origin: { region: 'Northern', country: 'GH', plot_count: 0, total_area_hectares: 0 },
        evidence: [],
        journey: [],
        safety: {
          status: 'clear',
          inventoryHeld: false,
          activeRecalls: [],
          resolvedRecalls: [],
          checkedAt: '2026-01-01',
        },
      },
    });
  });
  await page.goto('/p/notices');
  return {
    panel: page.getByRole('region', { name: 'Public product notices', exact: true }),
    queries,
    setMode: (value: typeof mode) => {
      mode = value;
    },
  };
}
test('public notice pages and filters preserve full off-page critical safety', async ({ page }) => {
  const { panel, queries } = await mock(page);
  await expect(panel.getByRole('heading', { name: 'First notice', exact: true })).toBeVisible();
  await expect(panel).toContainText('1,005 recorded · 1,004 active · 1 resolved');
  await expect(page.getByText('CRITICAL NOTICE', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Next notices', exact: true }).click();
  await expect(panel.getByRole('heading', { name: 'Late notice', exact: true })).toBeVisible();
  await expect(panel).toContainText('Page 2');
  await panel.getByLabel('Notice status', { exact: true }).selectOption('resolved');
  await expect(panel).toContainText('Page 1');
  await expect.poll(() => queries.some((q) => q.includes('status=resolved'))).toBe(true);
  await expect(page.getByText('CRITICAL NOTICE', { exact: true })).toBeVisible();
  await panel.getByLabel('Search safety notices', { exact: true }).fill('%_');
  await expect(panel).toContainText('No notices match this view');
  await expect(page.getByText('CRITICAL NOTICE', { exact: true })).toBeVisible();
});
test('failed and malformed notice reads make the global safety badge unknown until retry succeeds', async ({
  page,
}) => {
  const { panel, setMode } = await mock(page);
  await expect(page.getByText('CRITICAL NOTICE', { exact: true })).toBeVisible();
  setMode('failed');
  await panel.getByRole('button', { name: 'Retry product notices', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('Safety read unavailable');
  await expect(page.getByText('Safety status unavailable', { exact: true })).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'First notice', exact: true })).toHaveCount(0);
  await expect(page.getByText('No active recalls recorded', { exact: true })).toHaveCount(0);
  setMode('normal');
  await panel.getByRole('button', { name: 'Retry product notices', exact: true }).click();
  await expect(page.getByText('CRITICAL NOTICE', { exact: true })).toBeVisible();
  setMode('malformed');
  await panel.getByRole('button', { name: 'Retry product notices', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('Invalid public notice page');
  await expect(page.getByText('Safety status unavailable', { exact: true })).toBeVisible();
});
test('resolved notice view retains the full inventory hold on focus refresh', async ({ page }) => {
  const { panel, setMode } = await mock(page);
  await expect(panel).toContainText('1,005 recorded');
  setMode('held');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('INVENTORY SAFETY HOLD', { exact: true })).toBeVisible();
  await panel.getByLabel('Notice status', { exact: true }).selectOption('resolved');
  await expect(panel).toContainText('0 active · 1,005 resolved');
  await expect(page.getByText('No active recalls recorded', { exact: true })).toHaveCount(0);
});
