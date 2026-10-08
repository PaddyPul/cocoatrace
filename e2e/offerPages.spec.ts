import { test, expect, type Page } from '@playwright/test';
async function mock(page: Page, fail = false, malformed = false) {
  await page.addInitScript(() =>
    localStorage.setItem(
      'ct_user',
      JSON.stringify({
        id: 'offer-seller',
        organizationId: 'seller',
        orgType: 'exporter',
        roles: ['supplier_admin'],
        permissions: ['*'],
        name: 'Offer Seller',
      }),
    ),
  );
  const seen: string[] = [];
  let reject = false;
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname;
    if (path === '/api/me') {
      await route.fulfill({
        json: {
          id: 'offer-seller',
          organization_id: 'seller',
          org_type: 'exporter',
          roles: ['supplier_admin'],
          permissions: ['*'],
          name: 'Offer Seller',
        },
      });
      return;
    }
    if (path === '/api/onboarding') {
      await route.fulfill({ json: { status: 'completed', primary_goal: 'sell' } });
      return;
    }
    if (path === '/api/offers/summary') {
      await route.fulfill({
        json: { received_count: 1005, sent_count: 3, received_pending: 1005, sent_pending: 3 },
      });
      return;
    }
    if (path === '/api/offers/page') {
      seen.push(url.search);
      if (fail) {
        fail = false;
        await route.fulfill({ status: 503, json: { error: 'Offers unavailable' } });
        return;
      }
      const later = !!(url.searchParams.get('cursor') || url.searchParams.get('search'));
      await route.fulfill({
        json: malformed
          ? []
          : {
              items: [
                {
                  id: later ? 'later-offer' : 'first-offer',
                  listing_id: later ? 'later-listing' : 'first-listing',
                  seller_organization_id: 'seller',
                  buyer_organization_id: 'buyer',
                  buyer_name: later ? 'Later Buyer' : 'First Buyer',
                  seller_name: 'Seller',
                  quantity_kg: 1,
                  offered_price_per_kg: 5,
                  currency: 'EUR',
                  status: reject ? 'rejected' : 'pending',
                },
              ],
              hasMore: !later,
              nextCursor: later ? null : 'next-offer',
            },
      });
      return;
    }
    if (path.endsWith('/reject')) {
      reject = true;
      await route.fulfill({ json: { ok: true } });
      return;
    }
    if (path.endsWith('/accept')) {
      await route.fulfill({ json: { contract: { id: 'accepted-contract' } } });
      return;
    }
    if (path === '/api/offers') {
      await route.fulfill({
        status: 500,
        json: { error: 'Unbounded list forbidden in this fixture' },
      });
      return;
    }
    await route.fulfill({ json: [] });
  });
  return seen;
}
test('offer pages search server-side, retain full totals and reset pagination on direction change', async ({
  page,
}) => {
  const seen = await mock(page);
  await page.goto('/offers');
  await expect(page).toHaveURL(/\/offers(?:\?|$)/);
  await expect(page.getByRole('button', { name: 'Received (1005)', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'First Buyer', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next offers', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Later Buyer', exact: true })).toBeVisible();
  await page.getByLabel('Search offers', { exact: true }).fill('unique off-page');
  await expect
    .poll(() =>
      seen.some(
        (s) =>
          new URLSearchParams(s).get('search') === 'unique off-page' &&
          !new URLSearchParams(s).has('cursor'),
      ),
    )
    .toBe(true);
  await page.getByRole('button', { name: 'Sent (3)', exact: true }).click();
  await expect
    .poll(() =>
      seen.some(
        (s) =>
          new URLSearchParams(s).get('direction') === 'sent' &&
          !new URLSearchParams(s).has('cursor'),
      ),
    )
    .toBe(true);
  await expect(page.getByText('Awaiting seller response', { exact: true })).toBeVisible();
});
test('offer failures retry and malformed envelopes never claim an empty history', async ({
  page,
}) => {
  await mock(page, true);
  await page.goto('/offers');
  await expect(page).toHaveURL(/\/offers(?:\?|$)/);
  await expect(page.getByText('Offers unavailable', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Retry offers', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'First Buyer', exact: true })).toBeVisible();
});
test('offer malformed page has explicit error', async ({ page }) => {
  await mock(page, false, true);
  await page.goto('/offers');
  await expect(page).toHaveURL(/\/offers(?:\?|$)/);
  await expect(page.getByText('Invalid page response.', { exact: false })).toBeVisible();
  await expect(page.getByText('No offers on this page', { exact: true })).toHaveCount(0);
});
test('received offer can still reject and refresh its current page', async ({ page }) => {
  await mock(page);
  await page.goto('/offers');
  await expect(page).toHaveURL(/\/offers(?:\?|$)/);
  await page.getByRole('button', { name: 'Reject', exact: true }).click();
  await page.getByRole('button', { name: 'Reject', exact: true }).last().click();
  await expect(page.getByText('History (1)', { exact: true })).toBeVisible();
});

test('supplier home reads aggregate offer counts instead of an array', async ({ page }) => {
  await mock(page);
  await page.route('**/api/listings/summary', (route) =>
    route.fulfill({ json: { count: 1, own_count: 1, quantity_kg: '1' } }),
  );
  await page.route('**/api/holdings/summary', (route) =>
    route.fulfill({
      json: { count: 1, available_count: 1, available_kg: '1', commodities: ['peanut'] },
    }),
  );
  await page.route('**/api/farms/summary', (route) =>
    route.fulfill({ json: { count: 0, owned_count: 0 } }),
  );
  await page.goto('/home?mode=sell');
  await expect(page).toHaveURL(/\/home\?mode=sell$/);
  await expect(page.getByText('Offers received', { exact: true })).toBeVisible();
  await expect(page.getByText('1005', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review offer', exact: true })).toBeVisible();
});
