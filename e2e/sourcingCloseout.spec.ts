import { test, expect } from '@playwright/test';
const id = '11111111-1111-4111-8111-111111111111';
test('manual closeout requires review and retains its reason after reload', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'ct_user',
      JSON.stringify({
        id: 'buyer',
        organizationId: 'buyer-org',
        orgType: 'importer',
        roles: ['buyer'],
        permissions: ['listing.read', 'offer.create'],
        name: 'Buyer',
      }),
    ),
  );
  let row = {
    id,
    buyer_organization_id: 'buyer-org',
    title: 'Reviewed cocoa request',
    commodity: 'cocoa',
    quantity_kg: '10',
    incoterm: 'CIF',
    delivery_location: 'Rotterdam',
    status: 'open',
    visibility: 'matched',
    origin_countries: ['GH'],
    quality_requirements: {},
    assurance_requirements: {},
  };
  let closeout: unknown = null;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/me')
      return route.fulfill({
        json: {
          id: 'buyer',
          organization_id: 'buyer-org',
          org_type: 'importer',
          roles: ['buyer'],
          permissions: ['listing.read', 'offer.create'],
          name: 'Buyer',
        },
      });
    if (path === '/api/onboarding')
      return route.fulfill({ json: { status: 'completed', primary_goal: 'buy' } });
    if (path === '/api/sourcing-requests/page')
      return route.fulfill({ json: { items: [row], hasMore: false, nextCursor: null } });
    if (path === `/api/sourcing-requests/${id}/closeout`) {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        expect(body.confirmed).toBe(true);
        closeout = {
          status: body.status,
          reason: body.reason,
          contract_id: null,
          association_basis: null,
          created_at: '2026-10-16T10:00:00Z',
        };
        row = { ...row, status: body.status };
        return route.fulfill({ json: row });
      }
      return route.fulfill({ json: { closeout } });
    }
    return route.fulfill({ json: {} });
  });
  await page.goto(`/source/new?request=${id}`);
  await page.getByLabel('Closeout outcome').selectOption('awarded');
  await page
    .getByLabel('Existing buyer contract ID', { exact: true })
    .fill('22222222-2222-4222-8222-222222222222');
  await page.getByLabel('Reason', { exact: true }).fill('Review selected contract association');
  await page.getByRole('checkbox', { name: /I reviewed the allocations/ }).check();
  await page.route(
    `**/api/sourcing-requests/${id}/closeout`,
    async (route) => {
      if (route.request().method() === 'POST')
        return route.fulfill({
          status: 400,
          json: { error: 'Choose a noncancelled buyer contract with the same commodity' },
        });
      return route.fallback();
    },
    { times: 1 },
  );
  await page.getByRole('button', { name: 'Confirm permanent closeout' }).click();
  await expect(page.getByRole('alert')).toContainText('same commodity');
  await expect(page.getByLabel('Reason', { exact: true })).toHaveValue(
    'Review selected contract association',
  );
  await page.getByLabel('Closeout outcome').selectOption('closed');
  const submit = page.getByRole('button', { name: 'Confirm permanent closeout' });
  await expect(submit).toBeDisabled();
  await page
    .getByLabel('Reason', { exact: true })
    .fill('No remaining demand after procurement review');
  await expect(submit).toBeDisabled();
  await page.getByRole('checkbox', { name: /I reviewed the allocations/ }).check();
  await submit.click();
  await expect(
    page.getByText('No remaining demand after procurement review', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText('No remaining demand after procurement review', { exact: true }),
  ).toBeVisible();
  await expect(submit).toHaveCount(0);
});
