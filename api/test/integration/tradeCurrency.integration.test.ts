import crypto from 'node:crypto';
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import app from '../../src/app';
import { query } from '../../src/db';
import { createTradeOffer, acceptTradeOffer } from '../../src/modules/trading/offers';
import { proposePaymentTerms } from '../../src/modules/payments/terms';
import { createListingSchema } from '../../src/validation';
async function fixture(currency: string) {
  const org = async () => (await query("INSERT INTO organizations(name,type,jurisdiction) VALUES($1,'cooperative','GH') RETURNING id", [crypto.randomUUID()])).rows[0].id;
  const sellerOrg=await org(), buyerOrg=await org();
  const user=async (id:string) => (await query("INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,'unused','Currency fixture') RETURNING id",[id,`${crypto.randomUUID()}@currency.test`])).rows[0].id;
  const seller={id:await user(sellerOrg),organizationId:sellerOrg}, buyer={id:await user(buyerOrg),organizationId:buyerOrg};
  const batch=(await query("INSERT INTO harvest_batches(crop,harvest_date,quantity_kg,current_holder_id,source_mode,source_name,source_country) VALUES('peanut',CURRENT_DATE,10,$1,'direct_inventory','Currency fixture','GH') RETURNING id",[sellerOrg])).rows[0];
  const holding=(await query('INSERT INTO batch_holdings(batch_id,holder_organization_id,quantity_kg) VALUES($1,$2,10) RETURNING id',[batch.id,sellerOrg])).rows[0];
  const listing=(await query("INSERT INTO listings(seller_organization_id,holding_id,available_quantity_kg,price_per_kg,currency,incoterm,origin_location,destination_location) VALUES($1,$2,10,4.04,$3,'FOB','Tema','London') RETURNING id",[sellerOrg,holding.id,currency])).rows[0];
  return {seller,buyer,listing,holding};
}
describe('trade currency boundary and exact contract money', () => {
  it.each(['EUR','USD','GHS','GBP'])('propagates %s and conserves installments through all plans', async currency => {
    const f=await fixture(currency);
    const offer=await createTradeOffer(f.buyer,f.listing.id,{quantityKg:0.125,offeredPricePerKg:4.04,currency});
    const accepted=await acceptTradeOffer(f.seller,offer.id);
    expect(accepted.contract.currency).toBe(currency);
    expect(accepted.paymentRequest.currency).toBe(currency);
    expect(accepted.paymentRequest.amount_total).toBe('0.51');
    const fee=(await query('SELECT currency,amount_total FROM platform_fee_invoices WHERE contract_id=$1',[accepted.contract.id])).rows[0];
    expect(fee).toEqual({currency,amount_total:'0.01'});
    for(const paymentPlan of ['pay_before_dispatch','deposit_balance','bank_secured','documentary_collection','pay_after_delivery'] as const) {
      await proposePaymentTerms(f.seller,accepted.contract.id,{paymentPlan,depositPercentage:20});
      const amounts=(await query('SELECT SUM(amount_due)::text total FROM payment_installments WHERE payment_request_id=$1',[accepted.paymentRequest.id])).rows[0];
      expect(amounts.total).toBe('0.51');
    }
  });
  it('rejects mismatched offer currency without writing an offer',async () => {
    const f=await fixture('GHS');
    await expect(createTradeOffer(f.buyer,f.listing.id,{quantityKg:1,offeredPricePerKg:4,currency:'EUR'})).rejects.toThrow('Currency differs');
    expect((await query('SELECT id FROM trade_offers WHERE listing_id=$1',[f.listing.id])).rows).toHaveLength(0);
  });
  it('rejects a legacy mismatched offer at acceptance before inventory changes',async () => {
    const f=await fixture('GHS');
    const o=(await query("INSERT INTO trade_offers(listing_id,buyer_organization_id,quantity_kg,offered_price_per_kg,currency,valid_until) VALUES($1,$2,1,4,'EUR',NOW()+INTERVAL '1 day') RETURNING id",[f.listing.id,f.buyer.organizationId])).rows[0];
    await expect(acceptTradeOffer(f.seller,o.id)).rejects.toThrow('Currency differs');
    expect((await query('SELECT status,quantity_kg FROM batch_holdings WHERE id=$1',[f.holding.id])).rows[0]).toEqual({status:'available',quantity_kg:'10.000'});
    expect((await query('SELECT status FROM trade_offers WHERE id=$1',[o.id])).rows[0].status).toBe('pending');
  });
  it('blocks payment currency drift without deleting the schedule',async () => {
    const f=await fixture('USD');
    const o=await createTradeOffer(f.buyer,f.listing.id,{quantityKg:1,offeredPricePerKg:4,currency:'USD'});
    const d=await acceptTradeOffer(f.seller,o.id);
    await query("UPDATE payment_requests SET currency='EUR' WHERE id=$1",[d.paymentRequest.id]);
    await expect(proposePaymentTerms(f.seller,d.contract.id,{paymentPlan:'pay_before_dispatch'})).rejects.toThrow('Currency differs');
    expect((await query('SELECT COUNT(*)::int count FROM payment_installments WHERE payment_request_id=$1',[d.paymentRequest.id])).rows[0].count).toBe(2);
  });
  it('rejects unsupported currency at the listing input boundary', () => {
    expect(createListingSchema.safeParse({holdingId:crypto.randomUUID(),availableQuantityKg:1,pricePerKg:1,currency:'KWD',originLocation:'Tema',destinationLocation:'London'}).success).toBe(false);
  });
  it('keeps authentication mandatory on listing creation',async () => expect((await request(app).post('/listings').send({currency:'GHS'})).status).toBe(401));
});

