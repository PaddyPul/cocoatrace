import { expect, test } from '@playwright/test';

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
  await page.goto('/pilot/limitations');
  await expect(
    page.getByRole('heading', { name: 'Known pilot limitations', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Release notes version 2026-10-14.1', { exact: false }),
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
  const navigation = page.getByRole('button', { name: 'Known pilot limitations', exact: true });
  await expect(navigation).toHaveCount(1);
  await navigation.click();
  await expect(page).toHaveURL(/\/pilot\/limitations$/);
  expect(writes).toEqual([]);
});
