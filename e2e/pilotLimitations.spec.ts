import { expect, test } from '@playwright/test';
import { gotoWithNetworkRecovery } from './support/navigation';

test('pilot participants can discover versioned limitations without changing a trade', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'ct_user',
      JSON.stringify({
        id: 'limitations-user',
        organizationId: 'limitations-org',
        orgType: 'importer',
        roles: ['buyer'],
        permissions: ['offer.create'],
        name: 'Pilot Buyer',
      }),
    ),
  );
  const writes: string[] = [];
  await page.route('**/api/**', async (route) => {
    if (!['GET', 'HEAD'].includes(route.request().method())) writes.push(route.request().url());
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/me')
      return route.fulfill({
        json: {
          id: 'limitations-user',
          organization_id: 'limitations-org',
          org_type: 'importer',
          roles: ['buyer'],
          permissions: ['offer.create'],
          name: 'Pilot Buyer',
        },
      });
    if (path === '/api/onboarding')
      return route.fulfill({ json: { status: 'completed', pilot_mode: true } });
    return route.fulfill({ json: {} });
  });
  await gotoWithNetworkRecovery(page, '/pilot/limitations');
  await expect(
    page.getByRole('heading', { name: 'Known pilot limitations', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Release notes version 2026-10-19.1', { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Negotiation happens outside BetterTrade', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('External messages do not change an offer or accepted trade in BetterTrade.', {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByText('It does not hold funds, provide escrow, guarantee payment', { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'A registered and verified logistics-provider selection marketplace is not available',
      { exact: false },
    ),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Known pilot limitations', exact: true }),
  ).toBeVisible();
  await page.locator('summary').filter({ hasText: 'Account & workspace help' }).click();
  const navigation = page.getByRole('button', { name: 'Known pilot limitations', exact: true });
  await expect(navigation).toHaveCount(1);
  await navigation.click();
  await expect(page).toHaveURL(/\/pilot\/limitations$/);
  const role = page.getByRole('region', { name: 'Platform role', exact: true });
  await expect(role).toContainText(
    'not a certifier, bank, escrow provider, carrier, customs broker or legal compliance authority',
  );
  await role
    .getByRole('link', { name: 'Read platform responsibilities and limits', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'BetterTrade responsibilities and limits', exact: true }),
  ).toBeVisible();
  expect(writes).toEqual([]);
});

test('platform responsibilities are available without signing in and survive reload', async ({
  page,
}) => {
  const writes: string[] = [];
  await page.route('**/api/**', async (route) => {
    if (!['GET', 'HEAD'].includes(route.request().method())) writes.push(route.request().url());
    return route.fulfill({ status: 401, json: { error: 'Not authenticated' } });
  });
  await gotoWithNetworkRecovery(page, '/platform-role');
  const heading = page.getByRole('heading', {
    name: 'BetterTrade responsibilities and limits',
    exact: true,
  });
  await expect(heading).toBeVisible();
  await expect(page.getByRole('main')).toContainText(
    'not a certifier, bank, escrow provider, carrier, customs broker or legal compliance authority',
  );
  await expect(page.getByRole('main')).toContainText('does not hold customer funds');
  await expect(page.getByRole('main')).toContainText('does not guarantee product safety');
  await page.reload();
  await expect(heading).toBeVisible();
  expect(writes).toEqual([]);
});
