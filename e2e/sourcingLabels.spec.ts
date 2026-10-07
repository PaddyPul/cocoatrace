import { test, expect } from '@playwright/test';

// Presentation regression only. The real PostgreSQL sourcing journey separately
// verifies persistence; this fixture isolates dropdown accessible names.
test('sourcing selectors have stable names independent of their option text', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ct_user', JSON.stringify({ id: 'label-buyer', organizationId: 'label-org', roles: ['buyer_admin'], permissions: ['*'], name: 'Buyer' }));
  });
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const body = path === '/api/me' ? { id: 'label-buyer', organization_id: 'label-org', org_name: 'Buyer Org', name: 'Buyer', roles: ['buyer_admin'], permissions: ['*'] }
      : path === '/api/onboarding' ? { status: 'completed' } : [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/source/new');
  const visibility = page.getByLabel('Visibility', { exact: true });
  await visibility.selectOption('private');
  await expect(visibility).toHaveValue('private');
  await expect(page.getByRole('button', { name: 'Save private draft', exact: true })).toBeVisible();
  await visibility.selectOption('matched');
  await expect(visibility).toHaveValue('matched');
  await expect(page.getByRole('button', { name: 'Find matching supply', exact: true })).toBeVisible();
  const incoterm = page.getByLabel('Incoterm', { exact: true });
  await incoterm.selectOption('FOB');
  await expect(incoterm).toHaveValue('FOB');
});
