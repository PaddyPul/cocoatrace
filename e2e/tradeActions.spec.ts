import type { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { baseURL } from './support/environment';
import { createWorkspace } from './support/identity';

async function coherent(page: Page, contractId: string, title: string, actionable: boolean) {
  const dashboardResponse = await page.request.get('/api/trade-actions');
  const contractResponse = await page.request.get(`/api/contracts/${contractId}`);
  expect(dashboardResponse.status()).toBe(200);
  expect(contractResponse.status()).toBe(200);
  const action = (await contractResponse.json()).nextAction;
  expect(action.title).toBe(title);
  expect(action.requiresAction).toBe(actionable);
  expect((await dashboardResponse.json()).find((item: { contractId: string }) => item.contractId === contractId)).toEqual(action);
  await page.goto('/home');
  const card = page.getByTestId('dashboard-trade-action').filter({ hasText: title });
  await expect(card).toHaveAttribute('data-action-id', action.id);
  await card.click();
  // The dashboard opens the guided room for terms/payment, and transport for an assigned milestone.
  if (action.actionPath.startsWith('/deal-room/')) {
    await expect(page.getByTestId('deal-next-action')).toHaveAttribute('data-action-id', action.id);
    await expect(page.getByTestId('deal-next-action').getByRole('heading')).toHaveText(title);
  }
  await page.goto(`/contracts/${contractId}`);
  await expect(page.getByTestId('contract-next-action')).toHaveAttribute('data-action-id', action.id);
  await page.goto(`/deal-room/${contractId}`);
  await expect(page.getByTestId('deal-next-action').getByRole('heading')).toHaveText(title);
}

test('real buyer and supplier see one action through offer acceptance, terms, payment and FOB handoff', async ({ page: seller, browser }) => {
  test.setTimeout(240_000);
  const supplier = await createWorkspace(seller, browser, 'supplier');
  const context = await browser.newContext({ extraHTTPHeaders: { Origin: baseURL }, baseURL });
  try {
    const buyer = await context.newPage();
    await createWorkspace(buyer, browser, 'buyer');
    const inventoryResponse = await seller.request.post('/api/inventory/direct', { data: { commodity: 'peanut', quantityKg: 10, inventoryDate: new Date().toISOString().slice(0, 10), sourceCountry: 'GH', sourceName: supplier.organization } });
    expect(inventoryResponse.status()).toBe(201);
    const inventory = await inventoryResponse.json();
    const listingResponse = await seller.request.post('/api/listings', { data: { holdingId: inventory.holding_id, availableQuantityKg: 10, pricePerKg: 5, incoterm: 'FOB', originLocation: 'Tema', destinationLocation: 'Rotterdam' } });
    expect(listingResponse.status()).toBe(201);
    const listing = await listingResponse.json();
    const offerResponse = await buyer.request.post(`/api/listings/${listing.id}/offers`, { data: { quantityKg: 4, offeredPricePerKg: 5, currency: 'EUR' } });
    expect(offerResponse.status()).toBe(201);
    const offer = await offerResponse.json();
    const acceptance = await seller.request.post(`/api/offers/${offer.id}/accept`);
    expect(acceptance.status()).toBe(200);
    const { contract } = await acceptance.json();
    await coherent(seller, contract.id, 'Set the payment protection plan', true);
    await coherent(buyer, contract.id, 'Offer accepted—supplier preparing payment terms', false);
    expect((await seller.request.patch(`/api/contracts/${contract.id}/payment-terms`, { data: { paymentPlan: 'pay_before_dispatch', depositPercentage: 20, creditDays: 0, paymentEvidenceRequired: false } })).status()).toBe(200);
    await coherent(seller, contract.id, 'Payment terms sent—awaiting buyer confirmation', false);
    await coherent(buyer, contract.id, 'Review and confirm payment terms', true);
    await buyer.getByRole('button', { name: 'Confirm terms', exact: true }).click();
    await expect(buyer.getByRole('button', { name: 'Submit payment', exact: true })).toBeVisible();
    await coherent(buyer, contract.id, 'Complete the due payment', true);
    await coherent(seller, contract.id, 'Awaiting buyer payment', false);
    await buyer.getByPlaceholder('Bank transaction reference').fill('SHARED-BROWSER-PAYMENT');
    await buyer.getByRole('button', { name: 'Submit payment', exact: true }).click();
    await expect(buyer.getByRole('button', { name: 'Submit payment', exact: true })).toHaveCount(0);
    await coherent(buyer, contract.id, 'Payment submitted—awaiting supplier verification', false);
    await coherent(seller, contract.id, 'Verify funds received', true);
    await seller.getByRole('button', { name: 'Confirm funds received', exact: true }).click();
    await expect(seller.getByRole('button', { name: 'Confirm funds received', exact: true })).toHaveCount(0);
    await coherent(seller, contract.id, 'Awaiting buyer: booked', false);
    await coherent(buyer, contract.id, 'Next transport action: booked', true);
    await expect(seller.getByTestId('deal-next-action').getByRole('button', { name: 'Continue to transport' })).toHaveCount(0);
    await expect(buyer.getByTestId('deal-next-action').getByRole('button', { name: 'Continue to transport' })).toBeVisible();
  } finally { await context.close(); }
});
