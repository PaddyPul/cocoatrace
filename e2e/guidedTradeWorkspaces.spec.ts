import { test, expect, type Page } from '@playwright/test';

async function setup(page: Page, side: 'seller' | 'buyer' = 'seller') {
  const actor = {
    id: 'seller-user',
    organizationId: side,
    orgType: side === 'seller' ? 'exporter' : 'importer',
    roles: [side === 'seller' ? 'supplier_admin' : 'buyer_admin'],
    permissions: ['*'],
    name: 'Seller',
  };
  await page.addInitScript((user) => localStorage.setItem('ct_user', JSON.stringify(user)), actor);
  const contract = {
    id: 'deal',
    status: 'accepted',
    seller_organization_id: 'seller',
    buyer_organization_id: 'buyer',
    seller_name: 'Seller',
    buyer_name: 'Buyer',
    quantity_kg: 100,
    price_per_kg: 5,
    currency: 'EUR',
    currency_minor_units: 2,
    incoterm: 'CIF',
    payment_plan: 'bank_secured',
    payment_terms_status: 'agreed',
    security_status: 'verified',
    payment_request_id: 'payment',
    shipment_id: 'shipment',
    current_milestone: 'arrived',
    transport_document_reference: '',
    transport_coordinator_organization_id: 'seller',
    documents_presented_at: null as string | null,
    documents: [
      'commercial_invoice',
      'packing_list',
      'transport_document',
      'insurance_certificate',
    ].map((type) => ({
      id: type,
      type,
      file_name: `${type}.pdf`,
      validation_status: 'validated',
      malware_scan_status: 'clean',
      review_status: 'submitted',
      uploader_organization_id: 'seller',
    })),
  };
  let submissionCalls = 0;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/me')
      return route.fulfill({ json: { ...actor, organization_id: side, org_type: actor.orgType } });
    if (path === '/api/onboarding')
      return route.fulfill({ json: { status: 'completed', primary_goal: 'sell' } });
    if (path === '/api/contracts/deal') return route.fulfill({ json: contract });
    if (path.endsWith('/submit-documents')) submissionCalls++;
    if (path === '/api/shipments/shipment/details') {
      expect(route.request().method()).toBe('PATCH');
      const input = route.request().postDataJSON();
      expect(input).toEqual({ transportDocumentReference: 'SEA-123' });
      contract.transport_document_reference = input.transportDocumentReference;
      return route.fulfill({ json: { id: 'shipment' } });
    }
    return route.fulfill({ status: 503, json: { error: 'Supporting data unavailable' } });
  });
  return { contract, submissionCalls: () => submissionCalls };
}

