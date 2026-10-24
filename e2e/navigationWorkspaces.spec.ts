import { test, expect, type Page } from '@playwright/test';
const buyerPermissions = [
  'listing.read',
  'offer.create',
  'contract.read',
  'shipment.read',
  'payment.read',
  'evidence.read',
  'batch.read',
  'certificate.read',
];
const sellerPermissions = [
  'listing.read',
  'listing.create',
  'offer.respond',
  'contract.read',
  'shipment.read',
  'payment.read',
  'holding.read',
  'farm.read',
  'batch.read',
  'evidence.read',
];
async function fixture(page: Page, role: 'buyer' | 'supplier' | 'dual' | 'admin') {
  let actor = {
    id: String(role),
    organization_id: `${role}-org`,
    org_type: role === 'admin' ? 'regulator' : role === 'supplier' ? 'exporter' : 'importer',
    name: 'Navigation tester',
    roles: [role + '_admin'],
    permissions:
      role === 'admin'
        ? ['*']
        : role === 'dual'
          ? [...new Set([...buyerPermissions, ...sellerPermissions])]
          : role === 'buyer'
            ? buyerPermissions
            : sellerPermissions,
  };
  await page.addInitScript((user) => {
    if (!localStorage.getItem('ct_user'))
      localStorage.setItem(
        'ct_user',
        JSON.stringify({ ...user, organizationId: user.organization_id, orgType: user.org_type }),
      );
  }, actor);
  const state = {
    failedCounts: false,
    failedRequests: false,
    foreign: false,
    queries: [] as string[],
    mutations: 0,
  };
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname;
    if (route.request().method() !== 'GET') state.mutations++;
    const row = {
      id: '11111111-1111-4111-8111-111111111111',
      buyer_organization_id: state.foreign ? 'unrelated-tenant' : actor.organization_id,
      title: state.foreign ? 'Private unrelated request' : 'Cocoyam for Berlin',
      commodity: 'cocoyam',
      quantity_kg: 10000,
      delivery_location: 'Berlin',
      incoterm: 'FOB',
      status: 'open',
      visibility: 'matched',
      origin_countries: ['GH'],
      quality_requirements: {},
      assurance_requirements: {},
      created_at: '2026-10-24T00:00:00Z',
    };
    if (path === '/api/me') return route.fulfill({ json: actor });
    if (path === '/api/onboarding')
      return route.fulfill({
        json: {
          status: 'completed',
          primary_goal: role === 'admin' ? 'review' : role === 'supplier' ? 'sell' : 'buy',
        },
      });
    if (path === '/api/offers/summary')
      return route.fulfill({
        json: state.failedCounts
          ? {}
          : { received_count: 3, received_pending: 1, sent_count: 4, sent_pending: 2 },
      });
    if (path === '/api/sourcing-requests/page') {
      state.queries.push(url.search);
      if (state.failedRequests)
        return route.fulfill({ status: 503, json: { error: 'Read unavailable' } });
      return route.fulfill({ json: { items: [row], hasMore: false, nextCursor: null } });
    }
    if (path === '/api/sourcing-requests/summary')
      return route.fulfill({
        json: {
          own_count: 1,
          open_count: 1,
          latest_own: row,
          latest_own_open: row,
          latest_open: row,
        },
      });
    if (path === '/api/trade-actions') return route.fulfill({ json: [] });
    if (path === '/api/listings/summary')
      return route.fulfill({ json: { count: 0, own_count: 0, quantity_kg: '0' } });
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
    if (path === '/api/holdings/summary')
      return route.fulfill({
        json: {
          count: 0,
          available_count: 0,
          available_kg: '0',
          committed_kg: '0',
          source_kg: '0',
        },
      });
    if (path === '/api/farms/summary') return route.fulfill({ json: { count: 0, owned_count: 0 } });
    if (path.endsWith('/page') || path === '/api/platform-fees')
      return route.fulfill({ json: { items: [], hasMore: false, nextCursor: null } });
    return route.fulfill({ status: 503, json: { error: 'Supporting read unavailable' } });
  });
  return {
    state,
    changeActor: (next: typeof actor) => {
      actor = next;
    },
    actor,
  };
}
const menu = (page: Page) =>
  page.getByRole('navigation', { name: 'Workspace navigation', exact: true });

