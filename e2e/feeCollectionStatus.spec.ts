import { test, expect } from '@playwright/test';

for (const payer of [true, false]) {
  test(`completed trade keeps fee collection explicit for ${payer ? 'payer' : 'other party'}`, async ({
    page,
  }) => {
    const user = {
      id: 'user',
      name: 'User',
      email: 'fee-user@example.test',
      organizationId: payer ? 'seller' : 'buyer',
      orgType: payer ? 'exporter' : 'importer',
      permissions: ['contract.read', 'offer.create', 'offer.respond'],
      roles: [],
    };
    await page.addInitScript(
      (value) => localStorage.setItem('ct_user', JSON.stringify(value)),
      user,
    );
    let state = 'invoiced';
    let mutationCount = 0;
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (route.request().method() !== 'GET') mutationCount++;
      let json: unknown = [];
      if (path === '/api/me')
        json = {
          ...user,
          organization_id: user.organizationId,
          org_name: 'Organization',
          org_type: user.orgType,
        };
      if (path === '/api/onboarding') json = { status: 'completed' };
      if (path === '/api/contracts/contract/fee')
        json = {
          statementNumber: 'FEE-TEST',
          taxNotice: 'Not a tax invoice',
          documentType: 'commercial_fee_statement',
          fee: {
            id: 'fee',
            contract_id: 'contract',
            status: state,
            amount_total: '10.00',
            currency: 'EUR',
            currency_minor_units: 2,
            rate_bps: 100,
            fee_payer: 'seller',
            payer_organization_id: 'seller',
            seller_name: 'Supplier',
            buyer_name: 'Buyer',
            contract_status: 'settled',
            receipt_verified: state === 'paid',
            amount_matches: true,
            payer_matches: true,
            due_at: '2026-10-17T12:00:00Z',
            paid_at: null,
          },
          submissions: [],
        };
      await route.fulfill({ json });
    });
    await page.goto('/platform-fees/contract');
    const fee = page.getByRole('region', { name: 'Platform fee statement', exact: true });
    const status = fee.getByRole('status', { name: 'Fee collection status', exact: true });
    await expect(status).toContainText('Platform fee outstanding — collection not verified');
    await expect(status).toContainText('Fee payer: Supplier (seller)');
    await expect(status).toContainText('No automatic deduction or debit is made.');
    if (payer) {
      await expect(status).toContainText('Your organization must pay this fee separately.');
      await fee.getByLabel('Fee payment reference', { exact: true }).fill('UNSENT-DRAFT');
    } else await expect(fee.getByLabel('Fee payment reference', { exact: true })).toHaveCount(0);
    await fee.getByRole('button', { name: 'Refresh fee status', exact: true }).click();
    if (payer)
      await expect(fee.getByLabel('Fee payment reference', { exact: true })).toHaveValue(
        'UNSENT-DRAFT',
      );
    state = 'paid';
    await fee.getByRole('button', { name: 'Refresh fee status', exact: true }).click();
    await expect(status).toContainText('Platform fee collected — receipt verified');
    expect(mutationCount).toBe(0);
  });
}
