import { test, expect } from '@playwright/test';
import { gotoWithNetworkRecovery } from './support/navigation';

test('onboarding pilot feedback has a visible associated label and description without submitting on toggle', async ({
  page,
}) => {
  const user = {
    id: 'pilot-label-user',
    organizationId: 'pilot-label-org',
    orgType: 'importer',
    roles: ['buyer'],
    permissions: ['offer.create'],
    name: 'Pilot label user',
  };
  await page.addInitScript((value) => localStorage.setItem('ct_user', JSON.stringify(value)), user);
  let writes = 0;
  await page.route('**/api/**', (route) => {
    if (!['GET', 'HEAD'].includes(route.request().method())) writes++;
    const pathname = new URL(route.request().url()).pathname;
    return route.fulfill({
      json:
        pathname === '/api/me'
          ? { ...user, organization_id: user.organizationId, org_type: user.orgType }
          : pathname === '/api/onboarding'
            ? {
                status: 'in_progress',
                current_step: 3,
                primary_goal: 'buy_verified',
                pilot_mode: true,
              }
            : {},
    });
  });
  await gotoWithNetworkRecovery(page, '/onboarding');
  const checkbox = page.getByRole('checkbox', {
    name: 'Keep pilot feedback available',
    exact: true,
  });
  await expect(checkbox).toBeChecked();
  await expect(checkbox).toHaveAccessibleDescription(
    'A small control lets you flag unclear steps. Operational evidence and feedback stay separate.',
  );
  await page.locator('label[for="onboarding-pilot-mode"]').click();
  await expect(checkbox).not.toBeChecked();
  await checkbox.focus();
  await page.keyboard.press('Space');
  await expect(checkbox).toBeChecked();
  await expect(checkbox).toBeFocused();
  expect(writes).toBe(0);
});
