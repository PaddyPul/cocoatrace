import { test, expect, type Page } from '@playwright/test';
const farmId = '11111111-1111-4111-8111-111111111111';
const otherFarm = '22222222-2222-4222-8222-222222222222';
const identity = {
  id: 'user',
  organization_id: 'org',
  org_type: 'exporter',
  roles: ['supplier_admin'],
  permissions: [
    'farm.read',
    'farm.create',
    'batch.read',
    'batch.create',
    'listing.read',
    'offer.create',
    'contract.read',
    'payment.read',
  ],
  name: 'Tester',
};
const fee = {
  id: 'fee',
  contract_id: 'deal',
  status: 'invoiced',
  amount_total: '100',
  currency: 'EUR',
  currency_minor_units: 2,
  seller_name: 'Yam seller',
  buyer_name: 'Buyer',
  receipt_verified: false,
  pending_submission_count: 1,
  created_at: '2026-10-23T17:00:00Z',
  invoiced_at: '2026-10-23T17:01:00Z',
  latest_submission_at: '2026-10-23T17:02:00Z',
  paid_at: null,
};
const emptyPage = { items: [], hasMore: false, nextCursor: null };
test('an unrecognised sourcing commodity produces a precise missing-field message without publishing', async ({
  page,
}) => {
  await setup(page);
  let published = false;
  await page.route('**/api/sourcing-requests/structure', (route) =>
    route.fulfill({
      json: {
        commodity: '',
        quantityKg: 1000,
        deliveryLocation: 'Berlin',
        incoterm: 'FOB',
        originCountries: ['GH'],
        qualityRequirements: { moistureMax: 0 },
        assuranceRequirements: {},
        requiredBy: '2026-11-15',
        extractedFacts: [],
        unresolved: ['Commodity'],
      },
    }),
  );
  await page.route('**/api/sourcing-requests', (route) => {
    published = true;
    return route.fulfill({ status: 500 });
  });
  await page.goto('/source/new');
  await page
    .getByLabel('Sourcing brief', { exact: true })
    .fill('1 metric tonne of an unfamiliar crop from Ghana delivered to Berlin.');
  await page.getByRole('button', { name: 'Structure requirements', exact: true }).click();
  await page.getByRole('button', { name: 'Find matching supply', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Complete these reviewed fields: Commodity or material.',
  );
  expect(published).toBe(false);
});
async function setup(page: Page, admin = false) {
  const user = { ...identity, permissions: admin ? ['*'] : identity.permissions };
  await page.addInitScript(
    (actor) =>
      localStorage.setItem(
        'ct_user',
        JSON.stringify({
          ...actor,
          organizationId: actor.organization_id,
          orgType: actor.org_type,
        }),
      ),
    user,
  );
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/me') return route.fulfill({ json: user });
    if (path === '/api/onboarding')
      return route.fulfill({ json: { status: 'completed', primary_goal: 'sell' } });
    if (path === '/api/trade-actions') return route.fulfill({ json: [] });
    if (path === '/api/platform-fees')
      return route.fulfill({ json: { ...emptyPage, items: [fee] } });
    if (path === '/api/listings/summary')
      return route.fulfill({ json: { count: 0, own_count: 0, quantity_kg: '0' } });
    if (path === '/api/holdings/summary')
      return route.fulfill({
        json: { count: 0, available_count: 0, available_kg: '0', commodities: [] },
      });
    if (path === '/api/farms/summary') return route.fulfill({ json: { count: 0, owned_count: 0 } });
    if (path === '/api/contracts/summary')
      return route.fulfill({
        json: {
          count: 0,
          active_count: 0,
          settled_count: 0,
          cancelled_count: 0,
          latest_active_id: null,
        },
      });
    if (path === '/api/offers/summary')
      return route.fulfill({
        json: { received_count: 0, sent_count: 0, received_pending: 0, sent_pending: 0 },
      });
    if (path === '/api/sourcing-requests/summary')
      return route.fulfill({
        json: {
          count: 0,
          own_count: 0,
          open_count: 0,
          open_quantity_kg: '0',
          latest_open: null,
          latest_own: null,
          latest_own_open: null,
        },
      });
    if (path.endsWith('/page')) return route.fulfill({ json: emptyPage });
    return route.fulfill({ status: 503, json: { error: 'Supporting data unavailable' } });
  });
}
test('farm entry uses a cooperative identifier and starts plot crop entry blank', async ({
  page,
}) => {
  await setup(page);
  await page.route('**/api/farms', (route) => route.fulfill({ status: 201, json: { id: farmId } }));
  await page.goto('/farms');
  await page.getByRole('button', { name: '+ Create Farm', exact: true }).first().click();
  await expect(page.getByPlaceholder('Farming cooperative ID', { exact: true })).toBeVisible();
  await page.getByPlaceholder('Farm name *', { exact: true }).fill('Yam farm');
  await page.getByPlaceholder('Region *', { exact: true }).fill('Northern');
  await page.getByPlaceholder('District *', { exact: true }).fill('Tamale');
  await page.locator('.modal').getByRole('button', { name: 'Create Farm', exact: true }).click();
  await page.getByRole('button', { name: '+ Add Plot', exact: true }).click();
  await expect(
    page.getByPlaceholder('Crops on this plot (e.g. yam, maize) *', { exact: true }),
  ).toHaveValue('');
});
test('batch crop follows the selected farm plots and mixed crops require an explicit choice', async ({
  page,
}) => {
  await setup(page);
  await page.route('**/api/farms/page?*', (route) =>
    route.fulfill({
      json: {
        ...emptyPage,
        items: [
          { id: farmId, name: 'Yam farm', region: 'Northern' },
          { id: otherFarm, name: 'Mixed farm', region: 'Northern' },
        ],
      },
    }),
  );
  await page.route(`**/api/farms/${farmId}/plots/summary`, (route) =>
    route.fulfill({ json: { count: 3, crops: ['yam'] } }),
  );
  await page.route(`**/api/farms/${otherFarm}/plots/summary`, (route) =>
    route.fulfill({ json: { count: 2, crops: ['maize', 'yam'] } }),
  );
  await page.goto('/batches');
  await page.getByRole('button', { name: '+ Create Batch', exact: true }).first().click();
  await expect(page.getByLabel('Batch crop', { exact: true })).toHaveValue('');
  await page.getByLabel('Select source farm', { exact: true }).selectOption(farmId);
  await expect(page.getByLabel('Batch crop', { exact: true })).toHaveValue('yam');
  await page.getByLabel('Select source farm', { exact: true }).selectOption(otherFarm);
  await expect(page.getByText(/This farm has multiple crops/)).toBeVisible();
  await expect(page.getByLabel('Batch crop', { exact: true })).toHaveValue('');
});
test('a 100 kg lot against a ten-tonne brief requires an informed partial-order acknowledgement', async ({
  page,
}) => {
  await setup(page);
  await page.route('**/api/listings/lot', (route) =>
    route.fulfill({
      json: {
        id: 'lot',
        seller_organization_id: 'seller',
        available_quantity_kg: 100,
        price_per_kg: 3,
        crop: 'yam',
        currency: 'EUR',
        incoterm: 'FOB',
      },
    }),
  );
  await page.route('**/api/sourcing-requests/page?*', (route) =>
    route.fulfill({
      json: {
        ...emptyPage,
        items: [
          {
            id: 'brief',
            buyer_organization_id: 'org',
            quantity_kg: 10000,
            commodity: 'yam',
            title: 'Yam brief',
            status: 'open',
            incoterm: 'FOB',
            delivery_location: 'Berlin',
          },
        ],
      },
    }),
  );
  await page.goto('/listing/lot?request=brief');
  await expect(page.getByText('Partial order', { exact: true })).toBeVisible();
  await expect(page.getByText(/9,900 kg of the requested quantity is not covered/)).toBeVisible();
  const send = page.getByRole('button', { name: /Send.*offer/i });
  await expect(send).toBeDisabled();
  await page
    .getByLabel(
      'I understand this is a partial order and the remaining quantity must be sourced separately.',
    )
    .check();
  await expect(send).toBeEnabled();
});
test('admin home exposes pending receipt reviews and fee search uses server filters and timestamps', async ({
  page,
}) => {
  await setup(page, true);
  const queries: URLSearchParams[] = [];
  await page.route('**/api/platform-fees?*', (route) => {
    queries.push(new URL(route.request().url()).searchParams);
    return route.fulfill({ json: { ...emptyPage, items: [fee] } });
  });
  await page.goto('/home');
  const queue = page.getByRole('region', { name: 'Platform finance actions' });
  await expect(
    queue.getByText('Payment reference submitted — receipt verification pending'),
  ).toBeVisible();
  expect(queries.some((query) => query.get('review') === 'pending')).toBe(true);
  await page.getByRole('link', { name: 'Open platform fee register', exact: true }).click();
  await expect(page.getByText('Created: 23 Oct 2026, 17:00:00 UTC')).toBeVisible();
  await page.getByLabel('Search fees', { exact: true }).fill('Yam seller');
  await page.getByLabel('Receipt review', { exact: true }).selectOption('pending');
  await expect
    .poll(() =>
      queries.some(
        (query) => query.get('search') === 'Yam seller' && query.get('review') === 'pending',
      ),
    )
    .toBe(true);
});
test('delivery inspection controls precede collapsed fee details and have a direct next-action link', async ({
  page,
}) => {
  await setup(page);
  await page.route('**/api/contracts/deal', (route) =>
    route.fulfill({
      json: {
        id: 'deal',
        status: 'delivered',
        current_milestone: 'delivered',
        buyer_organization_id: 'org',
        seller_organization_id: 'seller',
        quantity_kg: 100,
        price_per_kg: 3,
        currency: 'EUR',
        nextAction: {
          id: 'deal:deal:acceptance',
          kind: 'delivery',
          requiresAction: true,
          title: 'Inspect and accept delivered goods',
          description: 'Inspect before accepting.',
          actionPath: '/deal-room/deal',
          actionLabel: 'Review delivery',
        },
      },
    }),
  );
  await page.goto('/deal-room/deal');
  await expect(
    page.getByRole('link', { name: 'Inspect delivered goods', exact: true }),
  ).toHaveAttribute('href', '#delivery-acceptance');
  const inspection = page.locator('#delivery-acceptance');
  await expect(inspection).toBeVisible();
  const details = page
    .locator('details')
    .filter({ has: page.getByText('Platform fee details and receipt', { exact: true }) });
  await expect(details).not.toHaveAttribute('open');
  expect(
    await inspection.evaluate((node) =>
      Boolean(
        node.compareDocumentPosition(
          [...document.querySelectorAll('summary')].find(
            (summary) => summary.textContent === 'Platform fee details and receipt',
          )!.parentElement!,
        ) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ),
  ).toBe(true);
});