describe('whole-yen snapshots and guards', () => {
  it('creates whole-yen totals, fee and exact deposit installments', async () => {
    const f=await fixture('JPY');
    const o=await createTradeOffer(f.buyer,f.listing.id,{quantityKg:0.125,offeredPricePerKg:404,currency:'JPY'});
    const d=await acceptTradeOffer(f.seller,o.id);
    expect(d.contract.currency_minor_units).toBe(0);
    expect(d.contract.payment_plan).toBe('pay_before_dispatch');
    expect(d.paymentRequest).toMatchObject({currency:'JPY',currency_minor_units:0,amount_total:'51.00'});
    expect((await query('SELECT amount_total,currency_minor_units FROM platform_fee_invoices WHERE contract_id=$1',[d.contract.id])).rows[0]).toEqual({amount_total:'1.00',currency_minor_units:0});
    await proposePaymentTerms(f.seller,d.contract.id,{paymentPlan:'deposit_balance',depositPercentage:20});
    const parts=(await query('SELECT amount_due,currency_minor_units FROM payment_installments WHERE payment_request_id=$1 ORDER BY sequence_number',[d.paymentRequest.id])).rows;
    expect(parts).toEqual([{amount_due:'10.00',currency_minor_units:0},{amount_due:'41.00',currency_minor_units:0}]);
    for(const paymentPlan of ['pay_before_dispatch','bank_secured','documentary_collection','pay_after_delivery'] as const) {
      await proposePaymentTerms(f.seller,d.contract.id,{paymentPlan});
      expect((await query('SELECT amount_due,currency_minor_units FROM payment_installments WHERE payment_request_id=$1',[d.paymentRequest.id])).rows).toEqual([{amount_due:'51.00',currency_minor_units:0}]);
    }
  });
  it('rejects fractional-yen database mutations', async () => {
    const f=await fixture('JPY');
    const o=await createTradeOffer(f.buyer,f.listing.id,{quantityKg:1,offeredPricePerKg:100,currency:'JPY'});
    const d=await acceptTradeOffer(f.seller,o.id);
    await expect(query('UPDATE payment_requests SET amount_confirmed=0.01 WHERE id=$1',[d.paymentRequest.id])).rejects.toMatchObject({code:'23514'});
    await expect(query('UPDATE payment_installments SET amount_due=0.01 WHERE payment_request_id=$1',[d.paymentRequest.id])).rejects.toMatchObject({code:'23514'});
    await expect(query('UPDATE platform_fee_invoices SET amount_total=0.01 WHERE contract_id=$1',[d.contract.id])).rejects.toMatchObject({code:'23514'});
  });
  it('rejects a zero deposit without deleting the existing full payment', async () => {
    const f=await fixture('JPY');
    const o=await createTradeOffer(f.buyer,f.listing.id,{quantityKg:1,offeredPricePerKg:1,currency:'JPY'});
    const d=await acceptTradeOffer(f.seller,o.id);
    await expect(proposePaymentTerms(f.seller,d.contract.id,{paymentPlan:'deposit_balance',depositPercentage:20})).rejects.toThrow('zero installment');
    expect((await query('SELECT amount_due FROM payment_installments WHERE payment_request_id=$1',[d.paymentRequest.id])).rows).toEqual([{amount_due:'1.00'}]);
    expect((await query('SELECT payment_terms_status FROM sales_contracts WHERE id=$1',[d.contract.id])).rows[0].payment_terms_status).toBe('draft');
  });
  it('rejects precision drift even when currency matches', async () => {
    const f=await fixture('JPY');
    const o=await createTradeOffer(f.buyer,f.listing.id,{quantityKg:1,offeredPricePerKg:100,currency:'JPY'});
    const d=await acceptTradeOffer(f.seller,o.id);
    await query('UPDATE payment_requests SET currency_minor_units=2 WHERE id=$1',[d.paymentRequest.id]);
    await expect(proposePaymentTerms(f.seller,d.contract.id,{paymentPlan:'pay_before_dispatch'})).rejects.toThrow('precision differs');
  });
});

describe('legacy precision preservation', () => {
  it('honors recorded two-decimal JPY contracts rather than applying the new policy',async () => {
    const f=await fixture('JPY');
    const o=await createTradeOffer(f.buyer,f.listing.id,{quantityKg:1,offeredPricePerKg:50.5,currency:'JPY'});
    const d=await acceptTradeOffer(f.seller,o.id);
    // Represent a pre-030 contract snapshot; no production backfill changes amounts.
    await query('UPDATE sales_contracts SET currency_minor_units=2 WHERE id=$1',[d.contract.id]);
    await query('UPDATE payment_requests SET currency_minor_units=2,amount_total=50.50,dispatch_required_amount=50.50 WHERE id=$1',[d.paymentRequest.id]);
    await query('UPDATE payment_installments SET currency_minor_units=2,amount_due=50.50 WHERE payment_request_id=$1',[d.paymentRequest.id]);
    await query('UPDATE platform_fee_invoices SET currency_minor_units=2,amount_total=0.51 WHERE contract_id=$1',[d.contract.id]);
    await proposePaymentTerms(f.seller,d.contract.id,{paymentPlan:'deposit_balance',depositPercentage:20});
    expect((await query('SELECT amount_due,currency_minor_units FROM payment_installments WHERE payment_request_id=$1 ORDER BY sequence_number',[d.paymentRequest.id])).rows).toEqual([{amount_due:'10.10',currency_minor_units:2},{amount_due:'40.40',currency_minor_units:2}]);
    expect((await query('SELECT amount_total,currency_minor_units FROM platform_fee_invoices WHERE contract_id=$1',[d.contract.id])).rows[0]).toEqual({amount_total:'0.51',currency_minor_units:2});
  });
});
