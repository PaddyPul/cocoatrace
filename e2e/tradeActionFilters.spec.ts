import { test, expect } from '@playwright/test';

for (const role of ['buyer', 'supplier']) {
  test(`${role} filters all server trade actions before displaying them and retains selection on refresh`, async ({
    page,
  }) => {
    const orgType = role === 'buyer' ? 'importer' : 'exporter';
    await page.addInitScript(
      ({ role, orgType }) =>
        localStorage.setItem(
          'ct_user',
          JSON.stringify({
            id: role,
            organizationId: role,
            orgType,
            roles: [role + '_admin'],
            permissions: ['*'],
            name: role,
          }),
        ),
      { role, orgType },
    );
    let paid = false;
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      const actions = Array.from({ length: 5 }, (_, index) => ({
        id:
          index === 0
            ? 'deal:done:complete'
            : index === 1
              ? 'deal:stopped:cancelled'
              : `action-${index}`,
        kind: index < 2 ? 'complete' : 'waiting',
        priority: index,
        requiresAction: index === 4,
        title: `Recorded trade ${index}`,
        description: 'Server next action',
        actionLabel: 'View deal',
        actionPath: '/deal-room/record',
        ...(index === 3 && !paid ? { paymentDueState: 'overdue' } : {}),
      }));
      const body =
        path === '/api/me'
          ? {
              id: role,
              organization_id: role,
              org_type: orgType,
              permissions: ['*'],
              roles: [role + '_admin'],
              name: role,
            }
          : path === '/api/onboarding'
            ? { status: 'completed', primary_goal: role === 'buyer' ? 'buy' : 'sell' }
            : path === '/api/trade-actions'
              ? actions
              : path === '/api/contracts/summary'
                ? {
                    count: 5,
                    active_count: 3,
                    settled_count: 1,
                    cancelled_count: 1,
                    latest_active_id: null,
                  }
                : path === '/api/offers/summary'
                  ? { received_count: 0, sent_count: 0, received_pending: 0, sent_pending: 0 }
                  : path === '/api/sourcing-requests/summary'
                    ? {
                        own_count: 0,
                        open_count: 0,
                        latest_own: null,
                        latest_own_open: null,
                        latest_open: null,
                      }
                    : path === '/api/farms/summary'
                      ? { count: 0, owned_count: 0 }
                      : path === '/api/holdings/summary'
                        ? { count: 0, available_count: 0, available_kg: '0', commodities: [] }
                        : path === '/api/listings/summary'
                          ? { count: 0, own_count: 0, quantity_kg: '0' }
                          : [];
      await route.fulfill({ json: body });
    });
    await page.goto('/home');
    const centre = page.getByRole('region', { name: 'Trade action centre', exact: true });
    await expect(centre.getByTestId('dashboard-trade-action')).toHaveCount(5);
    const completed = centre.locator('[data-action-id="deal:done:complete"]');
    await expect(completed.getByText('Completed', { exact: true })).toBeVisible();
    await expect(completed.getByText('In progress', { exact: true })).toHaveCount(0);
    await expect(
      centre
        .locator('[data-action-id="deal:stopped:cancelled"]')
        .getByText('Cancelled', { exact: true }),
    ).toBeVisible();
    await expect(
      centre.locator('[data-action-id="action-2"]').getByText('In progress', { exact: true }),
    ).toBeVisible();

    await centre.getByRole('button', { name: 'Action required (1)', exact: true }).click();
    await expect(centre.getByTestId('dashboard-trade-action')).toHaveCount(1);
    await expect(centre.getByText('Recorded trade 4', { exact: true })).toBeVisible();
    await centre.getByRole('button', { name: 'Overdue payments (1)', exact: true }).click();
    await expect(centre.getByText('Recorded trade 3', { exact: true })).toBeVisible();
    paid = true;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(
      centre.getByRole('button', { name: 'Overdue payments (0)', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      centre.getByText('No trade actions match this filter.', { exact: true }),
    ).toBeVisible();
  });
}
