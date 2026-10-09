import { expect, Page, test } from '@playwright/test';
async function mock(page: Page) {
  let mode: 'normal' | 'fail' | 'malformed' | 'archived' = 'normal';
  const searches: string[] = [];
  await page.route('**/api/public/products/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/notices/page')) {
      await route.fulfill({
        json: {
          items: [
            {
              id: 'notice',
              reference_code: 'R-1',
              title: 'Safety notice',
              reason: 'Recall investigation',
              instructions: 'Do not use material',
              issued_by: 'Supplier',
              initiated_at: '2026-01-01',
              resolved_at: null,
              status: 'active',
              severity: 'critical',
            },
          ],
          count: 1,
          hasMore: false,
          nextCursor: null,
          safety: {
            status: 'critical',
            inventoryHeld: true,
            activeCount: 1,
            resolvedCount: 0,
            criticalCount: 1,
            warningCount: 0,
            advisoryCount: 0,
            checkedAt: '2026-01-01',
          },
        },
      });
      return;
    }
    if (url.pathname.endsWith('/scans')) {
      await route.fulfill({ json: {} });
      return;
    }
    if (url.pathname.endsWith('/journey/page')) {
      searches.push(url.searchParams.get('search') || '');
      if (mode === 'fail' || mode === 'archived') {
        await route.fulfill({
          status: mode === 'fail' ? 503 : 404,
          json: { error: mode === 'fail' ? 'Read unavailable' : 'Profile not published' },
        });
        return;
      }
      const later = Boolean(url.searchParams.get('cursor') || url.searchParams.get('search'));
      await route.fulfill({
        json:
          mode === 'malformed'
            ? { items: [], count: 1007, hasMore: true, nextCursor: null }
            : {
                items: [
                  {
                    id: later ? 'later' : 'first',
                    type: 'custody',
                    title: 'Custody transferred',
                    summary: later ? 'Later recorded transfer' : 'First recorded transfer',
                    occurredAt: '2026-01-01T00:00:00.000Z',
                    verified: true,
                  },
                ],
                count: 1007,
                hasMore: !later,
                nextCursor: later ? null : 'next-time',
              },
      });
      return;
    }
    await route.fulfill({
      json: {
        profile: {
          displayName: 'Public journey lot',
          slug: 'journey',
          description: 'Published lot',
          lotCode: 'J-1',
        },
        product: { harvestDate: '1960-01-01' },
        origin: { region: 'Northern', country: 'GH', plot_count: 0, total_area_hectares: 0 },
        evidence: [],
        journey: [],
        journeyPaging: { count: 1007, hasMore: true, nextCursor: 'first' },
        safety: {
          status: 'critical',
          inventoryHeld: true,
          activeRecalls: [
            {
              id: 'notice',
              reference_code: 'R-1',
              title: 'Safety notice',
              reason: 'Recall investigation',
              instructions: 'Do not use material',
              issued_by: 'Supplier',
              initiated_at: '2026-01-01',
            },
          ],
          checkedAt: '2026-01-01',
        },
      },
    });
  });
  await page.goto('/p/journey');
  return {
    panel: page.getByRole('region', { name: 'Public product journey', exact: true }),
    searches,
    setMode: (value: typeof mode) => {
      mode = value;
    },
  };
}
test('public journey pages preserve full totals and safety notices while searching beyond page one', async ({
  page,
}) => {
  const { panel, searches } = await mock(page);
  await expect(panel.getByText('First recorded transfer', { exact: true })).toBeVisible();
  await expect(panel).toContainText('1,007 recorded events');
  await panel.getByRole('button', { name: 'Next events', exact: true }).click();
  await expect(panel.getByText('Later recorded transfer', { exact: true })).toBeVisible();
  await expect(panel).toContainText('Page 2');
  await panel.getByLabel('Search journey', { exact: true }).fill('%_ late');
  await expect(panel).toContainText('Page 1');
  await expect.poll(() => searches.includes('%_ late')).toBe(true);
  await expect(page.getByText('Do not use material', { exact: true })).toBeVisible();
  await expect(page.getByText('INVENTORY SAFETY HOLD', { exact: true })).toBeVisible();
});
test('public journey failures and malformed pages show unknown totals and explicit retry', async ({
  page,
}) => {
  const { panel, setMode } = await mock(page);
  await expect(panel).toContainText('1,007 recorded events');
  setMode('fail');
  await panel.getByRole('button', { name: 'Retry product journey', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('Product journey unavailable');
  await expect(panel).toContainText('Total unavailable');
  await expect(panel.getByText('No journey events are recorded.', { exact: true })).toHaveCount(0);
  await expect(panel.getByText('First recorded transfer', { exact: true })).toHaveCount(0);
  setMode('normal');
  await panel.getByRole('button', { name: 'Retry product journey', exact: true }).click();
  await expect(panel).toContainText('1,007 recorded events');
  setMode('malformed');
  await panel.getByRole('button', { name: 'Retry product journey', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('Invalid page response');
});
test('a publication failure on focus removes timeline rows and never clears the visible inventory hold', async ({
  page,
}) => {
  const { panel, setMode } = await mock(page);
  await expect(panel.getByText('First recorded transfer', { exact: true })).toBeVisible();
  setMode('archived');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(panel.getByRole('alert')).toContainText('Profile not published');
  await expect(panel.getByText('First recorded transfer', { exact: true })).toHaveCount(0);
  await expect(page.getByText('INVENTORY SAFETY HOLD', { exact: true })).toBeVisible();
});
