import { expect, test } from '@playwright/test';

test('deal activity pages safely and a failed refresh never invents an empty history', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'ct_user',
      JSON.stringify({
        id: 'buyer',
        organizationId: 'buyer-org',
        orgType: 'importer',
        roles: ['buyer'],
        permissions: ['contract.read'],
        name: 'Buyer',
      }),
    ),
  );
  let failed = false;
  const queries: string[] = [];
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === '/api/me')
      return route.fulfill({
        json: {
          id: 'buyer',
          organization_id: 'buyer-org',
          org_type: 'importer',
          roles: ['buyer'],
          permissions: ['contract.read'],
          name: 'Buyer',
        },
      });
    if (path === '/api/onboarding') return route.fulfill({ json: { status: 'completed' } });
    if (path === '/api/contracts/deal')
      return route.fulfill({
        json: {
          id: 'deal',
          status: 'cancelled',
          buyer_organization_id: 'buyer-org',
          seller_organization_id: 'seller-org',
        },
      });
    if (path === '/api/contracts/deal/cancellation')
      return route.fulfill({
        json: { contractStatus: 'cancelled', blockedReason: null, requests: [] },
      });
    if (path === '/api/contracts/deal/activity/page') {
      queries.push(url.search);
      if (failed) return route.fulfill({ status: 503, json: { code: 'CATALOG_READ_TIMEOUT' } });
      const older = url.searchParams.has('cursor');
      return route.fulfill({
        json: {
          items: [
            {
              id: older ? 'older' : 'newer',
              label: older ? 'Payment terms proposed' : 'Payment terms confirmed',
              occurredAt: '2026-10-15T12:30:00.123Z',
              party: older ? 'seller' : 'buyer',
            },
          ],
          hasMore: !older,
          nextCursor: older ? null : 'older-page',
        },
      });
    }
    return route.fulfill({ status: 503, json: { error: 'Unavailable unrelated fixture' } });
  });
  await page.goto('/deal-room/deal');
  const panel = page.getByRole('region', { name: 'Deal activity', exact: true });
  await panel.getByRole('button', { name: 'Show recorded activity', exact: true }).click();
  await expect(panel.getByText('Payment terms confirmed', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Older activity', exact: true }).click();
  await expect(panel.getByText('Payment terms proposed', { exact: true })).toBeVisible();
  expect(queries.some((value) => value.includes('cursor=older-page'))).toBe(true);
  failed = true;
  await panel.getByRole('button', { name: 'Refresh activity', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('Deal activity could not be loaded');
  await expect(
    panel.getByText('No recorded activity available for this deal.', { exact: true }),
  ).toHaveCount(0);
  failed = false;
  await panel.getByRole('button', { name: 'Refresh activity', exact: true }).click();
  await expect(panel.getByText('Payment terms confirmed', { exact: true })).toBeVisible();
});
