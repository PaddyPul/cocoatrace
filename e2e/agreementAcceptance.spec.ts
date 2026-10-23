import { test, expect } from '@playwright/test';
const id = '11111111-1111-4111-8111-111111111111';
test('reviews an explicit version before acknowledging and shows independent party status', async ({
  page,
}) => {
  const identity = {
    id: 'actor',
    organization_id: 'buyer',
    org_type: 'importer',
    permissions: ['contract.read', 'offer.create'],
    roles: ['buyer_admin'],
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
  let writes = 0;
  let accepted: string | null = null;
  const state = () => ({
    schemaVersion: 1,
    version: 1,
    snapshotHash: 'a'.repeat(64),
    yourRole: 'buyer',
    canAccept: true,
    snapshot: {
      scope:
        'Base commercial record only. Payment protection and payment terms are confirmed separately and excluded. This acknowledgement is not a signed legal contract.',
      contractId: id,
      buyerOrganizationId: 'buyer',
      sellerOrganizationId: 'seller',
      offerId: 'offer',
      listingId: 'listing',
      holdingId: 'holding',
      quantityKg: '100',
      pricePerKg: '5',
      currency: 'EUR',
      incoterm: 'FOB',
      origin: 'Tema',
      destination: 'Rotterdam',
    },
    acceptances: { buyer: accepted, seller: null },
  });
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/me') return route.fulfill({ json: identity });
    if (path === '/api/onboarding')
      return route.fulfill({ json: { status: 'completed', primary_goal: 'buy' } });
    if (path === `/api/contracts/${id}/acceptance`) {
      if (route.request().method() === 'POST') {
        expect(route.request().postDataJSON()).toEqual({
          snapshotHash: 'a'.repeat(64),
          confirmed: true,
        });
        writes++;
        accepted = '2026-10-16T12:00:00Z';
      }
      return route.fulfill({ json: state() });
    }
    if (path === `/api/contracts/${id}`)
      return route.fulfill({
        json: {
          id,
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
    return route.fulfill({ status: 503, json: { error: 'Supporting data unavailable' } });
  });
  await page.goto(`/contracts/${id}?tab=activity`);
  await page.getByRole('button', { name: 'Review agreement version' }).click();
  const panel = page.getByRole('region', { name: 'Agreement acknowledgement' });
  await expect(panel).toContainText('not a signed legal contract');
  await expect(panel).toContainText('Tema');
  await expect(panel).toContainText('Rotterdam');
  const button = panel.getByRole('button', { name: 'Acknowledge reviewed version 1' });
  await expect(button).toBeDisabled();
  expect(writes).toBe(0);
  await panel.getByRole('checkbox').check();
  await button.click();
  await expect(panel).toContainText('Buyer: Acknowledged');
  await expect(panel).toContainText('Seller: Awaiting acknowledgement');
  expect(writes).toBe(1);
});
