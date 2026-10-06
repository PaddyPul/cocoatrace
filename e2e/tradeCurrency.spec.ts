import { test, expect } from './support/fixtures';
import { baseURL } from './support/environment';
import { createWorkspace } from './support/identity';

test('GHS listing displays its currency and the buyer UI submits GHS rather than EUR', async ({page:seller,browser}) => {
  test.setTimeout(180_000);
  const identity=await createWorkspace(seller,browser,'supplier');
  const context=await browser.newContext({extraHTTPHeaders: { Origin: baseURL },baseURL});
  try {
    const buyer=await context.newPage();
    await createWorkspace(buyer,browser,'buyer');
    const inventory=await seller.request.post('/api/inventory/direct',{data:{commodity:'peanut',quantityKg:10,inventoryDate:new Date().toISOString().slice(0,10),sourceCountry:'GH',sourceName:identity.organization}});
    expect(inventory.status()).toBe(201);
    const stock=await inventory.json();
    const response=await seller.request.post('/api/listings',{data:{holdingId:stock.holding_id,availableQuantityKg:10,pricePerKg:4.04,currency:'GHS',incoterm:'FOB',originLocation:'Tema',destinationLocation:'London'}});
    expect(response.status()).toBe(201);
    const listing=await response.json();
    await buyer.goto(`/listing/${listing.id}`);
    await expect(buyer.getByText('GHS 4.0400/kg',{exact:true})).toBeVisible();
    await buyer.locator('input[type="number"]').first().fill('0.125');
    const submitted=buyer.waitForResponse(r=>r.url().endsWith(`/listings/${listing.id}/offers`) && r.request().method()==='POST');
    await buyer.getByRole('button',{name:'Send evidence-backed offer'}).click();
    const offerResponse=await submitted;
    expect(offerResponse.status()).toBe(201);
    const offer=await offerResponse.json();
    expect(offer.currency).toBe('GHS');
    await expect(buyer).toHaveURL(/\/home(\?|$)/);
    const accepted=await seller.request.post(`/api/offers/${offer.id}/accept`,{data:{}});
    expect(accepted.status()).toBe(200);
    const deal=await accepted.json();
    expect(deal.contract.currency).toBe('GHS');
    expect(deal.paymentRequest.amount_total).toBe('0.51');
    expect(deal.paymentRequest.currency).toBe('GHS');
  } finally {await context.close();}
});
