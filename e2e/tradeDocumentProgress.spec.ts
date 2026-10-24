import { test, expect, type Page } from '@playwright/test';

async function fixture(
  page: Page,
  milestone = 'arrived',
  insurance = false,
  termsStatus = 'agreed',
) {
  const actor = {
    id: 'seller-user',
    organizationId: 'seller',
    orgType: 'exporter',
    permissions: ['*'],
    roles: ['supplier_admin'],
    name: 'Seller',
  };
  await page.addInitScript((user) => localStorage.setItem('ct_user', JSON.stringify(user)), actor);
  const documents = [
    'commercial_invoice',
    'packing_list',
    'transport_document',
    'other',
    ...(insurance ? ['insurance_certificate'] : []),
  ].map((type) => ({
    id: type,
    type,
    file_name: `${type}.pdf`,
    validation_status: 'validated',
    malware_scan_status: 'clean',
    review_status: 'pending',
  }));
  let uploadedType = '';
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/me')
      return route.fulfill({ json: { ...actor, organization_id: 'seller', org_type: 'exporter' } });
    if (path === '/api/onboarding')
      return route.fulfill({ json: { status: 'completed', primary_goal: 'sell' } });
    if (path === '/api/contracts/deal')
      return route.fulfill({
        json: {
          id: 'deal',
          seller_organization_id: 'seller',
          buyer_organization_id: 'buyer',
          seller_name: 'Seller',
          buyer_name: 'Buyer',
          quantity_kg: 100,
          price_per_kg: 5,
          currency: 'USD',
          currency_minor_units: 2,
          incoterm: 'CIF',
          status: 'accepted',
          payment_terms_status: termsStatus,
          payment_plan: 'deposit_balance',
          payment_request_id: 'payment',
          documents,
          current_milestone: milestone,
          shipment_id: 'shipment',
          transport_document_reference: 'BL-1',
          transport_coordinator_organization_id: 'seller',
          transport_coordinator_name: 'Seller',
        },
      });
    if (path === '/api/evidence/upload-intents') {
      const input = route.request().postDataJSON();
      expect(input.linkedEntityType).toBe('contract');
      expect(input.linkedEntityId).toBe('deal');
      uploadedType = input.type;
      return route.fulfill({ json: { uploadUrl: '/evidence/test-upload' } });
    }
    if (path === '/api/evidence/test-upload') {
      documents.push({
        id: 'uploaded',
        type: uploadedType,
        file_name: 'insurance.pdf',
        validation_status: 'validated',
        malware_scan_status: 'clean',
        review_status: 'pending',
      });
      return route.fulfill({ json: { id: 'uploaded' } });
    }
    return route.fulfill({ status: 503, json: { error: 'Supporting data unavailable' } });
  });
}

for (const milestone of ['handed_over', 'loaded']) {
  test(`CIF documents can be presented at ${milestone} without falsely reporting dispatch`, async ({
    page,
  }) => {
    await fixture(page, milestone, true);
    await page.goto('/contracts/deal?tab=documents');
    await expect(page.getByText(/Checklist complete. Awaiting the server/)).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Present documents for payment', exact: true }),
    ).toHaveCount(0);
    await page.getByRole('tab', { name: 'Overview', exact: true }).click();
    await expect(
      page.locator('[aria-label="Pending: Cargo dispatched and transport document issued"]'),
    ).toBeVisible();
  });
}

test('CIF seller can select insurance explicitly and Other does not satisfy its requirement', async ({
  page,
}) => {
  await fixture(page);
  await page.goto('/contracts/deal?tab=documents');
  await expect(page.getByText('Required before payment: insurance certificate.')).toBeVisible();
  await page.getByRole('button', { name: 'Add document', exact: true }).click();
  await expect(page.getByText(/Files uploaded as “Other” do not satisfy/)).toBeVisible();
  await page
    .getByLabel('Document type', { exact: true })
    .selectOption({ label: 'Insurance certificate (cargo cover for CIF/CIP)' });
  await page.getByLabel('File', { exact: true }).setInputFiles({
    name: 'insurance.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 synthetic test'),
  });
  await page
    .getByLabel('Note (optional)', { exact: true })
    .fill('Cargo insurance for the agreed CIF trade');
  await page.getByRole('button', { name: 'Share document', exact: true }).click();
  await expect(page.getByText('Required before payment: insurance certificate.')).toHaveCount(0);
  await expect(page.getByText('insurance.pdf', { exact: true })).toBeVisible();
});

for (const [milestone, dispatched, arrived, delivered] of [
  ['handed_over', false, false, false],
  ['loaded', false, false, false],
  ['departed', true, false, false],
  ['arrived', true, true, false],
  ['customs_cleared', true, true, false],
  ['unloaded', true, true, false],
  ['delivered', true, true, true],
] as const) {
  test(`trade fulfilment preserves ${milestone} without implying acceptance or settlement`, async ({
    page,
  }) => {
    await fixture(page, milestone);
    await page.goto('/contracts/deal');
    for (const [label, done] of [
      ['Cargo dispatched and transport document issued', dispatched],
      ['Cargo arrived at destination', arrived],
      ['Cargo delivered', delivered],
      ['Buyer sends payment and seller verifies receipt', false],
      ['Buyer accepts inspected goods and trade agreement closes', false],
    ] as const) {
      await expect(
        page.locator(`[aria-label="${done ? 'Completed' : 'Pending'}: ${label}"]`),
      ).toBeVisible();
    }
    await expect(
      page.getByText(/Arrival and delivery do not confirm payment or buyer acceptance/),
    ).toBeVisible();
  });
}

test('failed payment terms remain visible inside the native dialog and retain the draft without replay', async ({
  page,
}) => {
  await fixture(page, 'arrived', false, 'not_configured');
  let writes = 0;
  await page.route('**/api/contracts/deal/payment-terms', (route) => {
    writes++;
    return route.fulfill({
      status: 409,
      json: { error: 'Terms changed. Review before proposing.' },
    });
  });
  await page.goto('/contracts/deal?tab=payments');
  await page.getByRole('button', { name: 'Set payment protection', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Payment Protection Plan', exact: true });
  await dialog
    .getByLabel('Commercial note (optional)', { exact: true })
    .fill('Retain this proposed commercial note');
  await dialog.getByRole('button', { name: 'Propose terms', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Terms changed. Review before proposing.');
  await expect(dialog.getByLabel('Commercial note (optional)', { exact: true })).toHaveValue(
    'Retain this proposed commercial note',
  );
  expect(writes).toBe(1);
});
