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
        id: 'transport-actor',
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
          id: 'transport-actor',
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
    if (path === '/api/shipments/summary') {
      await route.fulfill(
        options.summaryFail
          ? { status: 503, json: { error: 'Totals unavailable' } }
          : {
              json: {
                count: 1005,
                active_count: 1002,
                delivered_count: 1,
                cancelled_count: 1,
              },
            },
      );
      return;
    }
    if (path === '/api/shipments/page') {
      seen.push(url.search);
      if (fail) {
        fail = false;
        await route.fulfill({ status: 503, json: { error: 'Transport page unavailable' } });
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
                  service_provider_name: next ? 'Later Transport' : 'First Transport',
                  transport_coordinator_name: 'Buyer',
                  current_milestone: 'planning',
                  incoterm: 'FOB',
                  origin_port: 'Tema',
                  destination_port: 'Accra',
                  eta_arrival: null,
                  contract_id: first,
                },
              ],
              hasMore: !next,
              nextCursor: next ? null : 'next-shipment',
            },
      });
      return;
    }
    if (path === '/api/shipments') {
      await route.fulfill({ status: 500, json: { error: 'Legacy shipment arrays forbidden' } });
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

test('transport pages search beyond page one and reset filters before opening the selected record', async ({
  page,
}) => {
  const seen = await fixture(page);
  await page.goto('/shipments');
  await expect(page).toHaveURL(/\/shipments$/);
  await expect(
    page.getByText('Total transport records: 1005 · Active transport: 1002', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('cell', { name: 'First Transport', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Record progress', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Next shipments', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Later Transport', exact: true })).toBeVisible();
  await page.getByLabel('Search shipments', { exact: true }).fill('unique booking');
  await expect
    .poll(() =>
      seen.some(
        (q) =>
          new URLSearchParams(q).get('search') === 'unique booking' &&
          !new URLSearchParams(q).has('cursor'),
      ),
    )
    .toBe(true);
  await page.getByLabel('Shipment direction', { exact: true }).selectOption('purchases');
  await page.getByLabel('Shipment status', { exact: true }).selectOption('active');
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
  await page.getByRole('button', { name: `Open transport ${later}`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/shipments/' + later + '$'));
});
test('failed transport page retries without claiming an empty workspace', async ({ page }) => {
  await fixture(page, { fail: true });
  await page.goto('/shipments');
  await expect(
    page.getByRole('alert').filter({ hasText: 'Transport page unavailable' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Retry shipments', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'First Transport', exact: true })).toBeVisible();
});
test('malformed transport envelope shows a retryable error', async ({ page }) => {
  await fixture(page, { malformed: true });
  await page.goto('/shipments');
  await expect(page.getByRole('alert').filter({ hasText: 'Invalid page response.' })).toBeVisible();
  await expect(page.getByText('No transport records on this page.', { exact: false })).toHaveCount(
    0,
  );
});
test('failed transport totals remain unavailable while permitted rows remain usable', async ({
  page,
}) => {
  await fixture(page, { summaryFail: true });
  await page.goto('/shipments');
  await expect(
    page.getByRole('alert').filter({ hasText: 'Transport totals could not be refreshed' }),
  ).toBeVisible();
  await expect(page.getByRole('cell', { name: 'First Transport', exact: true })).toBeVisible();
  await expect(
    page.getByText('Total transport records: Unavailable · Active transport: Unavailable', {
      exact: true,
    }),
  ).toBeVisible();
});
