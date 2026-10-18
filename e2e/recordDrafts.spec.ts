import { expect, test } from '@playwright/test';

test('plot edits survive a failed save and cancelled discard; confirmed discard resets the form', async ({
  page,
}) => {
  const user = {
    id: 'supplier',
    organization_id: 'supplier-org',
    org_type: 'supplier',
    roles: ['supplier'],
    permissions: ['*'],
    name: 'Supplier',
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
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/me') return route.fulfill({ json: user });
    if (path === '/api/onboarding')
      return route.fulfill({ json: { status: 'completed', primary_goal: 'sell' } });
    if (path === '/api/farms/farm-draft')
      return route.fulfill({
        json: {
          farm: {
            id: 'farm-draft',
            name: 'Draft farm',
            farmer_organization_id: 'supplier-org',
            region: 'Northern',
          },
        },
      });
    if (path === '/api/farms/farm-draft/plots' && route.request().method() === 'POST')
      return route.fulfill({ status: 503, json: { error: 'Plot service unavailable' } });
    if (path.endsWith('/page'))
      return route.fulfill({ json: { items: [], nextCursor: null, hasMore: false } });
    if (path.endsWith('/summary')) return route.fulfill({ json: { count: 0 } });
    return route.fulfill({ json: {} });
  });
  await page.goto('/farms/farm-draft');
  await page.getByRole('button', { name: '+ Add Plot', exact: true }).click();
  const code = page.getByPlaceholder('Plot code * (e.g. PLOT-A-01)', { exact: true });
  await code.fill('Unsaved plot');
  await page.getByPlaceholder('Area (hectares) *', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Add Plot', exact: true }).click();
  await expect(page.getByText('Plot service unavailable', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true });
  await expect(review).toBeVisible();
  await review.getByRole('button', { name: 'Stay and keep editing', exact: true }).click();
  await expect(code).toHaveValue('Unsaved plot');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await review.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(code).not.toBeVisible();
  await page.getByRole('button', { name: '+ Add Plot', exact: true }).click();
  await expect(code).toHaveValue('');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(review).not.toBeVisible();
});

test('anonymous organization application warns on unload without persisting entered details', async ({
  page,
}) => {
  await page.route('**/api/**', (route) => route.fulfill({ json: {} }));
  await page.goto('/request-access');
  await page.getByLabel('Organization name', { exact: true }).fill('Unsubmitted organization');
  expect(
    await page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  ).toBe(true);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    'Unsubmitted organization',
  );
});
