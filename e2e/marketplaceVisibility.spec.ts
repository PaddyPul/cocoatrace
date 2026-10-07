import { test, expect, Page } from '@playwright/test';

// These tests exercise marketplace presentation against explicit API fixtures.
// Transaction and authorization guarantees remain covered by PostgreSQL tests.
const requestBrief = { id: 'cocoa-request', buyer_organization_id: 'buyer-org', status: 'open', title: 'Cocoa sourcing brief', commodity: 'cocoa', quantity_kg: 20, incoterm: 'FOB', origin_countries: [], assurance_requirements: {} };
function peanut(quantity: number) {
  return { id: 'peanut-listing', crop: 'peanut', source_name: 'Peanut inventory', seller_name: 'Supplier One', source_mode: 'direct_inventory', available_quantity_kg: quantity, price_per_kg: 10, incoterm: 'FOB', origin_location: 'Ghana', source_country: 'Ghana', organic_claim_status: 'not_claimed' };
}
async function mockWorkspace(page: Page, quantity: () => number) {
  await page.addInitScript(() => {
    localStorage.setItem('ct_user', JSON.stringify({ id: 'buyer', organizationId: 'buyer-org', roles: ['buyer_admin'], permissions: ['*'], name: 'Buyer' }));
    localStorage.setItem('ct_active_sourcing_request', 'cocoa-request');
  });
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const body = path === '/api/me' ? { id: 'buyer', organization_id: 'buyer-org', org_name: 'Buyer Org', name: 'Buyer', roles: ['buyer_admin'], permissions: ['*'] }
      : path === '/api/onboarding' ? { status: 'completed' }
      : path === '/api/listings/page' ? {items: url.searchParams.get('commodity') === 'cocoa' || url.searchParams.get('id') === 'unavailable-listing' ? [] : [peanut(quantity())], nextCursor:null, hasMore:false}
      : path === '/api/sourcing-requests' ? [requestBrief] : [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

test('ordinary marketplace browsing includes peanut despite a saved cocoa brief', async ({ page }) => {
  await mockWorkspace(page, () => 10);
  await page.goto('/marketplace');
  await expect(page.getByRole('heading', { name: 'Peanut inventory' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Browse all supply', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Published supply', { exact: true })).toBeVisible();
  await expect(page.getByText(/request match$/)).toHaveCount(0);
});

test('explicit request matching can be switched to all commodities', async ({ page }) => {
  await mockWorkspace(page, () => 6);
  await page.goto('/marketplace?request=cocoa-request');
  await expect(page.getByText('No published cocoa supply matches this request yet.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Peanut inventory' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Browse all supply', exact: true }).first().click();
  await expect(page).toHaveURL(/browse=all/);
  await expect(page.getByRole('heading', { name: 'Peanut inventory' })).toBeVisible();
  await expect(page.getByText('Supplier One · 6 kg available', { exact: true })).toBeVisible();
});

test('returning focus refreshes remaining quantity after acceptance in another workspace', async ({ page }) => {
  let quantity = 10;
  await mockWorkspace(page, () => quantity);
  await page.goto('/marketplace');
  await expect(page.getByText('Supplier One · 10 kg available', { exact: true })).toBeVisible();
  quantity = 6;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('Supplier One · 6 kg available', { exact: true })).toBeVisible();
  await expect(page.getByText('Supplier One · 10 kg available', { exact: true })).toHaveCount(0);
});

test('published listing link ignores an old request filter without claiming an absent listing is visible', async ({ page }) => {
  await mockWorkspace(page, () => 6);
  await page.goto('/marketplace?request=cocoa-request&published=peanut-listing');
  await expect(page.getByRole('heading', { name: 'Peanut inventory' })).toBeVisible();
  await expect(page.getByText('Your supply is visible in the marketplace', { exact: true })).toBeVisible();
  await page.goto('/marketplace?published=unavailable-listing');
  await expect(page.getByText('This listing is not currently available in the marketplace', { exact: true })).toBeVisible();
});
