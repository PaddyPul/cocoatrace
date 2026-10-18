import { expect, test } from '@playwright/test';
const user = {
  id: 'reporter',
  email: 'reporter@example.test',
  name: 'Reporter',
  organizationId: 'org',
  orgName: 'Pilot',
  orgType: 'admin',
  permissions: ['*'],
  roles: [],
};
const request = {
  id: '23d27ff0-4da3-4f16-8026-50987b44c3e9',
  reference: 'SUP-TEST',
  subject: 'Shipment question',
  description: 'Please review this shipment issue.',
  context: 'shipment',
  entity_id: null,
  status: 'open',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};
test('support retry preserves exact request and key; unsafe context is not copied', async ({
  page,
}) => {
  await page.addInitScript((v) => localStorage.setItem('ct_user', JSON.stringify(v)), user);
  const bodies: Record<string, unknown>[] = [];
  let historyFailed = true;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path === '/api/me')
      body = { ...user, organization_id: 'org', org_name: 'Pilot', org_type: 'admin' };
    if (path === '/api/onboarding') body = { status: 'completed' };
    if (path === '/api/support/requests/page') {
      if (historyFailed) {
        await route.fulfill({ status: 503, json: { error: 'Temporarily unavailable' } });
        return;
      }
      body = { items: [request], hasMore: false, nextCursor: null };
    }
    if (path === '/api/support/requests' && route.request().method() === 'POST') {
      bodies.push(route.request().postDataJSON());
      if (bodies.length === 1) {
        await route.abort('failed');
        return;
      }
      historyFailed = false;
      body = request;
    }
    await route.fulfill({ json: body });
  });
  await page.goto('/support?context=secret-token&entityId=https://example.test/private');
  await expect(
    page.getByRole('heading', { name: 'Support requests', level: 2, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('History could not be loaded');
  await expect(page.getByText('No requests on this page.', { exact: true })).toHaveCount(0);
  await page.getByLabel('Subject', { exact: true }).fill(request.subject);
  await page.getByLabel('Description', { exact: true }).fill(request.description);
  await page.getByRole('button', { name: 'Send request', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry same request', exact: true })).toBeVisible();
  await expect(page.getByLabel('Subject', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Retry same request', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Request saved.' })).toContainText(
    'SUP-TEST',
  );
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toEqual(bodies[0]);
  expect(bodies[0]).toMatchObject({ context: 'other' });
  expect(bodies[0]).not.toHaveProperty('entityId');
});
test('failed operator review preserves notes and saved status through refresh', async ({
  page,
}) => {
  await page.addInitScript((v) => localStorage.setItem('ct_user', JSON.stringify(v)), user);
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path === '/api/me')
      body = { ...user, organization_id: 'org', org_name: 'Pilot', org_type: 'admin' };
    if (path === '/api/onboarding') body = { status: 'completed' };
    if (path.endsWith('/support/requests/page'))
      body = { items: [request], hasMore: false, nextCursor: null };
    if (route.request().method() === 'PATCH') {
      expect(route.request().postDataJSON()).toMatchObject({
        status: 'resolved',
        expectedStatus: 'open',
        reason: 'Investigate and follow up with reporter',
      });
      await route.fulfill({ status: 409, json: { error: 'Review could not be saved' } });
      return;
    }
    await route.fulfill({ json: body });
  });
  await page.goto('/support');
  await page.getByRole('checkbox', { name: 'Operator review queue', exact: true }).check();
  await page.getByRole('button', { name: 'Review SUP-TEST', exact: true }).click();
  await page.getByLabel('New status', { exact: true }).selectOption('resolved');
  await page
    .getByLabel('Review reason and follow-up', { exact: true })
    .fill('Investigate and follow up with reporter');
  await page.getByRole('button', { name: 'Save review', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('alert')).toContainText('Review could not be saved');
  await page.getByRole('button', { name: 'Refresh requests', exact: true }).click();
  await expect(dialog.getByLabel('Review reason and follow-up', { exact: true })).toHaveValue(
    'Investigate and follow up with reporter',
  );
  await expect(dialog).toContainText('Saved status: open');
  await dialog
    .getByRole('button', { name: 'Reload selected request from current page', exact: true })
    .click();
  const discard = page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true });
  await discard.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(discard).toHaveCount(0);
  await expect(dialog.getByLabel('New status', { exact: true })).toHaveValue('open');
  await expect(dialog.getByLabel('Review reason and follow-up', { exact: true })).toHaveValue(
    'Investigate and follow up with reporter',
  );
});
