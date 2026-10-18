import { expect, test, type Page } from '@playwright/test';

async function inventory(page: Page) {
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
  let fails = true;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/me') return route.fulfill({ json: user });
    if (path === '/api/onboarding')
      return route.fulfill({ json: { status: 'completed', primary_goal: 'sell' } });
    if (route.request().method() === 'POST' && path === '/api/inventory/direct') {
      if (fails)
        return route.fulfill({ status: 503, json: { error: 'Inventory temporarily unavailable' } });
      return route.fulfill({ json: { holding_id: '11111111-1111-4111-8111-111111111111' } });
    }
    if (path.endsWith('/page'))
      return route.fulfill({ json: { items: [], nextCursor: null, hasMore: false } });
    return route.fulfill({ json: {} });
  });
  await page.goto('/inventory/new');
  await expect(page.getByLabel('Commodity or material', { exact: true })).toBeVisible();
  return {
    succeed: () => {
      fails = false;
    },
  };
}

test('pristine navigation is immediate; dirty navigation stays, Escape retains values, and leave discards', async ({
  page,
}) => {
  await inventory(page);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(/\/home\?mode=sell/);
  await page.goto('/inventory/new');
  await page.getByLabel('Commodity or material', { exact: true }).fill('Peanut draft');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Leave unsaved changes?', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Stay and keep editing' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByLabel('Commodity or material', { exact: true })).toHaveValue(
    'Peanut draft',
  );
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await dialog.getByRole('button', { name: 'Stay and keep editing' }).click();
  await expect(page.getByLabel('Commodity or material', { exact: true })).toHaveValue(
    'Peanut draft',
  );
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await dialog.getByRole('button', { name: 'Leave and discard changes' }).click();
  await expect(page).toHaveURL(/\/home\?mode=sell/);
});

test('failed save retains navigation protection; successful save clears it before redirect', async ({
  page,
}) => {
  const fixture = await inventory(page);
  await page.getByLabel('Commodity or material', { exact: true }).fill('Peanut draft');
  await page.getByLabel('Quantity (kg)', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Create inventory', exact: true }).click();
  await expect(page.getByText('Inventory temporarily unavailable', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Stay and keep editing' }).click();
  await expect(page.getByLabel('Quantity (kg)', { exact: true })).toHaveValue('10');
  fixture.succeed();
  await page.getByRole('button', { name: 'Create inventory', exact: true }).click();
  await expect(page).toHaveURL(/\/supply\/new\?holding=/);
  await expect(
    page.getByRole('dialog', { name: 'Leave unsaved changes?', exact: true }),
  ).not.toBeVisible();
});

test('browser back uses the same stay and leave decision', async ({ page }) => {
  await inventory(page);
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Publish supply', exact: true })
    .click();
  await page
    .getByTestId('supply-path-choice')
    .getByRole('button', { name: 'Create inventory', exact: true })
    .click();
  await expect(page.getByLabel('Commodity or material', { exact: true })).toBeVisible();
  await page.getByLabel('Commodity or material', { exact: true }).fill('Back navigation draft');
  await page.evaluate(() => window.history.back());
  const dialog = page.getByRole('dialog', { name: 'Leave unsaved changes?', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Stay and keep editing' }).click();
  await expect(page.getByLabel('Commodity or material', { exact: true })).toHaveValue(
    'Back navigation draft',
  );
  await page.evaluate(() => window.history.back());
  await dialog.getByRole('button', { name: 'Leave and discard changes' }).click();
  await expect(page).not.toHaveURL(/\/inventory\/new/);
});

test('security navigation disables the best-effort unload prompt without storing a draft', async ({
  page,
}) => {
  await inventory(page);
  await page.getByLabel('Commodity or material', { exact: true }).fill('Private draft');
  const preventsUnload = () =>
    page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
  expect(await preventsUnload()).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event('ct:security-navigation')));
  expect(await preventsUnload()).toBe(false);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('Private draft');
});

test('unavailable navigation review keeps the current draft available', async ({ page }) => {
  await inventory(page);
  await page.route('**/*UnsavedChangesDialog*', (route) => route.abort());
  await page.getByLabel('Commodity or material', { exact: true }).fill('Retained offline draft');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Navigation review could not load');
  await page.getByRole('button', { name: 'Stay and keep editing', exact: true }).click();
  await expect(page.getByLabel('Commodity or material', { exact: true })).toHaveValue(
    'Retained offline draft',
  );
  await expect(page).toHaveURL(/\/inventory\/new/);
});