test('buyer has direct saved requests, matching and review links without supplier or admin menu clutter', async ({
  page,
}) => {
  const { state } = await fixture(page, 'buyer');
  await page.goto('/home');
  await expect(menu(page).getByRole('button', { name: 'Find supply', exact: true })).toBeVisible();
  await expect(menu(page).getByRole('combobox')).toHaveCount(0);
  await expect(menu(page).getByRole('button', { name: 'Publish supply', exact: true })).toHaveCount(
    0,
  );
  await expect(
    menu(page).getByRole('button', { name: 'Access applications', exact: true }),
  ).toHaveCount(0);
  await menu(page).getByRole('button', { name: 'Sourcing requests', exact: true }).click();
  await expect(page).toHaveURL(/\/sourcing-requests$/);
  await expect(
    page.getByRole('heading', { name: 'Cocoyam for Berlin', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Find matching supply', exact: true }),
  ).toHaveAttribute('href', /\/marketplace\?request=/);
  expect(state.queries.every((query) => new URLSearchParams(query).get('mine') === 'true')).toBe(
    true,
  );
  await page.getByRole('link', { name: 'Review request', exact: true }).click();
  await expect(page.getByLabel('Commodity or material', { exact: true })).toHaveValue('cocoyam');
  expect(state.mutations).toBe(0);
});

test('supplier records are outside administration and trade-register search uses the same destinations', async ({
  page,
}) => {
  await fixture(page, 'supplier');
  await page.goto('/home');
  for (const name of ['Notifications', 'Trace & recall', 'Help']) {
    const bounds = await menu(page).getByRole('button', { name, exact: true }).boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(await page.evaluate(() => innerHeight));
  }

  await menu(page).getByText('Records', { exact: true }).click();
  await expect(menu(page).getByRole('button', { name: 'Inventory', exact: true })).toBeVisible();
  await expect(
    menu(page).getByRole('button', { name: 'Sources & plots', exact: true }),
  ).toBeVisible();
  await expect(
    menu(page).getByRole('button', { name: 'Sourcing requests', exact: true }),
  ).toHaveCount(0);
  await expect(
    menu(page).getByRole('button', { name: 'Goods payments', exact: true }),
  ).toBeHidden();
  await menu(page).getByText('Trade registers', { exact: true }).click();
  await expect(
    menu(page).getByRole('button', { name: 'Goods payments', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Control+k');
  const search = page.getByRole('dialog', { name: 'Find anything', exact: true });
  await search.getByRole('textbox', { name: 'Find anything', exact: true }).fill('Goods payments');
  await search.getByRole('button', { name: /Goods payments/ }).click();
  await expect(page).toHaveURL(/\/payments$/);
});

test('dual workspace choice persists and a different single-role account cannot inherit it', async ({
  page,
}) => {
  const setup = await fixture(page, 'dual');
  await page.goto('/home');
  await menu(page)
    .getByRole('combobox', { name: /Workspace/ })
    .selectOption('sell');
  await expect(page).toHaveURL(/mode=sell/);
  await expect(menu(page).getByRole('button', { name: 'My supply', exact: true })).toBeVisible();
  await page.reload();
  await expect(menu(page).getByRole('combobox', { name: /Workspace/ })).toHaveValue('sell');
  const next = {
    ...setup.actor,
    id: 'other-account',
    organization_id: 'other-org',
    permissions: buyerPermissions,
  };
  setup.changeActor(next);
  await page.evaluate((user) => {
    localStorage.setItem(
      'ct_user',
      JSON.stringify({ ...user, organizationId: user.organization_id, orgType: user.org_type }),
    );
    localStorage.setItem('bt_workspace_mode:other-account', 'sell');
  }, next);
  await page.goto('/home');
  await expect(menu(page).getByRole('combobox')).toHaveCount(0);
  await expect(menu(page).getByRole('button', { name: 'Find supply', exact: true })).toBeVisible();
  await expect(menu(page).getByRole('button', { name: 'My supply', exact: true })).toHaveCount(0);
});

test('platform admin has review navigation and can explicitly enter an authorized trading workspace', async ({
  page,
}) => {
  await fixture(page, 'admin');
  await page.goto('/home');
  await expect(
    page.getByRole('heading', { name: 'Platform review workspace', exact: true }),
  ).toBeVisible();
  await expect(
    menu(page).getByRole('button', { name: 'Access applications', exact: true }),
  ).toBeVisible();
  await expect(
    menu(page).getByRole('button', { name: 'Fee verification', exact: true }),
  ).toBeVisible();
  await expect(menu(page).getByRole('button', { name: 'Find supply', exact: true })).toHaveCount(0);
  await menu(page)
    .getByRole('combobox', { name: /Workspace/ })
    .selectOption('buy');
  await expect(menu(page).getByRole('button', { name: 'Find supply', exact: true })).toBeVisible();
});

test('offer badges clear on a malformed refresh and recover from actual server counts', async ({
  page,
}) => {
  const { state } = await fixture(page, 'supplier');
  await page.goto('/home');
  const offers = menu(page).getByRole('button', { name: 'Offers', exact: true });
  await expect(offers.getByText('1', { exact: true })).toBeVisible();
  state.failedCounts = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(offers.getByText('1', { exact: true })).toHaveCount(0);
  await expect(offers.getByText('0', { exact: true })).toHaveCount(0);
  state.failedCounts = false;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(offers.getByText('1', { exact: true })).toBeVisible();
});

test('saved-request failures and wrong-tenant rows never appear as an empty or usable request register', async ({
  page,
}) => {
  const { state } = await fixture(page, 'buyer');
  state.foreign = true;
  await page.goto('/sourcing-requests');
  await expect(
    page.getByRole('alert').filter({ hasText: 'Sourcing requests could not be loaded' }),
  ).toBeVisible();
  await expect(page.getByText('Private unrelated request', { exact: true })).toHaveCount(0);
  await expect(
    page.getByText('No saved sourcing requests match this search.', { exact: true }),
  ).toHaveCount(0);
  state.foreign = false;
  await page.getByRole('button', { name: 'Retry sourcing requests', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Cocoyam for Berlin', exact: true }),
  ).toBeVisible();
  expect(state.mutations).toBe(0);
});

test('mobile navigation closes after choosing My trades and preserves keyboard escape behavior', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page, 'buyer');
  await page.goto('/home');
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Open navigation', exact: true });
  await dialog.getByRole('button', { name: 'My trades', exact: true }).click();
  await expect(page).toHaveURL(/\/contracts$/);
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('#workspace-main')).toBeVisible();
  const trigger = page.getByRole('button', { name: 'Open navigation', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('cancelling unsaved-change review does not switch workspace or overwrite its preference', async ({
  page,
}) => {
  await fixture(page, 'dual');
  await page.goto('/source/new');
  await page
    .getByLabel('Sourcing brief', { exact: true })
    .fill('An unfinished cocoyam sourcing brief');
  await menu(page)
    .getByRole('combobox', { name: /Workspace/ })
    .selectOption('sell');
  const review = page.getByRole('dialog', { name: 'Leave unsaved changes?', exact: true });
  await review.getByRole('button', { name: 'Stay and keep editing', exact: true }).click();
  await expect(page).toHaveURL(/\/source\/new$/);
  await expect(menu(page).getByRole('combobox', { name: /Workspace/ })).toHaveValue('buy');
  expect(await page.evaluate(() => localStorage.getItem('bt_workspace_mode:dual'))).not.toBe(
    'sell',
  );
});

test('supplier direct access to buyer requests is denied before loading private request rows', async ({
  page,
}) => {
  const { state } = await fixture(page, 'supplier');
  await page.goto('/sourcing-requests');
  await expect(
    page.getByRole('alert').filter({ hasText: 'Sourcing requests require buyer access' }),
  ).toBeVisible();
  expect(state.queries).toEqual([]);
  expect(state.mutations).toBe(0);
});

test('workspace selection remains usable during the session when preference storage is blocked', async ({
  page,
}) => {
  await fixture(page, 'dual');
  await page.addInitScript(() => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (key.startsWith('bt_workspace_mode:')) throw new Error('Preference storage blocked');
      return original.call(this, key);
    };
  });
  await page.goto('/home');
  await menu(page)
    .getByRole('combobox', { name: /Workspace/ })
    .selectOption('sell');
  await expect(menu(page).getByRole('button', { name: 'My supply', exact: true })).toBeVisible();
  await menu(page).getByRole('button', { name: 'My trades', exact: true }).click();
  await expect(menu(page).getByRole('combobox', { name: /Workspace/ })).toHaveValue('sell');
});

for (const role of ['buyer', 'supplier'] as const) {
  test(`${role}: French workflow search opens My trades after reload`, async ({ page }) => {
    const { state } = await fixture(page, role);
    await page.goto('/home');
    await page.getByLabel('Language', { exact: true }).selectOption('fr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await page.reload();
    await expect(page.getByLabel('Langue', { exact: true })).toHaveValue('fr');
    await page.getByRole('button', { name: /Rechercher/ }).click();
    await page.getByPlaceholder('Rechercher une rubrique ou un parcours…').fill('Mes transactions');
    await page.getByRole('button', { name: /^Mes transactions\s/ }).click();
    await expect(page).toHaveURL(/\/contracts$/);
    await expect(
      page.getByRole('heading', { name: 'Mes transactions', exact: true }),
    ).toBeVisible();
    expect(state.mutations).toBe(0);
  });
}
