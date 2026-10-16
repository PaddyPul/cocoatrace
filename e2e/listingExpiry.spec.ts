import { test, expect } from '@playwright/test';
test('supplier reviews expiry and retains reason after renewal failure', async ({ page }) => {
  const listing = {
    id: '11111111-1111-4111-8111-111111111111',
    seller_organization_id: 'supplier',
    active: true,
    expires_at: '2000-01-01T00:00:00Z',
    farm_name: 'Reviewed stock',
    available_quantity_kg: 50,
    price_per_kg: 10,
    currency: 'EUR',
    incoterm: 'FOB',
    organic_claim_status: 'not_claimed',
  };
  await page.addInitScript(() =>
    localStorage.setItem(
      'ct_user',
      JSON.stringify({
        id: 'seller',
        organizationId: 'supplier',
        roles: ['exporter_admin'],
        permissions: ['*'],
        name: 'Supplier',
      }),
    ),
  );
  let calls = 0;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/renew')) {
      calls++;
      const body = route.request().postDataJSON();
      expect(body.reason).toBe('Stock reviewed with warehouse');
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Insufficient current inventory to renew this quantity' }),
      });
      return;
    }
    const body =
      path === '/api/me'
        ? {
            id: 'seller',
            organization_id: 'supplier',
            org_name: 'Supplier',
            roles: ['exporter_admin'],
            permissions: ['*'],
          }
        : path === '/api/onboarding'
          ? { status: 'completed' }
          : path === '/api/listings/page'
            ? { items: [listing], hasMore: false, nextCursor: null }
            : [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
  await page.goto('/my-listings');
  await expect(page.getByText(/Expired ·/)).toBeVisible();
  await page.getByRole('button', { name: 'Review and renew' }).click();
  await expect(page.getByText(/rejects all pending offers/)).toBeVisible();
  await page.getByLabel('Renewal reason').fill('Stock reviewed with warehouse');
  await page.getByRole('button', { name: 'Confirm renewal' }).click();
  await expect(page.getByRole('alert')).toContainText('Insufficient current inventory');
  await expect(page.getByLabel('Renewal reason')).toHaveValue('Stock reviewed with warehouse');
  expect(calls).toBe(1);
});

test('direct buyer listing link explains expiry and blocks offer submission', async ({ page }) => {
  const id = '11111111-1111-4111-8111-111111111111';
  const buyer = {
    id: 'buyer',
    organizationId: 'buyer-org',
    orgType: 'importer',
    roles: ['buyer'],
    permissions: ['listing.read', 'offer.create'],
    name: 'Buyer',
  };
  await page.addInitScript((user) => localStorage.setItem('ct_user', JSON.stringify(user)), buyer);
  let writes = 0;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'POST') writes++;
    const body =
      path === '/api/me'
        ? { ...buyer, organization_id: 'buyer-org', org_type: 'importer' }
        : path === '/api/onboarding'
          ? { status: 'completed', primary_goal: 'buy' }
          : path === `/api/listings/${id}`
            ? {
                id,
                seller_organization_id: 'supplier',
                seller_name: 'Supplier',
                active: true,
                expires_at: '2000-01-01T00:00:00Z',
                available_quantity_kg: 50,
                price_per_kg: 10,
                currency: 'EUR',
                incoterm: 'FOB',
                crop: 'peanut',
                organic_claim_status: 'none',
              }
            : {};
    await route.fulfill({ json: body });
  });
  await page.goto(`/listing/${id}`);
  await expect(page.getByText('Expired supply', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Offers blocked — publication unavailable', exact: true }),
  ).toBeDisabled();
  expect(writes).toBe(0);
});
