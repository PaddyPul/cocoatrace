import { expect, test, type Page } from '@playwright/test';

const contract = '11111111-1111-4111-8111-111111111111';
const identity = {
  id: 'trader',
  organization_id: 'buyer',
  org_type: 'importer',
  roles: ['buyer_admin'],
  permissions: ['contract.read', 'offer.create'],
  name: 'Buyer',
};
async function signIn(page: Page) {
  await page.addInitScript(
    (user) =>
      localStorage.setItem(
        'ct_user',
        JSON.stringify({ ...user, organizationId: user.organization_id, orgType: user.org_type }),
      ),
    identity,
  );
}

for (const feature of [
  { endpoint: 'acceptance', region: 'Agreement acknowledgement', retry: 'Retry agreement' },
  { endpoint: 'delivery', region: 'Delivery acceptance', retry: 'Retry delivery record' },
  { endpoint: 'cancellation', region: 'Trade cancellation', retry: 'Retry cancellation status' },
]) {
  test(`${feature.region} retries its read without replaying a business action`, async ({
    page,
  }) => {
    await signIn(page);
    let reads = 0;
    const writes: string[] = [];
    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() !== 'GET') writes.push(path);
      if (path === '/api/me') return route.fulfill({ json: identity });
      if (path === '/api/onboarding')
        return route.fulfill({ json: { status: 'completed', primary_goal: 'buy' } });
      if (path === `/api/contracts/${contract}`)
        return route.fulfill({
          json: {
            id: contract,
            seller_organization_id: 'seller',
            buyer_organization_id: 'buyer',
            seller_name: 'Supplier',
            buyer_name: 'Buyer',
            quantity_kg: 100,
            price_per_kg: 5,
            currency: 'EUR',
            currency_minor_units: 2,
            incoterm: 'FOB',
            status: 'accepted',
            payment_terms_status: 'agreed',
            documents: [],
          },
        });
      if (path === `/api/contracts/${contract}/${feature.endpoint}`) {
        reads++;
        return route.fulfill({
          status: reads === 1 ? 503 : 403,
          json: { error: reads === 1 ? 'Review data unavailable' : 'Review access denied' },
        });
      }
      return route.fulfill({ status: 503, json: { error: 'Supporting data unavailable' } });
    });
    await page.goto(`/contracts/${contract}`);
    if (feature.endpoint === 'acceptance')
      await page.getByRole('button', { name: 'Review agreement version', exact: true }).click();
    const panel = page.getByRole('region', { name: feature.region, exact: true });
    await expect(panel.getByRole('alert')).toContainText('Review data unavailable');
    await panel.getByRole('button', { name: feature.retry, exact: true }).click();
    await expect(panel.getByRole('alert')).toContainText('Review access denied');
    expect(reads).toBe(2);
    expect(writes).toEqual([]);
    await expect(panel.getByText('Loading commercial record…', { exact: true })).toHaveCount(0);
  });
}

test('deal read failure can explicitly retry and keeps an access denial explicit', async ({
  page,
}) => {
  await signIn(page);
  let reads = 0;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/me') return route.fulfill({ json: identity });
    if (path === '/api/onboarding') return route.fulfill({ json: { status: 'completed' } });
    if (path === `/api/contracts/${contract}`) {
      reads++;
      return route.fulfill({
        status: reads === 1 ? 503 : 403,
        json: { error: reads === 1 ? 'Deal temporarily unavailable' : 'Deal access denied' },
      });
    }
    return route.fulfill({ json: {} });
  });
  await page.goto(`/deal-room/${contract}`);
  await expect(page.getByRole('alert')).toContainText('Deal temporarily unavailable');
  await page.getByRole('button', { name: 'Retry deal', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Deal access denied');
  expect(reads).toBe(2);
});

test('fee register distinguishes pending and malformed reads from a confirmed empty register', async ({
  page,
}) => {
  await signIn(page);
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reads = 0;
  const writes: string[] = [];
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== 'GET') writes.push(path);
    if (path === '/api/me') return route.fulfill({ json: identity });
    if (path === '/api/onboarding') return route.fulfill({ json: { status: 'completed' } });
    if (path === '/api/platform-fees') {
      reads++;
      if (reads === 1) {
        await waiting;
        return route.fulfill({ status: 503, json: { error: 'Fee register unavailable' } });
      }
      return route.fulfill({ json: reads === 2 ? { items: [] } : [] });
    }
    return route.fulfill({ json: {} });
  });
  await page.goto('/platform-fees');
  await expect(page.getByRole('status')).toContainText('Loading fee register');
  await expect(page.getByText(/No fee statements for your organization yet/)).toHaveCount(0);
  release();
  await expect(page.getByRole('alert')).toContainText('Fee register unavailable');
  await page.getByRole('button', { name: 'Retry fee register', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Invalid fee register response');
  await expect(page.getByText(/No fee statements for your organization yet/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry fee register', exact: true }).click();
  await expect(page.getByText(/No fee statements for your organization yet/)).toBeVisible();
  expect(reads).toBe(3);
  expect(writes).toEqual([]);
});
