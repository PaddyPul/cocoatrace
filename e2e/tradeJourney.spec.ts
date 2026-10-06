import type { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { baseURL } from './support/environment';
import { createWorkspace } from './support/identity';
import { tradeSnapshot } from './support/tradeDatabase';
import { emptyPdfFixture } from './support/pdfFixture';

const modal = (page: Page) => page.locator('.modal');
const modalField = (page: Page, label: string) => modal(page).getByText(label, { exact: true }).locator('..').locator('input,select,textarea');

async function recordProgress(page: Page, shipmentId: string, milestone: string, blocked = false) {
  await page.goto(`/shipments/${shipmentId}`);
  await page.getByRole('button', { name: 'Record progress', exact: true }).click();
  await modalField(page, 'Milestone').selectOption(milestone);
  const responseEvent = page.waitForResponse(response => response.url().endsWith(`/api/shipments/${shipmentId}/milestones`) && response.request().method() === 'POST');
  await modal(page).getByRole('button', { name: 'Record progress', exact: true }).click();
  const response = await responseEvent;
  if (blocked) {
    expect(response.status()).toBe(409);
    const rejected = await response.json();
    expect(rejected.code).toBe('PAYMENT_DISPATCH_GATE');
    await expect(modal(page).getByText(rejected.error, { exact: true })).toBeVisible();
    await modal(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  } else {
    expect(response.status()).toBe(200);
    await expect(modal(page)).toHaveCount(0);
  }
}

// Creates real identities and trades against the dedicated browser stack. Only
// initial inventory and publication are API fixtures; all commercial mutations
// below use the actual UI. No mocked routes, session shortcuts or DB writes.
test('full prepayment trade: offer, verified payment gate, document sharing, delivery and exact custody settlement', async ({ page: supplier, browser }) => {
  test.setTimeout(240_000);
  const supplierIdentity = await createWorkspace(supplier, browser, 'supplier');
  const buyerContext = await browser.newContext({ extraHTTPHeaders: { Origin: baseURL }, baseURL });
  try {
    const buyer = await buyerContext.newPage();
    await createWorkspace(buyer, browser, 'buyer');
    const supplierAccount = await (await supplier.request.get('/api/me')).json();
    const buyerAccount = await (await buyer.request.get('/api/me')).json();
    const inventoryResponse = await supplier.request.post('/api/inventory/direct', { data: { commodity: 'peanut', quantityKg: 10, inventoryDate: new Date().toISOString().slice(0, 10), sourceCountry: 'GH', sourceName: supplierIdentity.organization } });
    expect(inventoryResponse.status()).toBe(201);
    const inventory = await inventoryResponse.json();
    const listingResponse = await supplier.request.post('/api/listings', { data: { holdingId: inventory.holding_id, availableQuantityKg: 10, pricePerKg: 5, currency: 'EUR', incoterm: 'FOB', originLocation: 'Tema', destinationLocation: 'Rotterdam' } });
    expect(listingResponse.status()).toBe(201);
    const listing = await listingResponse.json();

    await buyer.goto('/marketplace');
    await buyer.getByPlaceholder('Search supply, origin or supplier…').fill(supplierIdentity.organization);
    await buyer.locator('article').filter({ hasText: supplierIdentity.organization }).getByRole('button', { name: 'View supply details' }).click();
    await expect(buyer).toHaveURL(new RegExp(`/listing/${listing.id}$`));
    await buyer.getByLabel('Quantity (kg)').fill('4');
    expect(listing.currency).toBe('EUR');
    await buyer.getByLabel(`Price per kg (${listing.currency})`, { exact: true }).fill('5');
    const offerEvent = buyer.waitForResponse(response => response.url().endsWith(`/api/listings/${listing.id}/offers`) && response.request().method() === 'POST');
    await buyer.getByRole('button', { name: 'Send evidence-backed offer' }).click();
    expect((await offerEvent).status()).toBe(201);
    await expect(buyer.getByText('Offer submitted', { exact: true })).toBeVisible();
    await expect(buyer).toHaveURL(/\/home\?mode=buy$/);

    await supplier.goto('/offers');
    const acceptanceEvent = supplier.waitForResponse(response => /\/api\/offers\/[^/]+\/accept$/.test(response.url()) && response.request().method() === 'POST');
    await supplier.getByRole('button', { name: 'Accept', exact: true }).click();
    const acceptanceResponse = await acceptanceEvent;
    expect(acceptanceResponse.status()).toBe(200);
    const { contract, shipment } = await acceptanceResponse.json();
    await expect(supplier).toHaveURL(new RegExp(`/deal-room/${contract.id}$`));
    await expect(supplier.getByText('Set the payment protection plan', { exact: true })).toBeVisible();
    await buyer.goto(`/deal-room/${contract.id}`);
    await expect(buyer.getByText('Offer accepted—supplier preparing payment terms', { exact: true })).toBeVisible();
    await expect(buyer.getByRole('button', { name: 'Confirm terms', exact: true })).toHaveCount(0);

    const reserved = await tradeSnapshot(contract.id);
    expect(reserved.holdings.reduce((total, item) => total + Number(item.quantity_kg), 0)).toBe(10);
    expect(reserved.holdings.find(item => item.id === contract.holding_id)?.status).toBe('committed');
    expect(reserved.holdings.every(item => item.holder_organization_id === supplierAccount.organization_id)).toBe(true);
    await buyer.goto('/marketplace');
    await buyer.getByPlaceholder('Search supply, origin or supplier…').fill(supplierIdentity.organization);
    await expect(buyer.locator('article').filter({ hasText: supplierIdentity.organization }).getByText(/6 kg available/)).toBeVisible();

    await supplier.getByRole('button', { name: 'Configure protection' }).click();
    await supplier.getByRole('button', { name: 'Set payment protection', exact: true }).click();
    await modalField(supplier, 'Plan').selectOption('pay_before_dispatch');
    await modal(supplier).getByRole('button', { name: 'Propose terms' }).click();
    await expect(modal(supplier)).toHaveCount(0);
    await buyer.goto(`/deal-room/${contract.id}`);
    await buyer.getByRole('button', { name: 'Confirm terms', exact: true }).click();
    await expect(buyer.getByRole('button', { name: 'Submit payment', exact: true })).toBeVisible();

    // Neither agreed terms nor a buyer's reference is evidence of received funds.
    await recordProgress(supplier, shipment.id, 'loaded', true);
    let snapshot = await tradeSnapshot(contract.id);
    expect(snapshot.shipments[0].current_milestone).toBe('planning');
    expect(Number(snapshot.payment.amount_confirmed)).toBe(0);
    await buyer.getByPlaceholder('Bank transaction reference').fill('BROWSER-PREPAYMENT-20-EUR');
    await buyer.getByRole('button', { name: 'Submit payment', exact: true }).click();
    await expect(buyer.getByRole('button', { name: 'Submit payment', exact: true })).toHaveCount(0);
    await recordProgress(supplier, shipment.id, 'loaded', true);
    snapshot = await tradeSnapshot(contract.id);
    expect(snapshot.shipments[0].current_milestone).toBe('planning');
    expect(Number(snapshot.payment.amount_confirmed)).toBe(0);
    await supplier.goto(`/deal-room/${contract.id}`);
    await supplier.getByRole('button', { name: 'Confirm funds received', exact: true }).click();
    await expect(supplier.getByText('Payment gate cleared—prepare dispatch', { exact: true })).toBeVisible();
    snapshot = await tradeSnapshot(contract.id);
    expect(snapshot.payment.status).toBe('settled');
    expect(Number(snapshot.payment.amount_confirmed)).toBe(20);
    expect(snapshot.contract.status).not.toBe('settled');
    expect(snapshot.holdings.find(item => item.id === contract.holding_id)?.holder_organization_id).toBe(supplierAccount.organization_id);

    // The buyer coordinates FOB transport without a carrier account.
    await buyer.goto(`/shipments/${shipment.id}`);
    await buyer.getByRole('button', { name: 'Add arrangement', exact: true }).click();
    await modalField(buyer, 'Provider name').fill('Browser external haulier');
    await modalField(buyer, 'Booking reference').fill('BROWSER-BOOKING-1');
    await modalField(buyer, 'Transport mode').selectOption('road');
    await modalField(buyer, 'Transport document').selectOption('road_consignment_note');
    await modalField(buyer, 'Document reference').fill('BROWSER-CONSIGNMENT-1');
    await modal(buyer).getByRole('button', { name: 'Save arrangement' }).click();
    await expect(modal(buyer)).toHaveCount(0);

    await supplier.goto(`/contracts/${contract.id}`);
    await supplier.getByRole('button', { name: 'Add document', exact: true }).click();
    await modalField(supplier, 'Document type').selectOption('commercial_invoice');
    await modalField(supplier, 'File').setInputFiles({ name: 'trade-invoice.pdf', mimeType: 'application/pdf', buffer: emptyPdfFixture() });
    await modal(supplier).getByRole('button', { name: 'Share document', exact: true }).click();
    await expect(supplier.getByText('trade-invoice.pdf', { exact: true })).toBeVisible();
    await buyer.goto(`/contracts/${contract.id}`);
    const downloadEvent = buyer.waitForEvent('download');
    await buyer.getByRole('button', { name: 'Download', exact: true }).click();
    expect((await downloadEvent).suggestedFilename()).toBe('trade-invoice.pdf');

    await recordProgress(supplier, shipment.id, 'loaded');
    await recordProgress(supplier, shipment.id, 'departed');
    await recordProgress(buyer, shipment.id, 'arrived');
    await recordProgress(buyer, shipment.id, 'customs_cleared');
    await recordProgress(buyer, shipment.id, 'delivered');
    await buyer.goto(`/deal-room/${contract.id}`);
    // A paid and delivered trade stays committed until the buyer accepts it.
    const deliveredSnapshot = await tradeSnapshot(contract.id);
    expect(deliveredSnapshot.contract.status).toBe('delivered');
    expect(deliveredSnapshot.transfers).toHaveLength(0);
    await buyer.getByLabel('Actual received quantity (kg)', {exact:true}).fill('3');
    await buyer.getByLabel('Explain the discrepancy', {exact:true}).fill('One kilogram missing from the received delivery');
    const deliveryIntent = buyer.waitForResponse(response => response.url().endsWith('/evidence/upload-intents') && response.request().method() === 'POST');
    await buyer.getByLabel('Delivery evidence (PDF, JPEG or PNG)', {exact:true}).setInputFiles({name:'delivery-inspection.pdf',mimeType:'application/pdf',buffer:emptyPdfFixture()});
    const createdDeliveryIntent = await deliveryIntent;
    expect(createdDeliveryIntent.status(), JSON.stringify(await createdDeliveryIntent.json())).toBe(201);
    await expect(buyer.getByText('Delivery evidence attached.', {exact:true})).toBeVisible();
    await buyer.getByRole('button',{name:'Report delivery discrepancy',exact:true}).click();
    await expect(buyer.getByText('Delivery discrepancy hold',{exact:true})).toBeVisible();
    await supplier.goto(`/deal-room/${contract.id}`);
    await supplier.getByLabel('Supplier resolution explanation',{exact:true}).fill('Missing goods replaced externally; buyer will inspect all four kilograms');
    await supplier.getByRole('button',{name:'Propose delivery resolution',exact:true}).click();
    await buyer.reload();
    await buyer.getByRole('button',{name:'Approve delivery resolution',exact:true}).click();
    await expect(buyer.getByText('Delivery discrepancy resolved',{exact:true})).toBeVisible();
    expect((await tradeSnapshot(contract.id)).transfers).toHaveLength(0);
    await buyer.getByLabel('Inspected quantity received (kg)', {exact:true}).fill('4');
      await buyer.getByLabel('Inspection note', {exact:true}).fill('Full quantity and condition inspected and accepted');
      await buyer.getByLabel('I inspected the full contract quantity and accept its condition.', {exact:true}).check();
      await buyer.getByRole('button', {name:'Accept full delivery',exact:true}).click();
      await expect(buyer.getByText('Trade completed', { exact: true })).toBeVisible();
    await supplier.goto(`/deal-room/${contract.id}`);
    await expect(supplier.getByText('Trade completed', { exact: true })).toBeVisible();

    const completed = await tradeSnapshot(contract.id);
    expect(completed.contract.status).toBe('settled');
    expect(completed.contract.completed_at).toBeTruthy();
    expect(completed.payment.status).toBe('settled');
    expect(Number(completed.payment.amount_confirmed)).toBe(20);
    expect(completed.holdings.filter(item => item.holder_organization_id === buyerAccount.organization_id).map(item => ({ quantity: Number(item.quantity_kg), status: item.status }))).toEqual([{ quantity: 4, status: 'available' }]);
    expect(completed.holdings.filter(item => item.holder_organization_id === supplierAccount.organization_id).map(item => ({ quantity: Number(item.quantity_kg), status: item.status }))).toEqual([{ quantity: 6, status: 'available' }]);
    expect(completed.holdings.reduce((total, item) => total + Number(item.quantity_kg), 0)).toBe(10);
    expect(completed.transfers).toHaveLength(1);
    expect(Number(completed.transfers[0].quantity_kg)).toBe(4);
    expect(completed.fees).toHaveLength(1);
    expect(completed.fees[0].status).toBe('invoiced');
    expect(Number(completed.fees[0].amount_total)).toBe(Math.round(20 * Number(completed.fees[0].rate_bps) / 100) / 100);
    expect(completed.distributions).toHaveLength(1);
    expect(completed.distributions[0].recipient_organization_id).toBe(buyerAccount.organization_id);
    expect(Number(completed.distributions[0].quantity_kg)).toBe(4);
    // There is no UI action to replay delivered. A forced repeat must fail and
    // leave custody, quantities and fee/distribution counts unchanged.
    const duplicateDelivery = await buyer.request.post(`/api/shipments/${shipment.id}/milestones`, { data: { milestone: 'delivered' } });
    expect(duplicateDelivery.status()).toBe(400);
    const unchanged = await tradeSnapshot(contract.id);
    expect(unchanged.holdings).toEqual(completed.holdings);
    expect(unchanged.transfers).toEqual(completed.transfers);
    expect(unchanged.fees).toEqual(completed.fees);
    expect(unchanged.distributions).toEqual(completed.distributions);
  } finally { await buyerContext.close(); }
});
