import { test, expect } from './support/fixtures';
import { createWorkspace, signIn, accountPassword } from './support/identity';

for (const role of ['buyer', 'supplier'] as const) {
  test(`${role}: French navigation survives reload and remains separate from another account`, async ({ page, browser }) => {
    test.setTimeout(180_000);
    const first = await createWorkspace(page, browser, role);
    await page.getByLabel('Language', { exact: true }).selectOption('fr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.getByRole('heading', { name: 'Votre espace d’approvisionnement', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Langue', { exact: true })).toHaveValue('fr');
    await expect(page.locator('nav').getByRole('button', { name: 'Propositions', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Rechercher/ }).click();
    await page.getByPlaceholder('Rechercher une rubrique ou un parcours…').fill('Contrats');
    await page.getByRole('button', { name: /Contrats Accords entre acheteurs/ }).click();
    await expect(page).toHaveURL(/\/contracts$/);
    await expect(page.getByRole('heading', { name: 'Contrats de vente', exact: true })).toBeVisible();
    await page.getByTitle('Se déconnecter', { exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    const second = await createWorkspace(page, browser, role);
    expect(second.email).not.toBe(first.email);
    await expect(page.getByLabel('Language', { exact: true })).toHaveValue('en');
    await page.getByTitle('Sign out', { exact: true }).click();
    await signIn(page, first.email, accountPassword);
    await expect(page.getByLabel('Langue', { exact: true })).toHaveValue('fr');
    await page.getByLabel('Langue', { exact: true }).selectOption('en');
    await expect(page.getByRole('heading', { name: 'Your sourcing workspace', exact: true })).toBeVisible();
  });
}

test('blocked preference storage shows a session-only notice and safely falls back on reload', async ({ page, browser }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    const originalGet = Storage.prototype.getItem;
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.getItem = function(key) { if (key.startsWith('ct_language_v1:')) throw new Error('Blocked preference'); return originalGet.call(this, key); };
    Storage.prototype.setItem = function(key, value) { if (key.startsWith('ct_language_v1:')) throw new Error('Blocked preference'); return originalSet.call(this, key, value); };
  });
  await createWorkspace(page, browser, 'buyer');
  await page.getByLabel('Language', { exact: true }).selectOption('fr');
  await expect(page.getByRole('status').filter({ hasText: 'Votre navigateur n’a pas pu enregistrer' })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Language', { exact: true })).toHaveValue('en');
});
