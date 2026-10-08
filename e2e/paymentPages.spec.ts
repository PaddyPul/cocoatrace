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
        id: 'payment-actor',
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
          id: 'payment-actor',
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
    if (path === '/api/payment-requests/summary') {
      await route.fulfill(
        options.summaryFail
          ? { status: 503, json: { error: 'Totals unavailable' } }
          : {
              json: {
                count: 1005,
                open_count: 1002,
                settled_count: 1,
                cancelled_count: 1,
              },
            },
      );
      return;
    }
    if (path === '/api/payment-requests/page') {
      seen.push(url.search);
      if (fail) {
        fail = false;
        await route.fulfill({ status: 503, json: { error: 'Payment page unavailable' } });
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
                  payment_reference_external: next ? 'LATER-PAYMENT' : 'FIRST-PAYMENT',
                  status: 'payment_due',
                  currency: 'JPY',
                  currency_minor_units: 0,
                  amount_total: '123',
                  contract_id: first,
                },
              ],
              hasMore: !next,
              nextCursor: next ? null : 'next-payment',
            },
      });
      return;
    }
    if (path === '/api/payment-requests') {
      await route.fulfill({ status: 500, json: { error: 'Legacy payment arrays forbidden' } });
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

test('payment pages search beyond page one and reset filters before opening the selected record', async ({
  page,
}) => {
  const seen = await fixture(page);
  await page.goto('/payments');
  await expect(page).toHaveURL(/\/payments$/);
  await expect(
    page.getByText('Total payment workflows: 1005 · Open workflows: 1002', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('cell', { name: 'FIRST-PAYMENT', exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Confirm funds received', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'JPY', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next payments', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'LATER-PAYMENT', exact: true })).toBeVisible();
  await page.getByLabel('Search payments', { exact: true }).fill('unique reference');
  await expect
    .poll(() =>
      seen.some(
        (q) =>
          new URLSearchParams(q).get('search') === 'unique reference' &&
          !new URLSearchParams(q).has('cursor'),
      ),
    )
    .toBe(true);
  await page.getByLabel('Payment direction', { exact: true }).selectOption('purchases');
  await page.getByLabel('Payment status', { exact: true }).selectOption('open');
  await page.getByLabel('Payment currency', { exact: true }).selectOption('JPY');
  await expect
    .poll(() =>
      seen.some(
        (q) =>
          new URLSearchParams(q).get('direction') === 'purchases' &&
          new URLSearchParams(q).get('status') === 'open' &&
          new URLSearchParams(q).get('currency') === 'JPY' &&
          !new URLSearchParams(q).has('cursor'),
      ),
    )
    .toBe(true);
  await page.getByRole('button', { name: `Open payment ${later}`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/payments/' + later + '$'));
});
test('failed payment page retries without claiming an empty workspace', async ({ page }) => {
  await fixture(page, { fail: true });
  await page.goto('/payments');
  await expect(
    page.getByRole('alert').filter({ hasText: 'Payment page unavailable' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Retry payments', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'FIRST-PAYMENT', exact: true })).toBeVisible();
});
test('malformed payment envelope shows a retryable error', async ({ page }) => {
  await fixture(page, { malformed: true });
  await page.goto('/payments');
  await expect(page.getByRole('alert').filter({ hasText: 'Invalid page response.' })).toBeVisible();
  await expect(page.getByText('No payment workflows on this page.', { exact: false })).toHaveCount(
    0,
  );
});
test('failed payment totals remain unavailable while permitted rows remain usable', async ({
  page,
}) => {
  await fixture(page, { summaryFail: true });
  await page.goto('/payments');
  await expect(
    page.getByRole('alert').filter({ hasText: 'Payment totals could not be refreshed' }),
  ).toBeVisible();
  await expect(page.getByRole('cell', { name: 'FIRST-PAYMENT', exact: true })).toBeVisible();
  await expect(
    page.getByText('Total payment workflows: Unavailable · Open workflows: Unavailable', {
      exact: true,
    }),
  ).toBeVisible();
});
