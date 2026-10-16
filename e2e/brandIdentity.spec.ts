import { test, expect } from '@playwright/test';
import { baseURL } from './support/environment';

for (const role of ['buyer', 'supplier'] as const) {
  for (const language of ['en', 'fr'] as const) {
    test(`${role} ${language}: BetterTrade shell preserves existing preferences and cookie session`, async ({
      page,
      context,
    }) => {
      const id = `brand-${role}`;
      const mode = role === 'buyer' ? 'buy' : 'sell';
      const permissions =
        role === 'buyer'
          ? ['listing.read', 'offer.create', 'contract.read']
          : ['listing.create', 'offer.respond', 'contract.read'];
      await context.addCookies([
        {
          name: 'ct_session',
          value: 'existing-session',
          url: baseURL,
          httpOnly: true,
          sameSite: 'Lax',
        },
      ]);
      await page.addInitScript(
        ({ id, language, mode, permissions }) => {
          if (!localStorage.getItem('ct_user')) {
            localStorage.setItem(
              'ct_user',
              JSON.stringify({ id, name: 'Existing member', permissions, roles: [] }),
            );
            localStorage.setItem(`ct_language_v1:${id}`, language);
            localStorage.setItem(`ct_experience_mode:${id}`, mode);
          }
        },
        { id, language, mode, permissions },
      );
      let restoredWithCookie = false;
      await page.route('**/api/**', async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/api/me') {
          restoredWithCookie =
            (await route.request().allHeaders()).cookie?.includes('ct_session=existing-session') ??
            false;
          expect(route.request().headers().authorization).toBeUndefined();
          await route.fulfill({
            json: {
              id,
              name: 'Existing member',
              organization_id: 'existing-org',
              org_type: role === 'buyer' ? 'importer' : 'exporter',
              permissions,
              roles: [`${role}_admin`],
            },
          });
        } else if (path === '/api/onboarding') {
          await route.fulfill({ json: { status: 'completed', primary_goal: `${mode}_verified` } });
        } else if (path === '/api/contracts/11111111-1111-4111-8111-111111111111') {
          await route.fulfill({
            json: {
              id: '11111111-1111-4111-8111-111111111111',
              seller_organization_id: role === 'supplier' ? 'existing-org' : 'other-org',
              buyer_organization_id: role === 'buyer' ? 'existing-org' : 'other-org',
              seller_name: 'Supplier',
              buyer_name: 'Buyer',
              quantity_kg: '10.000',
              price_per_kg: '5.0000',
              currency: 'EUR',
              currency_minor_units: 2,
              status: 'accepted',
              payment_terms_status: 'agreed',
              incoterm: 'FOB',
              documents: [],
            },
          });
        } else if (path.startsWith('/api/contracts/')) {
          await route.fulfill({
            status: 503,
            json: { error: 'Supporting trade fixture unavailable' },
          });
        } else if (path.endsWith('/page')) {
          await route.fulfill({ json: { items: [], hasMore: false, nextCursor: null } });
        } else {
          await route.fulfill({ json: [] });
        }
      });
      await page.goto('/home');
      const sidebar = page
        .locator('aside')
        .filter({ has: page.getByRole('button', { name: /BetterTrade/ }) })
        .last();
      await expect(sidebar.getByRole('button', { name: /BetterTrade/ })).toBeVisible();
      await expect(page).toHaveTitle('BetterTrade — Evidence-aware Trade');
      await expect(page.locator('html')).toHaveAttribute('lang', language);
      await expect(
        page.getByLabel(language === 'en' ? 'Language' : 'Langue', { exact: true }),
      ).toHaveValue(language);
      await expect(page.getByText('CocoaTrace', { exact: true })).toHaveCount(0);
      expect(restoredWithCookie).toBe(true);
      await sidebar
        .locator('nav')
        .getByRole('button', { name: language === 'en' ? 'Home' : 'Accueil', exact: true })
        .click();
      await expect(page).toHaveURL((url) => url.pathname === '/home');
      await sidebar.getByRole('button', { name: /BetterTrade/ }).click();
      await expect(page).toHaveURL((url) => url.pathname === '/home');
      await page.goto('/contracts/11111111-1111-4111-8111-111111111111');
      await expect(
        page.getByRole('heading', { name: 'Trade agreement', exact: true }),
      ).toBeVisible();
      await expect(page.getByTestId('agreement-record-notice')).toContainText(
        'Unsigned platform record',
      );
      await expect(sidebar.getByRole('button', { name: /BetterTrade/ })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', language);
      await page.reload();
      await expect(
        page.getByLabel(language === 'en' ? 'Language' : 'Langue', { exact: true }),
      ).toHaveValue(language);
      const stored = await page.evaluate(
        (id) => ({
          user: JSON.parse(localStorage.getItem('ct_user') || '{}'),
          language: localStorage.getItem(`ct_language_v1:${id}`),
          mode: localStorage.getItem(`ct_experience_mode:${id}`),
        }),
        id,
      );
      expect(stored.user.id).toBe(id);
      expect(stored.language).toBe(language);
      expect(stored.mode).toBe(mode);
      expect(
        (await context.cookies()).find((cookie) => cookie.name === 'ct_session')?.httpOnly,
      ).toBe(true);
    });
  }
}

test('public login displays BetterTrade and descriptive metadata', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText('BetterTrade', { exact: true }).first()).toBeVisible();
  await expect(page).toHaveTitle('BetterTrade — Evidence-aware Trade');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /BetterTrade connects buyers and suppliers/,
  );
  await expect(page.getByText('CocoaTrace', { exact: true })).toHaveCount(0);
});
