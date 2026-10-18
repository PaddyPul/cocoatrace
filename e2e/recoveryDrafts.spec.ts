import { expect, test, type Page } from '@playwright/test';

async function session(page: Page, permissions: string[]) {
  const user = {
    id: 'draft-user',
    organization_id: 'seller',
    org_type: 'exporter',
    roles: [],
    permissions,
    name: 'Draft tester',
  };
  await page.addInitScript(
    (value) =>
      localStorage.setItem(
        'ct_user',
        JSON.stringify({
          ...value,
          organizationId: value.organization_id,
          orgType: value.org_type,
        }),
      ),
    user,
  );
  return user;
}
test('offer rejection cancellation reviews discard, failed save and refresh preserve the explanation', async ({
  page,
}) => {
  const user = await session(page, ['*']);
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/me') return route.fulfill({ json: user });
    if (path === '/api/onboarding')
      return route.fulfill({ json: { status: 'completed', primary_goal: 'sell' } });
    if (path === '/api/offers/summary')
      return route.fulfill({
        json: { received_count: 1, sent_count: 0, received_pending: 1, sent_pending: 0 },
      });
    if (path === '/api/offers/page')
      return route.fulfill({
        json: {
          items: [
            {
              id: 'offer',
              listing_id: 'listing',
              seller_organization_id: 'seller',
              buyer_organization_id: 'buyer',
              buyer_name: 'Draft buyer',
              seller_name: 'Seller',
              quantity_kg: 1,
              offered_price_per_kg: 5,
              currency: 'EUR',
              status: 'pending',
            },
          ],
          hasMore: false,
          nextCursor: null,
        },
      });
    if (path.endsWith('/reject'))
      return route.fulfill({ status: 503, json: { error: 'Review temporarily unavailable' } });
    return route.fulfill({ json: {} });
  });
  await page.goto('/offers');
  await page.getByRole('button', { name: 'Reject', exact: true }).click();
  const rejection = page.getByRole('dialog', { name: 'Reject offer', exact: true });
  await rejection
    .getByLabel('Rejection reason', { exact: true })
    .fill('Keep this rejection explanation');
  await rejection.getByRole('button', { name: 'Reject', exact: true }).click();
  await expect(rejection.getByRole('button', { name: 'Reject', exact: true })).toBeEnabled();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(rejection.getByLabel('Rejection reason', { exact: true })).toHaveValue(
    'Keep this rejection explanation',
  );
  await rejection.getByRole('button', { name: 'Cancel', exact: true }).click();
  const discard = page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true });
  await discard.getByRole('button', { name: 'Stay and keep editing' }).click();
  await expect(rejection.getByLabel('Rejection reason', { exact: true })).toHaveValue(
    'Keep this rejection explanation',
  );
  await rejection.getByRole('button', { name: 'Cancel', exact: true }).click();
  await discard.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(rejection).not.toBeVisible();
  await page.getByRole('button', { name: 'Reject', exact: true }).click();
  await expect(rejection.getByLabel('Rejection reason', { exact: true })).toHaveValue('');
});

test('recall recovery preserves draft through refresh and reviews closing or filtering the open response', async ({
  page,
}) => {
  const user = await session(page, []);
  const notice = {
    id: 'recall',
    title: 'Recall draft',
    reference_code: 'R-1',
    reason: 'Hold material',
    instructions: 'Do not move stock',
    status: 'active',
    severity: 'warning',
    initiated_at: '2026-01-01',
    issued_by: 'Seller',
    batch_count: 1,
    affected_lot_count: 1,
  };
  const holding = {
    id: 'holding',
    batch_id: 'batch',
    holder_organization_id: 'seller',
    quantity_kg: 10,
  };
  let noticeUnavailable = false;
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname;
    if (path === '/api/me') return route.fulfill({ json: user });
    if (path === '/api/onboarding')
      return route.fulfill({ json: { status: 'completed', primary_goal: 'sell' } });
    if (path === '/api/recalls/summary')
      return route.fulfill({ json: { count: 1, active_count: 1 } });
    if (path === '/api/recalls/page') {
      if (noticeUnavailable)
        return route.fulfill({ status: 503, json: { error: 'Notice refresh unavailable' } });
      return route.fulfill({ json: { items: [notice], hasMore: false, nextCursor: null } });
    }
    if (path === '/api/recalls/recall/response')
      return route.fulfill({
        json: {
          notice,
          canManage: false,
          myOrganizationId: 'seller',
          ...(url.searchParams.has('selectedHoldingId') ? { selectedHolding: holding } : {}),
          participants: [],
          holdings: [holding],
          recoveries: [],
          evidence: [],
          paging: Object.fromEntries(
            ['participants', 'holdings', 'recoveries', 'evidence'].map((name) => [
              name,
              { count: name === 'holdings' ? 1 : 0, hasMore: false, nextCursor: null },
            ]),
          ),
        },
      });
    return route.fulfill({ json: {} });
  });
  await page.goto('/recalls');
  const register = page.getByRole('region', { name: 'Recall register', exact: true });
  await register.getByRole('button', { name: 'Open response', exact: true }).click();
  await register.getByLabel('Your affected holding', { exact: true }).selectOption('holding');
  await register.getByLabel('Recovery note', { exact: true }).fill('Unsaved recovery explanation');
  noticeUnavailable = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(register.getByLabel('Recovery note', { exact: true })).toHaveValue(
    'Unsaved recovery explanation',
  );
  await expect(register.getByRole('alert')).toContainText('Notice refresh unavailable');
  await expect(
    register.getByText('No permitted recall notices match these filters.', { exact: true }),
  ).not.toBeVisible();
  noticeUnavailable = false;
  await register.getByRole('button', { name: 'Retry recall notices', exact: true }).click();
  await expect(register.getByRole('alert')).toHaveCount(0);
  await register.getByRole('button', { name: 'Close response', exact: true }).click();
  const discard = page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true });
  await discard.getByRole('button', { name: 'Stay and keep editing' }).click();
  await expect(register.getByLabel('Recovery note', { exact: true })).toHaveValue(
    'Unsaved recovery explanation',
  );
  await register.getByLabel('Recall status', { exact: true }).selectOption('resolved');
  await discard.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(register.getByLabel('Recovery note', { exact: true })).not.toBeVisible();
  await expect(register.getByLabel('Recall status', { exact: true })).toHaveValue('resolved');
});
