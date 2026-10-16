import { expect, test } from '@playwright/test';

for (const environment of ['demo', 'staging', 'production'] as const) {
  test(`${environment} workspace is visibly identified from the server on entry and reload`, async ({
    page,
  }) => {
    await page.route('**/api/me', (route) =>
      route.fulfill({ status: 401, json: { error: 'Sign in' } }),
    );
    await page.route('**/api/health/live', (route) =>
      route.fulfill({ json: { status: 'ok', environment } }),
    );
    await page.goto('/login');
    const notice = page.getByRole('note', { name: 'Workspace environment', exact: true });
    await expect(notice).toContainText(
      `${environment[0].toUpperCase()}${environment.slice(1)} environment`,
    );
    if (environment !== 'production')
      await expect(notice).toContainText('do not use for live trades');
    await page.reload();
    await expect(notice).toContainText(
      `${environment[0].toUpperCase()}${environment.slice(1)} environment`,
    );
  });
}

test('unavailable environment stays unknown instead of inferring safety from a hostname', async ({
  page,
}) => {
  await page.route('**/api/me', (route) => route.fulfill({ status: 401, json: {} }));
  await page.route('**/api/health/live', (route) =>
    route.fulfill({ status: 503, json: { status: 'error', environment: 'production' } }),
  );
  await page.goto('/login');
  await expect(
    page.getByRole('note', { name: 'Workspace environment', exact: true }),
  ).toContainText('Environment unconfirmed');
});
