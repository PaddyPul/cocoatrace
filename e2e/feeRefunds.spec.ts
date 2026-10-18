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
    expectedFingerprint: 'a'.repeat(64),
    eligible: true,
    blockedReason: null as string | null,
    canRequest: !finance,
    canSend: finance,
    canConfirm: false,
    canReject: finance,
    refund: finance
      ? {
          id: 'refund',
          status: 'requested',
          reason: 'Trade never started',
          amount: '10.00',
          currency: 'EUR',
          revision: 1,
          externalReference: undefined as string | undefined,
        }
      : null,
    history: [] as { id: string; action: string; reason: string; created_at: string }[],
  };
  const actions: Record<string, unknown>[] = [];
  let conflict = false;
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
    if (path === '/api/contracts/contract/fee')
      json = {
        refundSupported: true,
        statementDeliverySupported: true,
        statementNumber: 'FEE',
        taxNotice: 'Not a tax invoice',
        fee: {
          id: 'fee',
          contract_id: 'contract',
          policy_version: 'seller-completion-v2',
          status: 'paid',
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
          receipt_verified: true,
        },
        submissions: [],
      };
    if (path.endsWith('/fee/statement-delivery'))
      json = {
        queued: 1,
        sending: 0,
        sent: 0,
        suppressed: 0,
        failed: 0,
        failed_terminal: 0,
        missingContact: false,
      };
    if (path.endsWith('/fee/refund')) json = state;
    if (/\/fee\/refund\/(request|send|confirm|reject)$/.test(path)) {
      actions.push(route.request().postDataJSON() as Record<string, unknown>);
      if (conflict)
        return route.fulfill({
          status: 409,
          json: { error: 'Refund changed. Review the current record.' },
        });
      const body = route.request().postDataJSON();
      const status = path.endsWith('/send')
        ? 'sent'
        : path.endsWith('/confirm')
          ? 'confirmed'
          : path.endsWith('/reject')
            ? 'rejected'
            : 'requested';
      state.refund = {
        id: 'refund',
        status,
        reason: body.reason,
        amount: '10.00',
        currency: 'EUR',
        revision: 2,
        externalReference: body.reference,
      };
      state.canRequest = false;
      state.canSend = false;
      state.canReject = false;
      state.canConfirm = status === 'sent' && !finance;
      json = state;
    }
    await route.fulfill({ json });
  });
  await page.goto('/platform-fees/contract');
  return {
    state,
    actions,
    reject: () => {
      conflict = true;
    },
  };
}

