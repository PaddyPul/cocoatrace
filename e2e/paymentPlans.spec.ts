import type { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { baseURL } from './support/environment';
import { createWorkspace } from './support/identity';
import { emptyPdfFixture } from './support/pdfFixture';
import { tradeSnapshot } from './support/tradeDatabase';

const modal = (page: Page) => page.locator('.modal');
const field = (page: Page, label: string) => modal(page).getByText(label, { exact: true }).locator('..').locator('input,select,textarea');
async function progress(page: Page, shipmentId: string, milestone: string, blocked = false) {
  await page.goto(`/shipments/${shipmentId}`);
  await page.getByRole('button', { name: 'Record progress', exact: true }).click();
  await field(page, 'Milestone').selectOption(milestone);
  const event = page.waitForResponse(r => r.url().endsWith(`/shipments/${shipmentId}/milestones`) && r.request().method() === 'POST');
  await modal(page).getByRole('button', { name: 'Record progress', exact: true }).click();
  expect((await event).status()).toBe(blocked ? 409 : 200);
  if (blocked) await modal(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  else await expect(modal(page)).toHaveCount(0);
}
async function submitAndVerify(buyer: Page, seller: Page, contractId: string, proof = false) {
  await buyer.goto(`/deal-room/${contractId}`);
  if (proof) {
    await expect(buyer.getByRole('button', { name: 'Submit payment', exact: true })).toBeDisabled();
    await buyer.getByLabel('Payment proof', { exact: true }).setInputFiles({ name: 'payment-proof.pdf', mimeType: 'application/pdf', buffer: emptyPdfFixture() });
    await expect(buyer.getByText('Proof attached: payment-proof.pdf', { exact: true })).toBeVisible();
  }
  await buyer.getByPlaceholder('Bank transaction reference').fill(`BROWSER-${Date.now()}`);
  await buyer.getByRole('button', { name: 'Submit payment', exact: true }).click();
  await expect(buyer.getByRole('button', { name: 'Submit payment', exact: true })).toHaveCount(0);
  await seller.goto(`/deal-room/${contractId}`);
  await seller.getByRole('button', { name: 'Confirm funds received', exact: true }).click();
  await expect(seller.getByRole('button', { name: 'Confirm funds received', exact: true })).toHaveCount(0);
}
async function shareDocuments(seller: Page, contractId: string) {
  await seller.goto(`/contracts/${contractId}`);
  for (const type of ['commercial_invoice', 'packing_list', 'transport_document']) {
    await seller.getByRole('button', { name: 'Add document', exact: true }).click();
    await field(seller, 'Document type').selectOption(type);
    await field(seller, 'File').setInputFiles({ name: `${type}.pdf`, mimeType: 'application/pdf', buffer: emptyPdfFixture() });
    await modal(seller).getByRole('button', { name: 'Share document', exact: true }).click();
    await expect(seller.getByText(`${type}.pdf`, { exact: true })).toBeVisible();
  }
  await seller.getByRole('button', { name: 'Present documents for payment', exact: true }).click();
  await expect(seller.getByRole('button', { name: 'Present documents for payment', exact: true })).toHaveCount(0);
}

for (const plan of ['deposit_balance', 'bank_secured', 'documentary_collection', 'pay_after_delivery']) {
  test(`real ${plan} journey: guided payment, documents, dispatch and settlement`, async ({ page: seller, browser }) => {
    test.setTimeout(300_000);
    const supplier = await createWorkspace(seller, browser, 'supplier');
    const buyerContext = await browser.newContext({ extraHTTPHeaders: { Origin: baseURL }, baseURL });
    try {
      const buyer = await buyerContext.newPage(); await createWorkspace(buyer, browser, 'buyer');
      const inventoryResponse = await seller.request.post('/api/inventory/direct', { data: { commodity: 'peanut', quantityKg: 10, inventoryDate: new Date().toISOString().slice(0, 10), sourceCountry: 'GH', sourceName: supplier.organization } });
      expect(inventoryResponse.status()).toBe(201); const inventory = await inventoryResponse.json();
      const listingResponse = await seller.request.post('/api/listings', { data: { holdingId: inventory.holding_id, availableQuantityKg: 10, pricePerKg: 5, incoterm: 'FOB', originLocation: 'Tema', destinationLocation: 'Rotterdam' } });
      expect(listingResponse.status()).toBe(201); const listing = await listingResponse.json();
      const offerResponse = await buyer.request.post(`/api/listings/${listing.id}/offers`, { data: { quantityKg: 4, offeredPricePerKg: 5, currency: 'EUR' } });
      expect(offerResponse.status()).toBe(201); const offer = await offerResponse.json();
      const accepted = await seller.request.post(`/api/offers/${offer.id}/accept`); expect(accepted.status()).toBe(200);
      const { contract, shipment, paymentRequest } = await accepted.json();
      await seller.goto(`/contracts/${contract.id}`);
      await seller.getByRole('button', { name: 'Set payment protection', exact: true }).click();
      await field(seller, 'Plan').selectOption(plan);
      const proof = plan === 'deposit_balance';
      if (proof) await seller.getByLabel('Require payment proof for every installment').check();
      await modal(seller).getByRole('button', { name: 'Propose terms', exact: true }).click();
      await expect(modal(seller)).toHaveCount(0);
      await buyer.goto(`/deal-room/${contract.id}`);
      await buyer.getByRole('button', { name: 'Confirm terms', exact: true }).click();
      await expect(buyer.getByRole('button', { name: 'Confirm terms', exact: true })).toHaveCount(0);
      if (plan === 'deposit_balance') {
        await progress(seller, shipment.id, 'loaded', true);
        await submitAndVerify(buyer, seller, contract.id, proof);
      }
      if (plan === 'bank_secured') {
        await progress(seller, shipment.id, 'loaded', true);
        await buyer.goto(`/payments/${paymentRequest.id}`);
        await buyer.getByPlaceholder('Bank / provider').fill('Externally checked bank');
        await buyer.getByPlaceholder('Guarantee or LC reference').fill('BROWSER-LC-123');
        await buyer.getByRole('button', { name: 'Submit bank security', exact: true }).click();
        await expect(buyer.getByRole('button', { name: 'Submit bank security', exact: true })).toHaveCount(0);
        await progress(seller, shipment.id, 'loaded', true);
        await seller.goto(`/payments/${paymentRequest.id}`);
        await seller.getByRole('button', { name: 'Accept externally checked bank security', exact: true }).click();
        await expect(seller.getByRole('button', { name: 'Accept externally checked bank security', exact: true })).toHaveCount(0);
      }
      // FOB transport is arranged by the buyer externally, then recorded here.
      await buyer.goto(`/shipments/${shipment.id}`);
      await buyer.getByRole('button', { name: 'Add arrangement', exact: true }).click();
      await field(buyer, 'Provider name').fill('External haulier');
      await field(buyer, 'Booking reference').fill('BROWSER-BOOKING');
      await field(buyer, 'Transport mode').selectOption('road');
      await field(buyer, 'Transport document').selectOption('road_consignment_note');
      await field(buyer, 'Document reference').fill('BROWSER-CONSIGNMENT');
      await modal(buyer).getByRole('button', { name: 'Save arrangement', exact: true }).click();
      await expect(modal(buyer)).toHaveCount(0);
      await progress(seller, shipment.id, 'loaded');
      if (plan !== 'pay_after_delivery') {
        await seller.goto(`/deal-room/${contract.id}`);
        await expect(seller.getByText('Present the trade document set', { exact: true })).toBeVisible();
        await shareDocuments(seller, contract.id);
        await submitAndVerify(buyer, seller, contract.id, proof);
      }
      await progress(seller, shipment.id, 'departed');
      await progress(buyer, shipment.id, 'arrived');
      await progress(buyer, shipment.id, 'customs_cleared');
      await progress(buyer, shipment.id, 'delivered');
      if (plan === 'pay_after_delivery') await submitAndVerify(buyer, seller, contract.id);
      await buyer.goto(`/deal-room/${contract.id}`);
      await buyer.getByLabel('Inspected quantity received (kg)', {exact:true}).fill('4');
      await buyer.getByLabel('Inspection note', {exact:true}).fill('Full quantity and condition inspected and accepted');
      await buyer.getByLabel('I inspected the full contract quantity and accept its condition.', {exact:true}).check();
      await buyer.getByRole('button', {name:'Accept full delivery',exact:true}).click();
      await expect(buyer.getByText('Trade completed', { exact: true })).toBeVisible();
      const snapshot = await tradeSnapshot(contract.id);
      expect(snapshot.contract.status).toBe('settled'); expect(Number(snapshot.payment.amount_confirmed)).toBe(20);
      expect(snapshot.transfers).toHaveLength(1); expect(snapshot.fees).toHaveLength(1); expect(snapshot.fees[0].status).toBe('invoiced');
      expect(snapshot.holdings.reduce((sum, item) => sum + Number(item.quantity_kg), 0)).toBe(10);
    } finally { await buyerContext.close(); }
  });
}
