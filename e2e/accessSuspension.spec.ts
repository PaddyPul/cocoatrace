import { test, expect } from './support/fixtures';
import { accountPassword, createWorkspace, platformReviewerContext, signIn } from './support/identity';

test('administrator suspends and restores buyer access without reviving sessions', async ({ page, browser }) => {
  const identity = await createWorkspace(page, browser, 'buyer');
  expect((await page.request.get('/api/admin/access-controls/organizations')).status()).toBe(403);
  const reviewer = await platformReviewerContext(browser);
  try {
    const adminPage = await reviewer.newPage();
    await adminPage.goto('/access-controls');
    const findOrganization = async () => {
      const row = adminPage.locator('article').filter({ hasText: identity.organization });
      const more = adminPage.getByRole('button', { name: 'Load more organizations', exact: true });
      await expect.poll(async () => await row.count() + await more.count()).toBeGreaterThan(0);
      while (await row.count() === 0) {
        await expect(more).toBeVisible();
        const response = adminPage.waitForResponse(r => new URL(r.url()).pathname.endsWith('/admin/access-controls/organizations'));
        await more.click(); await response;
      }
      return row;
    };
    const organization = await findOrganization();
    await organization.getByRole('button', { name: 'Review suspension', exact: true }).click();
    await adminPage.getByLabel('Decision reason').fill('Browser security review requires temporary suspension');
    await adminPage.getByLabel('Current administrator password').fill('IncorrectPassword');
    await adminPage.getByRole('button', { name: 'Confirm access decision', exact: true }).click();
    await expect(adminPage.getByRole('alert')).toContainText('Confirm your current administrator password');
    await adminPage.getByLabel('Current administrator password').fill('BrowserAdminPassword123!');
    await adminPage.getByRole('button', { name: 'Confirm access decision', exact: true }).click();
    await expect(adminPage.getByRole('status')).toContainText('Access decision recorded');
    expect((await page.request.get('/api/me')).status()).toBe(401);
    const denied = await page.request.post('/api/auth/login', { data: { email: identity.email, password: accountPassword } });
    expect(denied.status()).toBe(403);
    const suspendedOrganization = await findOrganization();
    await suspendedOrganization.getByRole('button', { name: 'Review restoration', exact: true }).click();
    await adminPage.getByLabel('Decision reason').fill('Browser restoration independently reviewed');
    await adminPage.getByLabel('Current administrator password').fill('BrowserAdminPassword123!');
    await adminPage.getByRole('button', { name: 'Confirm access decision', exact: true }).click();
    await expect(adminPage.getByRole('status')).toContainText('Access decision recorded');
    expect((await page.request.get('/api/me')).status()).toBe(401);
    await signIn(page, identity.email, accountPassword);
    expect((await page.request.get('/api/me')).status()).toBe(200);
  } finally { await reviewer.close(); }
});
