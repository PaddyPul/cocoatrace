import { test, expect } from '@playwright/test';

const id = '11111111-1111-1111-1111-111111111111';

test('trade agreement distinguishes the unsigned platform record and retains its JSON export', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'ct_user',
      JSON.stringify({
        id: 'agreement-actor',
        organizationId: 'seller',
        orgType: 'exporter',
        permissions: ['*'],
        roles: ['supplier_admin'],
        name: 'Trader',
      }),
    ),
  );
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/me') {
      await route.fulfill({
        json: {
          id: 'agreement-actor',
          organization_id: 'seller',
          org_type: 'exporter',
          permissions: ['*'],
          roles: ['supplier_admin'],
          name: 'Trader',
        },
      });
    } else if (path === '/api/onboarding') {
      await route.fulfill({ json: { status: 'completed', primary_goal: 'sell' } });
    } else if (path === `/api/contracts/${id}`) {
      await route.fulfill({
        json: {
          id,
          seller_organization_id: 'seller',
          buyer_organization_id: 'buyer',
          seller_name: 'Supplier',
          buyer_name: 'Buyer',
          quantity_kg: 100,
          price_per_kg: 5,
          currency: 'USD',
          currency_minor_units: 2,
          incoterm: 'FOB',
          status: 'accepted',
          payment_terms_status: 'agreed',
          documents: [],
        },
      });
    } else {
      await route.fulfill({ status: 503, json: { error: 'Supporting data unavailable' } });
    }
  });
  await page.goto(`/contracts/${id}`);
  await expect(page.getByRole('heading', { name: 'Trade agreement', exact: true })).toBeVisible();
  const notice = page.getByTestId('agreement-record-notice');
  await expect(notice).toContainText('Unsigned platform record');
  await expect(notice).toContainText('records the parties’ agreed commercial terms');
  await expect(notice).toContainText('Signatures are not captured here');
  await expect(notice).toContainText('legal effect depends on the applicable terms and law');
  await expect(page.getByRole('heading', { name: 'Sales Contract', exact: true })).toHaveCount(0);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download agreement record (JSON)', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('contract-11111111.json');
  await expect(page).toHaveURL(new RegExp(`/contracts/${id}$`));
});
