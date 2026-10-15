import { test, expect } from '@playwright/test';

test('buyer reviews withdrawal confirmation and sees terminal history after server approval', async ({
  page,
}) => {
  const identity = {
    id: 'withdraw-buyer',
    organization_id: 'buyer',
    org_type: 'importer',
    roles: ['buyer_admin'],
    permissions: ['offer.create', 'contract.read'],
    name: 'Buyer',
  };
  await page.addInitScript(
    (user) =>
      localStorage.setItem(
        'ct_user',
        JSON.stringify({ ...user, organizationId: user.organization_id, orgType: user.org_type }),
      ),
    identity,
  );
  let withdrawn = false;
  let writes = 0;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/me') return route.fulfill({ json: identity });
    if (path === '/api/onboarding')
      return route.fulfill({ json: { status: 'completed', primary_goal: 'buy' } });
    if (path === '/api/offers/summary')
      return route.fulfill({
        json: {
          received_count: 0,
          sent_count: 1,
          received_pending: 0,
          sent_pending: withdrawn ? 0 : 1,
        },
      });
    if (path === '/api/offers/offer-withdraw/withdraw') {
      writes++;
      withdrawn = true;
      return route.fulfill({ json: { id: 'offer-withdraw', status: 'cancelled' } });
    }
    if (path === '/api/offers/page')
      return route.fulfill({
        json: {
          items: [
            {
              id: 'offer-withdraw',
              listing_id: 'listing-id',
              seller_name: 'Supplier',
              buyer_organization_id: 'buyer',
              quantity_kg: 1,
              offered_price_per_kg: 5,
              currency: 'EUR',
              status: withdrawn ? 'cancelled' : 'pending',
            },
          ],
          hasMore: false,
          nextCursor: null,
        },
      });
    return route.fulfill({ json: [] });
  });
  await page.goto('/offers?tab=sent');
  await page.getByRole('button', { name: 'Withdraw offer', exact: true }).click();
  await expect(page.getByText('Withdraw this pending offer?', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(writes).toBe(0);
  await page.getByRole('button', { name: 'Withdraw offer', exact: true }).click();
  await page.getByRole('button', { name: 'Withdraw', exact: true }).click();
  await expect(page.getByText('cancelled', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Withdraw offer', exact: true })).toHaveCount(0);
  expect(writes).toBe(1);
});
