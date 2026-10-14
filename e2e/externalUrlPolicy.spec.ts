import { test, expect } from '@playwright/test';
import { safeExternalHttpsUrl as browserUrl } from '../web/src/security/externalUrls';
import { safeExternalHttpsUrl as serverUrl } from '../api/src/security/externalUrls';

test('browser outbound-link policy matches storage validation including legacy unsafe values', () => {
  for (const value of [
    undefined,
    null,
    'javascript:alert(1)',
    'http://carrier.com',
    '//carrier.com',
    'https://user:pass@carrier.com',
    'https://localhost',
    'https://127.0.0.1',
    'https://[::1]',
    'https://service.internal',
    'https://carrier.com:8080',
    'https://carrier.com/\ntrack',
    'https://new-carrier.com/track?ref=ABC%20123#status',
  ]) {
    expect(browserUrl(value)).toBe(serverUrl(value));
  }
  expect(browserUrl('javascript:alert(1)')).toBeNull();
  expect(browserUrl('https://new-carrier.com/track')).toBe('https://new-carrier.com/track');
});

for (const trackingUrl of ['javascript:alert(1)', 'https://new-carrier.com/track?ref=ABC']) {
  test(`shipment renders only a safe explicit provider link: ${trackingUrl.startsWith('https:') ? 'safe' : 'unsafe legacy'}`, async ({
    page,
  }) => {
    const actor = {
      id: 'url-actor',
      organization_id: 'seller',
      org_type: 'exporter',
      permissions: ['*'],
      roles: ['supplier_admin'],
      name: 'Trader',
    };
    await page.addInitScript(() =>
      localStorage.setItem(
        'ct_user',
        JSON.stringify({
          id: 'url-actor',
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
      if (path === '/api/me') return route.fulfill({ json: actor });
      if (path === '/api/onboarding')
        return route.fulfill({ json: { status: 'completed', primary_goal: 'sell' } });
      if (path === '/api/shipments/11111111-1111-4111-8111-111111111111')
        return route.fulfill({
          json: {
            shipment: {
              id: '11111111-1111-4111-8111-111111111111',
              contract_id: 'contract',
              seller_organization_id: 'seller',
              buyer_organization_id: 'buyer',
              incoterm: 'FOB',
              payment_plan: 'pay_before_dispatch',
              transport_mode: 'sea',
              current_milestone: 'planning',
              tracking_url: trackingUrl,
              seller_name: 'Seller',
              buyer_name: 'Buyer',
            },
            milestones: [],
            permissions: {
              canArrange: false,
              supported: true,
              milestones: [],
              responsibilities: {},
            },
          },
        });
      return route.fulfill({ json: [] });
    });
    await page.goto('/shipments/11111111-1111-4111-8111-111111111111');
    const link = page.getByRole('link', { name: /Open provider tracking/ });
    if (trackingUrl.startsWith('https:')) {
      await expect(link).toHaveAttribute('href', trackingUrl);
      await expect(link).toContainText('new-carrier.com');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      await expect(link).toHaveAttribute('referrerpolicy', 'no-referrer');
    } else {
      await expect(
        page.getByText(
          'Tracking link unavailable: ask the arranging party to provide a valid HTTPS link.',
          { exact: true },
        ),
      ).toBeVisible();
      await expect(link).toHaveCount(0);
    }
  });
}
