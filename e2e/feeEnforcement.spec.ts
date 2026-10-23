import { test, expect, type Page } from '@playwright/test';

async function fixture(page: Page, finance = false) {
  const user = {
    id: 'user',
    name: 'User',
    email: 'fee@example.test',
    organizationId: finance ? 'platform' : 'seller',
    orgType: finance ? 'platform' : 'exporter',
    permissions: finance ? ['*'] : ['contract.read', 'offer.respond'],
    roles: [],
  };
  await page.addInitScript((value) => localStorage.setItem('ct_user', JSON.stringify(value)), user);
  const state = {
    enforced: true,
    terms:
      'New-trade policy: cancelled before dispatch receives manual finance refund review. No automatic refund.',
    policy_version: 'seller-predispatch-v3',
    expectedFingerprint: 'a'.repeat(64),
    terms_accepted_at: null as string | null,
    credit_until: null as string | null,
    credit_revision: 0,
    credit_active: false,
    amount_total: '10.00',
    currency: 'EUR',
    status: 'estimated',
    payer_organization_id: 'seller',
    receipt_verified: false,
  };
  const actions: { path: string; body: Record<string, unknown> }[] = [];
  let reject = false;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = [];
    if (path === '/api/me')
      json = {
        ...user,
        organization_id: user.organizationId,
        org_name: 'Organization',
        org_type: user.orgType,
      };
    if (path === '/api/onboarding') json = { status: 'completed' };
    if (path.endsWith('/fee/enforcement')) json = state;
    if (path.endsWith('/fee/terms') || path.endsWith('/fee/credit')) {
      actions.push({ path, body: route.request().postDataJSON() as Record<string, unknown> });
      if (reject)
        return route.fulfill({
          status: 409,
          json: { error: 'Fee terms changed. Refresh and review again.' },
        });
      if (path.endsWith('/terms')) state.terms_accepted_at = new Date().toISOString();
      else {
        state.credit_revision++;
        state.credit_until = route.request().postDataJSON().creditUntil;
        state.credit_active = !!state.credit_until;
      }
      json = { ok: true };
    }
    if (path === '/api/contracts/contract/fee')
      json = {
        statementNumber: 'FEE',
        taxNotice: 'Not a tax invoice',
        fee: {
          id: 'fee',
          contract_id: 'contract',
          policy_version: 'seller-predispatch-v3',
          status: 'estimated',
          amount_total: '10.00',
          currency: 'EUR',
          currency_minor_units: 2,
          rate_bps: 100,
          fee_payer: 'seller',
          payer_organization_id: 'seller',
          seller_name: 'Seller',
          buyer_name: 'Buyer',
          contract_status: 'pending',
          amount_matches: true,
          payer_matches: true,
        },
        submissions: [],
      };
    await route.fulfill({ json });
  });
  await page.goto('/platform-fees/contract');
  await page.getByRole('tab', { name: 'Collection terms', exact: true }).click();
  return {
    state,
    actions,
    setReject: (value: boolean) => {
      reject = value;
    },
    region: page.getByRole('region', { name: 'Platform fee collection terms', exact: true }),
  };
}

test('seller reviews exact fee terms before consent and legacy trade does not claim a new gate', async ({
  page,
}) => {
  const { region, actions, state } = await fixture(page);
  await expect(region).toContainText('EUR 10.00');
  await expect(region).toContainText('No automatic deduction or debit');
  const submit = region.getByRole('button', { name: 'Accept platform fee terms', exact: true });
  await expect(submit).toBeDisabled();
  await region
    .getByRole('checkbox', {
      name: 'I accept the displayed platform fee amount, payer, collection and cancellation/refund terms.',
      exact: true,
    })
    .check();
  await submit.click();
  await expect(region).toContainText('Fee terms accepted');
  expect(actions).toEqual([
    {
      path: '/api/contracts/contract/fee/terms',
      body: {
        policyVersion: 'seller-predispatch-v3',
        accepted: true,
        expectedFingerprint: 'a'.repeat(64),
      },
    },
  ]);
  state.enforced = false;
  await region.getByRole('button', { name: 'Refresh collection terms', exact: true }).click();
  await expect(region).toContainText('pre-dispatch fee enforcement does not apply');
  await expect(submit).toHaveCount(0);
});

test('finance credit conflict preserves explanation and requires renewed review', async ({
  page,
}) => {
  const { region, actions, setReject } = await fixture(page, true);
  const reason = region.getByLabel('Credit decision reason', { exact: true });
  await reason.fill('Provider outage investigated and approved');
  await region.getByLabel('Credit exception expiry', { exact: true }).fill('2099-01-01T12:00');
  const checked = region.getByRole('checkbox', {
    name: 'I reviewed the unpaid fee and this credit decision.',
    exact: true,
  });
  const grant = region.getByRole('button', { name: 'Grant temporary fee credit', exact: true });
  await checked.check();
  setReject(true);
  await grant.click();
  await expect(region.getByRole('alert')).toContainText('Fee terms changed');
  await expect(reason).toHaveValue('Provider outage investigated and approved');
  await expect(checked).not.toBeChecked();
  await expect(grant).toBeDisabled();
  setReject(false);
  await checked.check();
  await grant.click();
  await expect(region).toContainText('Temporary credit exception active');
  expect(actions[1].body.expectedRevision).toBe(0);
  await expect(reason).toHaveValue('');
  await reason.fill('The provider recovered and temporary credit is no longer required');
  await checked.check();
  await region.getByRole('button', { name: 'Revoke fee credit', exact: true }).click();
  await expect(region).toContainText('Platform fee receipt not verified');
  expect(actions[2].body).toMatchObject({ expectedRevision: 1, creditUntil: null });
});
