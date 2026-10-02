import crypto from 'node:crypto';
import { test, expect } from './support/fixtures';
import { baseURL } from './support/environment';
import { createWorkspace } from './support/identity';
import { grantRecallCustodyFixture } from './support/database';

function recoveryPdf(): Buffer {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R >>',
    '<< /Length 0 >>\nstream\n\nendstream',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const offset = Buffer.byteLength(pdf);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 5\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

// Only inventory/custody/recall activation use setup APIs. Response actions,
// uploaded proof and resolution exercise the real browser and server routes.
test('buyer and supplier acknowledge, account for recalled stock, upload proof and resolve without releasing returned material', async ({ page: supplier, browser }) => {
  test.setTimeout(180_000);
  const supplierIdentity = await createWorkspace(supplier, browser, 'supplier');
  const buyerContext = await browser.newContext({ baseURL });
  try {
    const buyer = await buyerContext.newPage();
    const buyerIdentity = await createWorkspace(buyer, browser, 'buyer');
    await grantRecallCustodyFixture([supplierIdentity.email, buyerIdentity.email]);
    const buyerMe = await buyer.request.get('/api/me');
    const supplierMe = await supplier.request.get('/api/me');
    expect(buyerMe.ok()).toBe(true); expect(supplierMe.ok()).toBe(true);
    const buyerAccount = await buyerMe.json();
    expect(buyerAccount.permissions).not.toContain('recall.manage');
    const inventory = await supplier.request.post('/api/inventory/direct', { data: { commodity: 'peanut', quantityKg: 10, inventoryDate: new Date().toISOString().slice(0, 10), sourceCountry: 'GH', sourceName: 'Recall browser warehouse' } });
    expect(inventory.status()).toBe(201);
    const lot = await inventory.json();
    const transfer = await supplier.request.post(`/api/holdings/${lot.holding_id}/transfer`, { data: { toOrganizationId: buyerAccount.organization_id, quantityKg: 4 } });
    expect(transfer.status()).toBe(201);
    const transferId = (await transfer.json()).id;
    const accepted = await buyer.request.post(`/api/transfers/${transferId}/accept`);
    expect(accepted.status()).toBe(200);
    const buyerHolding = (await accepted.json()).newHolding.id;
    const recall = await supplier.request.post('/api/recalls', { data: { referenceCode: `BROWSER-${crypto.randomUUID()}`, title: 'Browser peanut recovery', reason: 'Potential quality issue reported', instructions: 'Isolate inventory and document physical recovery', severity: 'warning', batchIds: [lot.id] } });
    expect(recall.status()).toBe(201);
    const recallId = (await recall.json()).id;
    const open = async (actor: typeof supplier) => {
      await actor.goto('/home');
      await actor.getByRole('button', { name: 'Trace & recall', exact: true }).click();
      const article = actor.locator('article').filter({ has: actor.getByRole('heading', { name: 'Browser peanut recovery' }) });
      await article.getByRole('button', { name: 'Open response', exact: true }).click();
      return article;
    };
    const buyerPanel = await open(buyer);
    await expect(buyerPanel.getByRole('button', { name: 'Resolve recall with evidence' })).toHaveCount(0);
    await buyerPanel.getByLabel('Acknowledgement note').fill('Buyer received instructions and isolated all affected stock.');
    await buyerPanel.getByRole('button', { name: 'Acknowledge instructions' }).click();
    await expect(buyerPanel.getByText(/Acknowledged · Contact:/)).toBeVisible();
    await buyerPanel.getByLabel('Your affected holding').selectOption(buyerHolding);
    await buyerPanel.getByLabel('Returned (kg)', { exact: true }).fill('4');
    await buyerPanel.getByLabel('Recovery note').fill('All four kilograms returned under the recall instructions.');
    await buyerPanel.getByRole('button', { name: 'Save recovery accounting' }).click();
    await expect(buyerPanel.getByText(/Returned: 4 kg/)).toBeVisible();

    const supplierPanel = await open(supplier);
    const supplierAccount = await supplierMe.json();
    await expect(supplierPanel.getByText('Notice issued by this organization', { exact: true })).toBeVisible();
    await supplierPanel.getByLabel('Contact note').fill('Buyer confirmed physical return of affected inventory.');
    await supplierPanel.getByRole('button', { name: `Record contact with ${buyerIdentity.organization}` }).click();
    await supplierPanel.getByLabel('Your affected holding').selectOption(lot.holding_id);
    await supplierPanel.getByLabel('Destroyed (kg)', { exact: true }).fill('6');
    await supplierPanel.getByLabel('Recovery note').fill('Remaining six kilograms destroyed after investigation.');
    await supplierPanel.getByRole('button', { name: 'Save recovery accounting' }).click();
    await expect(supplierPanel.getByText(/Destroyed: 6 kg/)).toBeVisible();
    const document = { name: 'recall-recovery.pdf', mimeType: 'application/pdf', buffer: recoveryPdf() };
    await supplierPanel.getByLabel('Response evidence file').setInputFiles(document);
    await supplierPanel.getByRole('button', { name: 'Upload response evidence' }).click();
    await expect(supplierPanel.getByRole('button', { name: 'recall-recovery.pdf', exact: true })).toBeVisible();
    await supplierPanel.getByLabel('Use recall-recovery.pdf for resolution').check();
    await supplierPanel.getByLabel('Resolution reason', { exact: true }).fill('Buyer returned all affected stock and supplier destroyed all remaining stock with documented proof.');
    await supplierPanel.getByRole('button', { name: 'Resolve recall with evidence' }).click();
    await expect(supplierPanel.getByText('This recall is resolved. Response records remain available for audit; returned and destroyed material stays blocked.')).toBeVisible();
    const detail = await supplier.request.get(`/api/recalls/${recallId}/response`);
    const resolved = await detail.json();
    expect(detail.status()).toBe(200);
    expect(resolved.notice.status).toBe('resolved');
    expect(resolved.participants.every((item: { acknowledged_at: string | null }) => Boolean(item.acknowledged_at))).toBe(true);
    expect(resolved.myOrganizationId).toBe(supplierAccount.organization_id);
    await buyer.reload();
    const recalled = buyer.locator('article').filter({ has: buyer.getByRole('heading', { name: 'Browser peanut recovery' }) });
    await recalled.getByRole('button', { name: 'Open response' }).click();
    await expect(recalled.getByRole('button', { name: 'recall-recovery.pdf', exact: true })).toBeVisible();
    const downloadEvent = buyer.waitForEvent('download');
    await recalled.getByRole('button', { name: 'recall-recovery.pdf', exact: true }).click();
    expect((await downloadEvent).suggestedFilename()).toBe('recall-recovery.pdf');
    const republish = await supplier.request.post('/api/listings', { data: { holdingId: lot.holding_id, availableQuantityKg: 6, pricePerKg: 5, originLocation: 'Tema', destinationLocation: 'Rotterdam' } });
    expect(republish.status()).toBe(409);
  } finally { await buyerContext.close(); }
});