test('document checklist explains missing reference, preserves its draft across tabs and observes automatic submission without a presentation click', async ({
  page,
}) => {
  const fixture = await setup(page);
  await page.goto('/contracts/deal?tab=documents');
  await expect(page.getByRole('tab', { name: 'Documents', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByText(/Uploading a file does not fill this reference/)).toBeVisible();
  await page.getByLabel('Transport-document reference', { exact: true }).fill('SEA-123');
  await page.getByRole('tab', { name: 'Platform fee', exact: true }).click();
  await page.getByRole('tab', { name: 'Documents', exact: true }).click();
  await expect(page.getByLabel('Transport-document reference', { exact: true })).toHaveValue(
    'SEA-123',
  );
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Save transport reference', exact: true }).click();
  await expect(page.getByText(/Checklist complete. Awaiting the server/)).toBeVisible();
  fixture.contract.documents_presented_at = '2026-10-23T12:00:00Z';
  await expect(
    page.getByText('Documents submitted. Continue with the recorded payment workflow.', {
      exact: true,
    }),
  ).toBeVisible();
  expect(fixture.submissionCalls()).toBe(0);
  await expect(
    page.getByRole('button', { name: 'Present documents for payment', exact: true }),
  ).toHaveCount(0);
});

test('bank security and document scan blockers remain explicit and tab navigation works with a keyboard', async ({
  page,
}) => {
  const fixture = await setup(page);
  fixture.contract.security_status = 'submitted';
  fixture.contract.documents[0].malware_scan_status = 'scanning';
  await page.goto('/contracts/deal?tab=documents');
  await expect(
    page.getByText('Supplier must review and accept the external bank security.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Upload a validated, scan-clean seller commercial invoice.', { exact: true }),
  ).toBeVisible();
  const docs = page.getByRole('tab', { name: 'Documents', exact: true });
  await docs.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Goods payment', exact: true })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Goods payment', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('login offers buyer and supplier demos with separate explicit platform administration access', async ({
  page,
}) => {
  await page.goto('/login');
  await expect(page.getByText('A global sourcing workspace', { exact: true })).toBeVisible();
  const buyerDemo = page.getByRole('button', { name: 'Buyer demo', exact: true });
  if ((await buyerDemo.count()) === 0) {
    // Production builds intentionally omit all seeded/demo account shortcuts.
    await expect(page.getByText('Platform administration', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Demo password:', { exact: false })).toHaveCount(0);
    return;
  }
  await expect(page.getByRole('button', { name: 'Buyer demo', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Supplier demo', exact: true })).toBeVisible();
  for (const name of [
    'Pilot manager',
    'Farmer',
    'Certifier',
    'Exporter',
    'Importer',
    'Logistics',
    'Regulator',
  ]) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
  }
  await page.getByText('Platform administration', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Platform admin', exact: true })).toBeVisible();
});

test('an unavailable bank-security route chunk shows a recoverable loading explanation', async ({
  page,
}) => {
  await setup(page);
  await page.route('**/assets/PaymentDetailPage-*.js', (route) => route.abort(), { times: 1 });
  await page.goto('/payments/payment');
  await expect(page.getByText('This page could not finish loading', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload page', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reload page', exact: true }).click();
  await expect(page.getByText('This page could not finish loading', { exact: true })).toHaveCount(
    0,
  );
});

test('estimated legacy fee is reachable before settlement even while payment protection is the next action', async ({
  page,
}) => {
  const { contract } = await setup(page);
  Object.assign(contract, {
    nextAction: {
      id: 'deal:deal:terms',
      kind: 'terms',
      operation: 'configure_terms',
      requiresAction: true,
      title: 'Configure payment protection',
      description: 'Supplier proposes terms.',
      actionPath: '/contracts/deal?tab=payments',
      actionLabel: 'Configure protection',
    },
  });
  await page.route('**/api/contracts/deal/fee', (route) =>
    route.fulfill({
      json: {
        statementNumber: 'FEE-TEST',
        documentType: 'commercial_fee_statement',
        taxNotice: 'Not a tax invoice',
        submissions: [],
        fee: {
          id: 'fee',
          contract_id: 'deal',
          status: 'estimated',
          amount_total: '10.00',
          currency: 'EUR',
          currency_minor_units: 2,
          rate_bps: 100,
          fee_payer: 'seller',
          payer_organization_id: 'seller',
          seller_name: 'Seller',
          buyer_name: 'Buyer',
          contract_status: 'accepted',
          receipt_verified: false,
          amount_matches: true,
          payer_matches: true,
        },
      },
    }),
  );
  await page.goto('/deal-room/deal?tab=fees');
  await expect(page.getByRole('tab', { name: 'Platform fee', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(
    page
      .getByRole('region', { name: 'Platform fee statement', exact: true })
      .getByText('Estimated fee. No fee payment is due yet.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Configure payment protection', exact: true }),
  ).toBeVisible();
});

test('delivery discrepancy controls remain reachable while goods payment has priority, including after reload', async ({
  page,
}) => {
  const { contract } = await setup(page, 'buyer');
  contract.current_milestone = 'delivered';
  contract.status = 'delivered';
  contract.payment_plan = 'pay_after_delivery';
  Object.assign(contract, {
    nextAction: {
      id: 'deal:deal:payment',
      kind: 'payment',
      requiresAction: true,
      title: 'Pay for delivered goods',
      description: 'Goods payment is due.',
      actionPath: '/payments/payment',
      actionLabel: 'Record payment',
    },
  });
  await page.route('**/api/contracts/deal/delivery', (route) =>
    route.fulfill({ json: { contract, acceptance: null, discrepancy: null } }),
  );
  await page.goto('/deal-room/deal?tab=delivery');
  const inspection = page.getByRole('region', { name: 'Delivery acceptance', exact: true });
  await inspection.getByLabel('Discrepancy type', { exact: true }).selectOption('damage');
  await expect(inspection.getByLabel('Discrepancy type', { exact: true })).toHaveValue('damage');
  // Do not abandon a draft: restore it before explicitly testing the reload route.
  await inspection.getByLabel('Discrepancy type', { exact: true }).selectOption('shortage');
  await page.reload();
  await expect(inspection.getByLabel('Discrepancy type', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Delivery', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});
