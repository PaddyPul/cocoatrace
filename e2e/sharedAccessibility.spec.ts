import { test, expect, type Page } from '@playwright/test';

async function workspace(page: Page) {
  const user = {
    id: 'accessibility-user',
    organizationId: 'accessibility-org',
    orgType: 'importer',
    roles: ['buyer'],
    permissions: ['offer.create'],
    name: 'Pilot Buyer',
  };
  await page.addInitScript((value) => localStorage.setItem('ct_user', JSON.stringify(value)), user);
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/me')
      return route.fulfill({
        json: { ...user, organization_id: user.organizationId, org_type: user.orgType },
      });
    if (path === '/api/onboarding')
      return route.fulfill({ json: { status: 'completed', pilot_mode: true } });
    return route.fulfill({ json: {} });
  });
  await page.goto('/pilot/limitations');
  await expect(
    page.getByRole('heading', { name: 'Known pilot limitations', exact: true }),
  ).toBeVisible();
}

async function focusStaysInDialog(page: Page, name: string) {
  const dialog = page.getByRole('dialog', { name, exact: true });
  for (let index = 0; index < 18; index++) {
    await page.keyboard.press('Tab');
    await expect
      .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
      .toBe(true);
  }
}

test('workflow search has an accessible name, traps keyboard focus and restores the trigger', async ({
  page,
}) => {
  await workspace(page);
  const trigger = page.getByRole('button', { name: /Find anything/ });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Find anything', exact: true });
  await expect(dialog.getByRole('textbox', { name: 'Find anything', exact: true })).toBeFocused();
  await focusStaysInDialog(page, 'Find anything');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('mobile navigation excludes hidden desktop controls and keeps focus until Escape', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await workspace(page);
  await expect(page.getByRole('navigation')).toHaveCount(0);
  const trigger = page.getByRole('button', { name: 'Open navigation', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Open navigation', exact: true })).toBeVisible();
  await focusStaysInDialog(page, 'Open navigation');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Open navigation', exact: true })).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('pilot feedback labels its input, communicates selected ratings and preserves keyboard focus', async ({
  page,
}) => {
  await workspace(page);
  const trigger = page.getByRole('button', { name: 'Pilot feedback', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Was this task clear?', exact: true });
  await expect(
    dialog.getByRole('textbox', { name: 'What should we change?', exact: true }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: '4 out of 5', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '4 out of 5', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await focusStaysInDialog(page, 'Was this task clear?');
  await page.keyboard.press('Escape');
  const discard = page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true });
  await expect(discard).toBeVisible();
  await discard.getByRole('button', { name: 'Stay and keep editing', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '4 out of 5', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('visible shared shell and feedback controls expose accessible names', async ({ page }) => {
  await workspace(page);
  const audit = async () => {
    // Scoped DOM contract only: this does not assess color, semantics, screen-reader output or WCAG conformance.
    for (const role of [
      'button',
      'link',
      'textbox',
      'combobox',
      'checkbox',
      'radio',
      'dialog',
    ] as const) {
      const controls = page.getByRole(role);
      for (let index = 0; index < (await controls.count()); index++) {
        const control = controls.nth(index);
        if (await control.isVisible()) await expect(control).toHaveAccessibleName(/\S/);
      }
    }
  };
  await audit();
  await page.getByRole('button', { name: /Find anything/ }).click();
  await audit();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Pilot feedback', exact: true }).click();
  await audit();
});