test('payer refund request preserves explanation after conflict and requires renewed review', async ({
  page,
}) => {
  const f = await fixture(page);
  const region = page.getByRole('region', { name: 'Platform fee refund', exact: true });
  await region
    .getByLabel('Fee refund explanation', { exact: true })
    .fill('Trade never started and fee return requested');
  await region.getByRole('checkbox').check();
  f.reject();
  await region.getByRole('button', { name: 'Request full fee refund', exact: true }).click();
  await expect(region.getByRole('alert')).toContainText('Refund changed');
  await expect(region.getByLabel('Fee refund explanation', { exact: true })).toHaveValue(
    'Trade never started and fee return requested',
  );
  await expect(region.getByRole('checkbox')).not.toBeChecked();
  await expect(
    region.getByRole('button', { name: 'Request full fee refund', exact: true }),
  ).toBeDisabled();
  expect(f.actions[0]).toMatchObject({
    expectedFingerprint: 'a'.repeat(64),
    reason: 'Trade never started and fee return requested',
  });
  expect(f.actions[0].idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
});

test('finance records exact external fee refund without claiming automatic transfer or payer receipt', async ({
  page,
}) => {
  const f = await fixture(page, true);
  const region = page.getByRole('region', { name: 'Platform fee refund', exact: true });
  await region
    .getByLabel('Fee refund explanation', { exact: true })
    .fill('External return verified against bank receipt');
  await region.getByLabel('External refund reference', { exact: true }).fill('REFUND-123');
  await region.getByRole('checkbox').check();
  await region.getByRole('button', { name: 'Record external fee refund', exact: true }).click();
  await expect(
    region.getByText('Finance recorded an external refund. Payer receipt is not yet confirmed.', {
      exact: true,
    }),
  ).toBeVisible();
  expect(f.actions[0]).toMatchObject({
    refundId: 'refund',
    expectedRevision: 1,
    amount: '10.00',
    currency: 'EUR',
    reference: 'REFUND-123',
  });
  await expect(
    region.getByRole('button', { name: 'Confirm full fee refund received', exact: true }),
  ).toHaveCount(0);
});

test('counterparty refund view stays informational and refresh preserves payer draft', async ({
  page,
}) => {
  const f = await fixture(page);
  const region = page.getByRole('region', { name: 'Platform fee refund', exact: true });
  await region
    .getByLabel('Fee refund explanation', { exact: true })
    .fill('Unsaved request explanation');
  await region.getByRole('checkbox').check();
  await region.getByRole('button', { name: 'Refresh fee refund', exact: true }).click();
  await expect(region.getByLabel('Fee refund explanation', { exact: true })).toHaveValue(
    'Unsaved request explanation',
  );
  await expect(region.getByRole('checkbox')).not.toBeChecked();
  f.state.canRequest = false;
  f.state.eligible = false;
  f.state.blockedReason = 'This trade has started. Finance review is required.';
  await region.getByRole('button', { name: 'Refresh fee refund', exact: true }).click();
  await expect(region.getByText(f.state.blockedReason, { exact: true })).toBeVisible();
  await expect(
    region.getByRole('button', { name: 'Request full fee refund', exact: true }),
  ).toHaveCount(0);
});

test('only payer confirms full receipt after finance records the external refund', async ({
  page,
}) => {
  const f = await fixture(page);
  f.state.canRequest = false;
  f.state.canConfirm = true;
  f.state.refund = {
    id: 'refund',
    status: 'sent',
    reason: 'Trade never started',
    amount: '10.00',
    currency: 'EUR',
    revision: 2,
    externalReference: 'REFUND-123',
  };
  const region = page.getByRole('region', { name: 'Platform fee refund', exact: true });
  await region.getByRole('button', { name: 'Refresh fee refund', exact: true }).click();
  await region
    .getByLabel('Fee refund explanation', { exact: true })
    .fill('Full platform fee refund received in our bank account');
  await region.getByRole('checkbox').check();
  await region
    .getByRole('button', { name: 'Confirm full fee refund received', exact: true })
    .click();
  await expect(
    region.getByText('The payer confirmed receipt of the full platform fee refund.', {
      exact: true,
    }),
  ).toBeVisible();
  expect(f.actions[0]).toMatchObject({
    refundId: 'refund',
    expectedRevision: 2,
    reason: 'Full platform fee refund received in our bank account',
  });
});

test('malformed refund history is an explicit retryable failure, never an empty or actionable state', async ({
  page,
}) => {
  const f = await fixture(page);
  const region = page.getByRole('region', { name: 'Platform fee refund', exact: true });
  await region
    .getByLabel('Fee refund explanation', { exact: true })
    .fill('Preserve this refund request explanation');
  await page.route('**/api/contracts/contract/fee/refund', (route) =>
    route.fulfill({ json: { ...f.state, history: {} } }),
  );
  await region.getByRole('button', { name: 'Refresh fee refund', exact: true }).click();
  await expect(region.getByRole('alert')).toContainText('Invalid fee refund response');
  await expect(region.getByText('No fee refund decisions recorded.', { exact: true })).toHaveCount(
    0,
  );
  await expect(
    region.getByRole('button', { name: 'Request full fee refund', exact: true }),
  ).toHaveCount(0);
  await page.unroute('**/api/contracts/contract/fee/refund');
  await region.getByRole('button', { name: 'Refresh fee refund', exact: true }).click();
  await expect(region.getByLabel('Fee refund explanation', { exact: true })).toHaveValue(
    'Preserve this refund request explanation',
  );
  await expect(region.getByRole('checkbox')).not.toBeChecked();
});

test('statement email validates counts and retries without claiming inbox delivery', async ({
  page,
}) => {
  await fixture(page);
  const region = page.getByRole('region', { name: 'Fee statement email', exact: true });
  await expect(region.getByRole('status')).toContainText('Queued: 1');
  await expect(
    region.getByText(/Provider or SMTP acceptance does not guarantee inbox delivery/),
  ).toBeVisible();
  await page.route('**/api/contracts/contract/fee/statement-delivery', (route) =>
    route.fulfill({ json: { queued: -1 } }),
  );
  await region.getByRole('button', { name: 'Refresh statement delivery', exact: true }).click();
  await expect(region.getByRole('alert')).toContainText('Invalid statement delivery response');
  await expect(region.getByRole('status')).toHaveCount(0);
  await expect(
    region.getByRole('button', { name: 'Request fee statement email', exact: true }),
  ).toHaveCount(0);
  await page.unroute('**/api/contracts/contract/fee/statement-delivery');
  await region.getByRole('button', { name: 'Refresh statement delivery', exact: true }).click();
  await region.getByRole('button', { name: 'Request fee statement email', exact: true }).click();
  await expect(region.getByRole('status')).toContainText('Accepted by provider: 0');
});
