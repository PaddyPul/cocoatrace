import { test, expect } from './support/fixtures';
import { baseURL } from './support/environment';
import { createWorkspace } from './support/identity';
import { tradeSnapshot } from './support/tradeDatabase';

test('buyer requests cancellation, supplier approves and exact inventory is released without relisting', async ({page: supplier,browser}) => {
  test.setTimeout(180_000);
  const identity=await createWorkspace(supplier,browser,'supplier');
  const buyerContext=await browser.newContext({baseURL});
  try {
    const buyer=await buyerContext.newPage(); await createWorkspace(buyer,browser,'buyer');
    const inventoryResponse=await supplier.request.post('/api/inventory/direct',{data:{commodity:'peanut',quantityKg:10,inventoryDate:new Date().toISOString().slice(0,10),sourceCountry:'GH',sourceName:identity.organization}});
    expect(inventoryResponse.status()).toBe(201);const inventory=await inventoryResponse.json();
    const listingResponse=await supplier.request.post('/api/listings',{data:{holdingId:inventory.holding_id,availableQuantityKg:10,pricePerKg:5,incoterm:'FOB',originLocation:'Tema',destinationLocation:'Rotterdam'}});
    expect(listingResponse.status()).toBe(201);const listing=await listingResponse.json();
    const offerResponse=await buyer.request.post(`/api/listings/${listing.id}/offers`,{data:{quantityKg:4,offeredPricePerKg:5,currency:'EUR',validUntil:new Date(Date.now()+86400000).toISOString()}});
    expect(offerResponse.status()).toBe(201);const offer=await offerResponse.json();
    const accepted=await supplier.request.post(`/api/offers/${offer.id}/accept`);expect(accepted.status()).toBe(200);
    const {contract}=await accepted.json();
    await buyer.goto(`/deal-room/${contract.id}`);
    const panel=buyer.getByRole('region',{name:'Trade cancellation'});
    await panel.getByLabel('Reason for cancellation').fill('short');
    await expect(panel.getByRole('button',{name:'Request cancellation'})).toBeDisabled();
    await panel.getByLabel('Reason for cancellation').fill('Procurement schedule changed; please cancel by agreement');
    await panel.getByRole('button',{name:'Request cancellation'}).click();
    await expect(panel.getByText('Awaiting the other organization’s decision. Inventory remains committed.')).toBeVisible();
    await expect(panel.getByRole('button',{name:'Approve cancellation and release inventory'})).toHaveCount(0);
    expect((await tradeSnapshot(contract.id)).holdings.find(row=>row.id===contract.holding_id)?.status).toBe('committed');
    await supplier.goto(`/deal-room/${contract.id}`);
    await supplier.getByRole('button',{name:'Approve cancellation and release inventory'}).click();
    await expect(supplier.getByRole('heading',{name:'Trade cancelled',exact:true})).toBeVisible();
    await buyer.reload();
    await expect(buyer.getByRole('heading',{name:'Trade cancelled',exact:true})).toBeVisible();
    const result=await tradeSnapshot(contract.id);
    expect(result.contract.status).toBe('cancelled');
    expect(result.holdings.find(row=>row.id===contract.holding_id)?.status).toBe('available');
    expect(result.holdings.reduce((sum,row)=>sum+Number(row.quantity_kg),0)).toBe(10);
    expect(result.fees[0].status).toBe('void');
    await buyer.goto('/home');
    await expect(buyer.getByText('Trade cancelled',{exact:true})).toBeVisible();
  } finally {await buyerContext.close();}
});
