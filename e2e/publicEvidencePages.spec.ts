import { expect, Page, test } from '@playwright/test';
async function mock(page: Page) {
  let mode: 'normal' | 'fail' | 'malformed' | 'revoked' = 'normal';
  const searches: string[] = [];
  await page.route('**/api/public/products/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/scans')) {
      await route.fulfill({ json: {} });
      return;
    }
    if (url.pathname.endsWith('/evidence/page')) {
      searches.push(url.searchParams.get('search') || '');
      if (mode === 'fail') {
        await route.fulfill({ status: 503, json: { error: 'Read unavailable' } });
        return;
      }
      const late = Boolean(url.searchParams.get('search') || url.searchParams.get('cursor'));
      await route.fulfill({
        json:
          mode === 'malformed'
            ? { items: [], count: 1005, hasMore: true, nextCursor: null }
            : {
                items:
                  mode === 'revoked'
                    ? []
                    : [
                        {
                          id: late ? 'late' : 'first',
                          file_name: late ? 'Late public proof.pdf' : 'First public proof.pdf',
                          claim_description: late
                            ? 'Late reviewed statement'
                            : 'First reviewed statement',
                          sha256_hash: 'public-hash',
                          type: 'other',
                          review_status: 'approved',
                          created_at: '2026-01-01',
                        },
                      ],
                count: mode === 'revoked' ? 0 : 1005,
                hasMore: mode !== 'revoked' && !late,
                nextCursor: mode === 'revoked' || late ? null : 'next-page',
              },
      });
      return;
    }
    await route.fulfill({
      json: {
        profile: {
          displayName: 'Public peanut',
          slug: 'peanut',
          description: 'Published lot',
          lotCode: 'ONE',
        },
        product: { harvestDate: '2026-01-01' },
        origin: { region: 'Northern', country: 'GH', plot_count: 0, total_area_hectares: 0 },
        journey: [],
        evidence: [],
        safety: {
          status: 'warning',
          inventoryHeld: true,
          activeRecalls: [
            {
              id: 'notice',
              reference_code: 'R-1',
              title: 'Safety notice',
              reason: 'Recall investigation',
              instructions: 'Do not use stock',
              issued_by: 'Supplier',
              initiated_at: '2026-01-01',
            },
          ],
          checkedAt: '2026-01-01',
        },
      },
    });
  });
  await page.goto('/p/peanut');
  await page.getByRole('button', { name: 'proof', exact: true }).click();
  return {
    setMode: (value: typeof mode) => {
      mode = value;
    },
    searches,
    panel: page.getByRole('region', { name: 'Public reviewed evidence', exact: true }),
  };
}
test('public evidence pages search beyond the first page with full totals and visible recall warnings', async ({
  page,
}) => {
  const { panel, searches } = await mock(page);
  await expect(panel.getByText('First reviewed statement', { exact: true })).toBeVisible();
  await expect(panel).toContainText('1,005 reviewed records');
  await panel.getByRole('button', { name: 'Next evidence', exact: true }).click();
  await expect(panel.getByText('Late reviewed statement', { exact: true })).toBeVisible();
  await expect(panel).toContainText('Page 2');
  await panel.getByLabel('Search reviewed evidence', { exact: true }).fill('%_ late');
  await expect(panel).toContainText('Page 1');
  await expect.poll(() => searches.includes('%_ late')).toBe(true);
  await expect(page.getByText('INVENTORY SAFETY HOLD', { exact: true })).toBeVisible();
  await expect(page.getByText('Do not use stock', { exact: true })).toBeVisible();
});
test('public evidence failure and malformed envelopes show unknown totals and retry rather than empty proof', async ({
  page,
}) => {
  const { panel, setMode } = await mock(page);
  await expect(panel).toContainText('1,005 reviewed records');
  setMode('fail');
  await panel.getByRole('button', { name: 'Retry reviewed evidence', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('Reviewed evidence unavailable');
  await expect(panel).toContainText('Total unavailable');
  await expect(panel.getByText('First reviewed statement', { exact: true })).toHaveCount(0);
  await expect(
    panel.getByText('No publishable reviewed evidence is recorded.', { exact: true }),
  ).toHaveCount(0);
  setMode('normal');
  await panel.getByRole('button', { name: 'Retry reviewed evidence', exact: true }).click();
  await expect(panel).toContainText('1,005 reviewed records');
  setMode('malformed');
  await panel.getByRole('button', { name: 'Retry reviewed evidence', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('Invalid page response');
});
test('focus refresh removes revoked evidence without claiming held material is safe', async ({
  page,
}) => {
  const { panel, setMode } = await mock(page);
  await expect(panel.getByText('First reviewed statement', { exact: true })).toBeVisible();
  setMode('revoked');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(panel.getByText('First reviewed statement', { exact: true })).toHaveCount(0);
  await expect(panel).toContainText('0 reviewed records');
  await expect(page.getByText('INVENTORY SAFETY HOLD', { exact: true })).toBeVisible();
});
