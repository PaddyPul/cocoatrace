import { test, expect } from './support/fixtures';
import { baseURL } from './support/environment';
import { createWorkspace, platformReviewerContext } from './support/identity';
import { tradeSnapshot } from './support/tradeDatabase';

for (const currency of ['GHS','JPY']) test(`${currency}: seller submits a completed-trade fee and platform admin verifies receipt without changing custody`, async ({
  page: seller,
  browser,
}) => {
  test.setTimeout(180_000);
  const identity = await createWorkspace(seller, browser, 'supplier');
  const buyerContext = await browser.newContext({ extraHTTPHeaders: { Origin: baseURL }, baseURL }),
    adminContext = await platformReviewerContext(browser);
  try {
    const buyer = await buyerContext.newPage();
    await createWorkspace(buyer, browser, 'buyer');
    const inventoryResponse = await seller.request.post('/api/inventory/direct', {
      data: {
        commodity: 'peanut',
        quantityKg: 10,
        inventoryDate: new Date().toISOString().slice(0, 10),
        sourceCountry: 'GH',
        sourceName: identity.organization,
      },
    });
    expect(inventoryResponse.status()).toBe(201);
    const inventory = await inventoryResponse.json();
    const listingResponse = await seller.request.post('/api/listings', {
      data: {
        holdingId: inventory.holding_id,
        availableQuantityKg: 10,
        pricePerKg: currency === 'JPY' ? 12.625 : 5,
        currency,
        incoterm: 'FOB',
        originLocation: 'Tema',
        destinationLocation: 'Rotterdam',
      },
    });
    expect(listingResponse.status()).toBe(201);
    const listing = await listingResponse.json();
    const offerResponse = await buyer.request.post(`/api/listings/${listing.id}/offers`, {
      data: {
        quantityKg: 4,
        offeredPricePerKg: currency === 'JPY' ? 12.625 : 5,
        currency,
        validUntil: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    expect(offerResponse.status()).toBe(201);
    const offer = await offerResponse.json();
    const acceptance = await seller.request.post(`/api/offers/${offer.id}/accept`);
    expect(acceptance.status()).toBe(200);
    const { contract, shipment, paymentRequest } = await acceptance.json();
    expect(contract.currency_minor_units).toBe(currency === 'JPY' ? 0 : 2);
    expect(paymentRequest.amount_total).toBe(currency === 'JPY' ? '51.00' : '20.00');
    await seller.goto(`/deal-room/${contract.id}`);
    const fee = seller.getByRole('region', { name: 'Platform fee statement' });
    await expect(fee.getByText('Estimated fee. No fee payment is due yet.')).toBeVisible();
    await expect(fee.getByRole('button', { name: 'Submit fee payment reference' })).toHaveCount(0);
    expect(
      (
        await seller.request.patch(`/api/contracts/${contract.id}/payment-terms`, {
          data: { paymentPlan: 'pay_before_dispatch', paymentEvidenceRequired: false },
        })
      ).status(),
    ).toBe(200);
    expect(
      (await buyer.request.post(`/api/contracts/${contract.id}/payment-terms/confirm`)).status(),
    ).toBe(200);
    const state = await buyer.request.get(`/api/payment-requests/${paymentRequest.id}`);
    const installment = (await state.json()).installments[0];
    if (currency === 'JPY') {
      await buyer.goto(`/payments/${paymentRequest.id}`);
      await expect(buyer.getByText('JPY 51', {exact:true}).first()).toBeVisible();
    }
    expect(
      (
        await buyer.request.post(`/api/payment-installments/${installment.id}/submit`, {
          data: { transactionReference: 'BROWSER-GOODS-PAYMENT' },
        })
      ).status(),
    ).toBe(200);
    expect(
      (await seller.request.post(`/api/payment-installments/${installment.id}/confirm`)).status(),
    ).toBe(200);
    expect(
      (
        await buyer.request.post(`/api/shipments/${shipment.id}/milestones`, {
          data: { milestone: 'delivered' },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await buyer.request.post(`/api/contracts/${contract.id}/delivery/accept`, {
          data: { receivedQuantityKg: 4, note: 'Inspected all goods for fee browser regression' },
        })
      ).status(),
    ).toBe(200);
    const before = await tradeSnapshot(contract.id);
    expect(before.contract.status).toBe('settled');
    expect(before.fees[0].status).toBe('invoiced');
    expect(before.fees[0].amount_total).toBe(currency === 'JPY' ? '1.00' : '0.20');
    await seller.goto('/home');
    await expect(
      seller.getByText('Review and pay the platform fee', { exact: true }),
    ).toBeVisible();
    await seller.goto(`/deal-room/${contract.id}`);
    await fee.getByLabel('Fee payment reference').fill('BROWSER-FEE-TRANSFER');
    await fee.getByRole('button', { name: 'Submit fee payment reference' }).click();
    await expect(
      fee.getByText('Fee payment submitted — awaiting platform verification.'),
    ).toBeVisible();
    expect((await tradeSnapshot(contract.id)).fees[0].status).toBe('invoiced');
    await buyer.goto(`/deal-room/${contract.id}`);
    await expect(buyer.getByLabel('Fee payment reference')).toHaveCount(0);
    await expect(buyer.getByText('BROWSER-FEE-TRANSFER', { exact: true })).toHaveCount(0);
    const admin = await adminContext.newPage();
    await admin.goto(`/platform-fees/${contract.id}`);
    if (currency === 'JPY') {
      const statement = await (await admin.request.get(`/api/contracts/${contract.id}/fee`)).json();
      const rejected = await admin.request.post(`/api/contracts/${contract.id}/fee/submissions/${statement.submissions[0].id}/review`, {data:{decision:'verify',amount:'1.01',currency,receiptReference:`FRACTIONAL-${contract.id}`}});
      expect(rejected.status()).toBe(400);
    }
    await admin.getByLabel('Amount actually received').fill(before.fees[0].amount_total);
    await admin.getByLabel('Received currency').fill(currency);
    await admin
      .getByLabel('Platform bank receipt reference')
      .fill(`BROWSER-RECEIPT-${contract.id}`);
    await admin.getByRole('button', { name: 'Verify platform receipt' }).click();
    await expect(admin.getByText('Platform receipt verified.', { exact: true })).toBeVisible();
    const downloadEvent = admin.waitForEvent('download');
    await admin.getByRole('button', { name: 'Download fee statement' }).click();
    expect((await downloadEvent).suggestedFilename()).toMatch(/^CT-FEE-.*\.json$/);
    await seller.reload();
    await expect(fee.getByText('Platform receipt verified.', { exact: true })).toBeVisible();
    const after = await tradeSnapshot(contract.id);
    expect(after.fees[0].status).toBe('paid');
    expect(after.contract.status).toBe('settled');
    expect(after.holdings).toEqual(before.holdings);
    expect(after.transfers).toEqual(before.transfers);
  } finally {
    await buyerContext.close();
    await adminContext.close();
  }
});
