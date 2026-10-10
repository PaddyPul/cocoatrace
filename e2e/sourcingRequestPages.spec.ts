import { expect, Page, test } from '@playwright/test';
const first = '11111111-1111-4111-8111-111111111111';
const late = '22222222-2222-4222-8222-222222222222';
function brief(id: string) {
  return {
    id,
    buyer_organization_id: 'buyer-org',
    title: id === first ? 'First cocoa brief' : 'Later shea brief',
    commodity: id === first ? 'cocoa' : 'shea',
    quantity_kg: 35,
    incoterm: 'FOB',
    delivery_location: 'Tema',
    status: 'open',
  };
}
async function mock(page: Page) {
  let mode: 'normal' | 'failed' | 'malformed' | 'badRow' | 'summaryFailed' = 'normal';
  const queries: string[] = [];
  await page.addInitScript(() =>
    localStorage.setItem(
      'ct_user',
      JSON.stringify({
        id: 'buyer',
        organizationId: 'buyer-org',
        orgType: 'importer',
        roles: ['buyer_admin'],
        permissions: ['*'],
        name: 'Buyer',
      }),
    ),
  );
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    let body: unknown = [];
    if (url.pathname === '/api/me')
      body = {
        id: 'buyer',
        organization_id: 'buyer-org',
        org_type: 'importer',
        roles: ['buyer_admin'],
        permissions: ['*'],
        name: 'Buyer',
      };
    else if (url.pathname === '/api/onboarding')
      body = { status: 'completed', primary_goal: 'buy' };
    else if (url.pathname === '/api/sourcing-requests/page') {
      queries.push(url.search);
      if (mode === 'failed') {
        await route.fulfill({ status: 503, json: { error: 'Request read unavailable' } });
        return;
      }
      const id = url.searchParams.get('id');
      const later = Boolean(url.searchParams.get('cursor') || url.searchParams.get('search'));
      body =
        mode === 'malformed'
          ? { items: [], hasMore: true, nextCursor: null }
          : {
              items: [
                {
                  ...brief(id || (later ? late : first)),
                  ...(mode === 'badRow' ? { origin_countries: { invalid: 'Ghana' } } : {}),
                },
              ],
              hasMore: !id && !later,
              nextCursor: !id && !later ? 'next-request' : null,
            };
    } else if (url.pathname === '/api/sourcing-requests/summary') {
      if (mode === 'summaryFailed') {
        await route.fulfill({ status: 503, json: { error: 'Request totals unavailable' } });
        return;
      }
      body = {
        own_count: 1005,
        open_count: 0,
        latest_own: brief(late),
        latest_own_open: brief(late),
        latest_open: null,
      };
    } else if (url.pathname === '/api/listings/page')
      body = { items: [], hasMore: false, nextCursor: null };
    else if (url.pathname === '/api/listings/summary')
      body = { count: 20, own_count: 0, quantity_kg: '20' };
    else if (url.pathname === '/api/offers/summary')
      body = { received_count: 0, sent_count: 0, received_pending: 0, sent_pending: 0 };
    else if (url.pathname === '/api/contracts/summary')
      body = {
        count: 0,
        active_count: 0,
        settled_count: 0,
        cancelled_count: 0,
        latest_active_id: null,
      };
    else if (url.pathname === '/api/holdings/summary')
      body = { count: 0, available_count: 0, available_kg: '0', commodities: [] };
    else if (url.pathname === '/api/farms/summary') body = { count: 0, owned_count: 0 };
    await route.fulfill({ json: body });
  });
  return {
    queries,
    setMode: (next: typeof mode) => {
      mode = next;
    },
  };
}
test('sourcing selector pages and searches server-side and retains a selected off-page brief', async ({
  page,
}) => {
  const state = await mock(page);
  await page.goto('/marketplace');
  const region = page.getByRole('region', { name: 'Sourcing request selector', exact: true });
  await region.getByRole('button', { name: 'Next sourcing requests', exact: true }).click();
  await region.getByLabel('Sourcing request', { exact: true }).selectOption(late);
  await expect(page).toHaveURL(new RegExp(`request=${late}`));
  await expect(region.getByText('Selected brief: Later shea brief', { exact: true })).toBeVisible();
  await region.getByRole('button', { name: 'Previous sourcing requests', exact: true }).click();
  await expect(region.getByLabel('Sourcing request', { exact: true })).toHaveValue(late);
  await region.getByLabel('Search your sourcing requests', { exact: true }).fill('%_shea');
  await expect
    .poll(() =>
      state.queries.some((query) => new URLSearchParams(query).get('search') === '%_shea'),
    )
    .toBe(true);
  await expect(region.getByLabel('Sourcing request', { exact: true })).toHaveValue(late);
  await expect(
    page.getByText('No published shea supply matches this request yet.', { exact: true }),
  ).toBeVisible();
});
test('request failure retries and malformed envelopes do not report an empty request history', async ({
  page,
}) => {
  const state = await mock(page);
  state.setMode('failed');
  await page.goto('/marketplace');
  const region = page.getByRole('region', { name: 'Sourcing request selector', exact: true });
  await expect(region.getByRole('alert')).toContainText('Sourcing requests unavailable');
  await expect(region.getByText('No sourcing requests match this search.')).toHaveCount(0);
  state.setMode('normal');
  await region.getByRole('button', { name: 'Retry sourcing requests', exact: true }).click();
  await expect(region.getByLabel('Sourcing request', { exact: true })).toBeVisible();
  state.setMode('malformed');
  await region.getByLabel('Search your sourcing requests', { exact: true }).fill('changed');
  await expect(region.getByRole('alert')).toContainText('Invalid page response');
});
test('buyer dashboard uses full request totals and does not infer zero after summary failure', async ({
  page,
}) => {
  const state = await mock(page);
  await page.goto('/home');
  await expect(
    page.getByText('Your sourcing requests', { exact: true }).locator('..'),
  ).toContainText('1005');
  await expect(page.getByText('Review matches for shea', { exact: true })).toBeVisible();
  state.setMode('summaryFailed');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(
    page.getByRole('alert').filter({ hasText: 'Sourcing totals could not be refreshed' }),
  ).toBeVisible();
  await expect(
    page.getByText('Your sourcing requests', { exact: true }).locator('..'),
  ).toContainText('Unavailable');
  await expect(page.getByText('Review matches for shea', { exact: true })).toHaveCount(0);
});

test('malformed request fields show an explicit failure instead of crashing marketplace matching', async ({
  page,
}) => {
  const state = await mock(page);
  state.setMode('badRow');
  await page.goto('/marketplace');
  const region = page.getByRole('region', { name: 'Sourcing request selector', exact: true });
  await expect(region.getByRole('alert')).toContainText('Invalid sourcing request page');
  await expect(region.getByText('No sourcing requests match this search.')).toHaveCount(0);
});
