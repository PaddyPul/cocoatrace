import { test, expect, type Page } from '@playwright/test';
const first = '11111111-1111-1111-1111-111111111111',
  later = '22222222-2222-2222-2222-222222222222';
async function fixture(
  page: Page,
  options: { fail?: boolean; malformed?: boolean; summaryFail?: boolean; buyer?: boolean } = {},
) {
  await page.addInitScript(() =>
    localStorage.setItem(
      'ct_user',
      JSON.stringify({
        id: 'contract-actor',
        organizationId: 'party',
        orgType: 'exporter',
        permissions: ['*'],
        roles: ['supplier_admin'],
        name: 'Trader',
      }),
    ),
  );
  const seen: string[] = [];
  let fail = options.fail;
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname;
    if (path === '/api/me') {
      await route.fulfill({
        json: {
          id: 'contract-actor',
          organization_id: 'party',
          org_type: options.buyer ? 'importer' : 'exporter',
          permissions: ['*'],
          roles: ['supplier_admin'],
          name: 'Trader',
        },
      });
      return;
    }
    if (path === '/api/onboarding') {
      await route.fulfill({
        json: { status: 'completed', primary_goal: options.buyer ? 'buy' : 'sell' },
      });
      return;
    }
    if (path === '/api/contracts/summary') {
      await route.fulfill(
        options.summaryFail
          ? { status: 503, json: { error: 'Totals unavailable' } }
          : {
              json: {
                count: 1005,
                active_count: 1003,
                settled_count: 1,
                cancelled_count: 1,
                latest_active_id: later,
              },
            },
      );
      return;
    }
    if (path === '/api/contracts/page') {
      seen.push(url.search);
      if (fail) {
        fail = false;
        await route.fulfill({ status: 503, json: { error: 'Contract page unavailable' } });
        return;
      }
      const next = !!(url.searchParams.get('cursor') || url.searchParams.get('search'));
      await route.fulfill({
        json: options.malformed
          ? []
          : {
              items: [
                {
                  id: next ? later : first,
                  seller_name: next ? 'Later Supplier' : 'First Supplier',
                  buyer_name: 'Buyer',
                  quantity_kg: 1,
                  price_per_kg: 5,
                  currency: 'USD',
                  currency_minor_units: 2,
                  trade_value: '5.00',
                  status: 'accepted',
                  incoterm: 'FOB',
                },
              ],
              hasMore: !next,
              nextCursor: next ? null : 'next-contract',
            },
      });
      return;
    }
    if (path === '/api/contracts') {
      await route.fulfill({ status: 500, json: { error: 'Legacy contract arrays forbidden' } });
      return;
    }
    if (path === '/api/offers/summary') {
      await route.fulfill({
        json: { received_count: 0, sent_count: 0, received_pending: 0, sent_pending: 0 },
      });
      return;
    }
    if (path === '/api/listings/summary') {
      await route.fulfill({ json: { count: 1, own_count: 1, quantity_kg: '1' } });
      return;
    }
    if (path === '/api/holdings/summary') {
      await route.fulfill({
        json: { count: 1, available_count: 1, available_kg: '1', commodities: ['peanut'] },
      });
      return;
    }
    if (path === '/api/farms/summary') {
      await route.fulfill({ json: { count: 0, owned_count: 0 } });
      return;
    }
    await route.fulfill({ json: [] });
  });
  return seen;
}
test('contracts page searches off-page, resets filters and opens the selected deal', async ({
  page,
}) => {
  const seen = await fixture(page);
  await page.goto('/contracts');
  await expect(page).toHaveURL(/\/contracts$/);
  await expect(
    page.getByText('Total deals: 1005 · Active orders: 1003', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('cell', { name: 'First Supplier', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'USD 5.00', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next contracts', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Later Supplier', exact: true })).toBeVisible();
  await page.getByLabel('Search contracts', { exact: true }).fill('unique deal');
  await expect
    .poll(() =>
      seen.some(
        (q) =>
          new URLSearchParams(q).get('search') === 'unique deal' &&
          !new URLSearchParams(q).has('cursor'),
      ),
    )
    .toBe(true);
  await page.getByLabel('Contract direction', { exact: true }).selectOption('purchases');
  await page.getByLabel('Contract status', { exact: true }).selectOption('active');
  await expect
    .poll(() =>
      seen.some(
        (q) =>
          new URLSearchParams(q).get('direction') === 'purchases' &&
          new URLSearchParams(q).get('status') === 'active' &&
          !new URLSearchParams(q).has('cursor'),
      ),
    )
    .toBe(true);
  await page.getByRole('button', { name: `Open deal ${later}`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/deal-room/' + later + '$'));
});
test('failed contract page retries without presenting an empty workspace', async ({ page }) => {
  await fixture(page, { fail: true });
  await page.goto('/contracts');
  await expect(
    page.getByRole('alert').filter({ hasText: 'Contract page unavailable' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Retry contracts', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'First Supplier', exact: true })).toBeVisible();
});
test('malformed contract page shows explicit error', async ({ page }) => {
  await fixture(page, { malformed: true });
  await page.goto('/contracts');
  await expect(page.getByRole('alert').filter({ hasText: 'Invalid page response.' })).toBeVisible();
  await expect(page.getByText('No deals on this page.', { exact: false })).toHaveCount(0);
});
test('failed totals stay unavailable while permitted contract rows remain usable', async ({
  page,
}) => {
  await fixture(page, { summaryFail: true });
  await page.goto('/contracts');
  await expect(
    page.getByRole('alert').filter({ hasText: 'Order totals could not be refreshed' }),
  ).toBeVisible();
  await expect(page.getByRole('cell', { name: 'First Supplier', exact: true })).toBeVisible();
  await expect(
    page.getByText('Total deals: Unavailable · Active orders: Unavailable', { exact: true }),
  ).toBeVisible();
});
test('buyer home uses active aggregate and links latest active deal without loading histories', async ({
  page,
}) => {
  await fixture(page, { buyer: true });
  await page.goto('/home?mode=buy');
  await expect(page).toHaveURL(/\/home\?mode=buy$/);
  await expect(page.getByText('1003', { exact: true })).toBeVisible();
  const action = page.getByRole('button', { name: /^Continue the active deal/ });
  await expect(action).toBeVisible();
  await action.click();
  await expect(page).toHaveURL(new RegExp('/deal-room/' + later + '$'));
});
