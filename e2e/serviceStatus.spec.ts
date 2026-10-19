import { test, expect } from '@playwright/test';
test('anonymous service status separates readiness, retries unknown and never renders provider details', async ({
  page,
}) => {
  let ready = false;
  const methods: string[] = [];
  await page.route('**/api/**', async (route) => {
    methods.push(route.request().method());
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/health/live')
      return route.fulfill({ json: { status: 'ok', environment: 'test' } });
    if (path === '/api/health/ready')
      return route.fulfill(
        ready
          ? { json: { status: 'ready', providerSecret: 'hidden' } }
          : { status: 503, json: { status: 'not_ready', providerSecret: 'hidden' } },
      );
    return route.fulfill({ json: {} });
  });
  await page.goto('/service-status');
  const observation = page.getByRole('region', { name: 'Latest service observation', exact: true });
  await expect(observation).toContainText('API process: Responding');
  await expect(observation).toContainText('Required dependencies: Not ready');
  await expect(page.getByText('hidden', { exact: true })).toHaveCount(0);
  ready = true;
  await page.getByRole('button', { name: 'Refresh service status', exact: true }).click();
  await expect(observation).toContainText('Required dependencies: Responding');
  expect(methods.every((method) => method === 'GET')).toBe(true);
  await page.route('**/api/health/ready', (route) => route.abort());
  await page.getByRole('button', { name: 'Refresh service status', exact: true }).click();
  await expect(observation.getByRole('alert')).toContainText('Status is unknown');
});

test('failed onboarding read blocks assumptions and retries without discarding session', async ({
  page,
}) => {
  const user = {
    id: 'setup-reader',
    organization_id: 'org',
    org_type: 'importer',
    permissions: ['offer.create'],
    roles: ['buyer'],
    name: 'Buyer',
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
  let unavailable = true;
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/me') return route.fulfill({ json: user });
    if (path === '/api/onboarding')
      return route.fulfill(
        unavailable
          ? { status: 503, json: { error: 'Setup service unavailable' } }
          : { json: { status: 'completed', primary_goal: 'buy' } },
      );
    return route.fulfill({ json: {} });
  });
  await page.goto('/pilot/limitations');
  await expect(
    page.getByRole('heading', { name: 'Workspace setup unavailable', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Known pilot limitations', exact: true }),
  ).toHaveCount(0);
  unavailable = false;
  await page.getByRole('button', { name: 'Retry workspace setup', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Known pilot limitations', exact: true }),
  ).toBeVisible();
});
