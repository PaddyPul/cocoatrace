import { test, expect, Page } from '@playwright/test';

const supply = { id: 'recall-lot', batch_id: 'batch', seller_name: 'Supplier One', crop: 'peanut', organic_claim_status: 'none', source_mode: 'direct_inventory', source_name: 'Warehouse inventory', available_quantity_kg: 10, price_per_kg: 10, incoterm: 'FOB' };

async function mockRecallSupply(page: Page, row: () => object, rejectOffer = false) {
  let offerRequests = 0;
  await page.addInitScript(() => localStorage.setItem('ct_user', JSON.stringify({ id: 'buyer', organizationId: 'buyer-org', roles: ['buyer_admin'], permissions: ['*'], name: 'Buyer' })));
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'POST' && path.includes('offers')) {
      offerRequests += 1;
      await route.fulfill({ status: rejectOffer ? 409 : 201, contentType: 'application/json', body: JSON.stringify(rejectOffer ? { error: 'Active recall blocks new offers.' } : { id: 'offer' }) });
      return;
    }
    const body = path === '/api/me' ? { id: 'buyer', organization_id: 'buyer-org', name: 'Buyer', roles: ['buyer_admin'], permissions: ['*'] }
      : path === '/api/onboarding' ? { status: 'completed' }
      : path === '/api/listings/recall-lot' ? row()
      : path === '/api/listings' ? [row()] : [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return () => offerRequests;
}

test('active recalled supply explains its hold and prevents sending an offer', async ({ page }) => {
  const requests = await mockRecallSupply(page, () => ({ ...supply, activeRecall: true }));
  await page.goto('/listing/recall-lot');
  await expect(page.getByRole('alert')).toContainText('Supply on recall hold');
  await expect(page.getByRole('button', { name: 'Offers blocked — recall hold' })).toBeDisabled();
  expect(requests()).toBe(0);
});

test('a recall activated after opening supply disables the offer after refresh', async ({ page }) => {
  let activeRecall = false;
  await mockRecallSupply(page, () => ({ ...supply, activeRecall }));
  await page.goto('/listing/recall-lot');
  await expect(page.getByRole('button', { name: 'Send evidence-backed offer' })).toBeEnabled();
  activeRecall = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('button', { name: 'Offers blocked — recall hold' })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('New offers and material movement are blocked');
});

test('server recall rejection keeps the buyer on supply and refreshes the hold', async ({ page }) => {
  let activeRecall = false;
  const requests = await mockRecallSupply(page, () => ({ ...supply, activeRecall }), true);
  await page.goto('/listing/recall-lot');
  await expect(page.getByRole('button', { name: 'Send evidence-backed offer' })).toBeEnabled();
  activeRecall = true;
  await page.getByRole('button', { name: 'Send evidence-backed offer' }).click();
  await expect(page.getByText('Active recall blocks new offers.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Offers blocked — recall hold' })).toBeDisabled();
  expect(requests()).toBe(1);
  await expect(page.getByText('Offer submitted', { exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(/\/listing\/recall-lot$/);
});
