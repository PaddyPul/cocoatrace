import { test, expect } from '@playwright/test';

for (const record of [
  { path: '/contracts/record', endpoint: '/api/contracts/record', retry: 'Retry contract' },
  { path: '/shipments/record', endpoint: '/api/shipments/record', retry: 'Retry transport' },
  { path: '/payments/record', endpoint: '/api/payment-requests/record', retry: 'Retry payment' },
]) {
  test(`${record.retry} performs an explicit read and never invents empty history or replays writes`, async ({
    page,
  }) => {
    const user = {
      id: 'read-recovery',
      organization_id: 'party',
      org_type: 'exporter',
      roles: ['supplier_admin'],
      permissions: ['*'],
      name: 'Trader',
    };
    await page.addInitScript(
      (identity) =>
        localStorage.setItem(
          'ct_user',
          JSON.stringify({
            ...identity,
            organizationId: identity.organization_id,
            orgType: identity.org_type,
          }),
        ),
      user,
    );
    let reads = 0;
    const writes: string[] = [];
    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() !== 'GET') writes.push(path);
      if (path === '/api/me') return route.fulfill({ json: user });
      if (path === '/api/onboarding')
        return route.fulfill({ json: { status: 'completed', primary_goal: 'sell' } });
      if (path === record.endpoint) {
        reads++;
        return route.fulfill({
          status: reads === 1 ? 503 : 403,
          json: {
            error: reads === 1 ? 'Record temporarily unavailable' : 'Access no longer permitted',
            code: reads === 1 ? 'UNAVAILABLE' : 'FORBIDDEN',
          },
        });
      }
      return route.fulfill({ json: {} });
    });
    await page.goto(record.path);
    await expect(page.getByRole('alert')).toContainText('Record temporarily unavailable');
    expect(reads).toBe(1);
    await page.getByRole('button', { name: record.retry, exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Access no longer permitted');
    expect(reads).toBe(2);
    expect(writes).toEqual([]);
    await expect(page.getByText('Not found', { exact: true })).toHaveCount(0);
  });
}
