import { test, expect, type Page } from '@playwright/test';

async function setup(page: Page, options: { permission?: boolean; fail?: boolean } = {}) {
  const actor = {
    id: 'admin',
    email: 'admin@example.test',
    name: 'Admin',
    organizationId: 'org',
    orgType: 'exporter',
    roles: ['supplier_admin'],
    permissions: options.permission === false ? ['invitation.manage'] : ['*'],
  };
  await page.addInitScript((user) => localStorage.setItem('ct_user', JSON.stringify(user)), actor);
  const queries: URL[] = [];
  const changes: { method: string; path: string; data: Record<string, unknown> }[] = [];
  let failure = options.fail;
  let deny = true;
  await page.route('**/api/**', async (route) => {
    if (new URL(route.request().url()).pathname.startsWith('/src/')) return route.continue();
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname;
    if (path === '/api/me')
      return route.fulfill({ json: { ...actor, organization_id: 'org', org_type: 'exporter' } });
    if (path === '/api/onboarding')
      return route.fulfill({ json: { status: 'completed', primary_goal: 'sell' } });
    if (path === '/api/team/roles')
      return route.fulfill({
        json: {
          rows: [
            { name: 'supplier_admin', permissions: ['member.manage'] },
            { name: 'supplier_member', permissions: ['batch.create'] },
          ],
        },
      });
    if (path === '/api/team/members/page') {
      queries.push(url);
      if (failure) {
        failure = false;
        return route.fulfill({ status: 503, json: { error: 'Member service unavailable' } });
      }
      const later =
        url.searchParams.has('cursor') ||
        (url.searchParams.has('search') && !!url.searchParams.get('search'));
      const member = (id: string, email: string, manageable = true) => ({
        id,
        name: id,
        email,
        active: true,
        accessSuspended: false,
        roles: ['supplier_admin'],
        role: 'supplier_admin',
        legacy: false,
        manageable,
      });
      return route.fulfill({
        json: {
          rows: later
            ? [member('later', 'later@example.test')]
            : [
                member('admin', 'admin@example.test'),
                member('protected', 'protected@example.test', false),
                member('colleague', 'colleague@example.test'),
              ],
          next: later ? null : 'opaque-next',
        },
      });
    }
    if (path.match(/\/team\/members\/.+\/(role|deactivate)$/)) {
      changes.push({ method: request.method(), path, data: request.postDataJSON() });
      if (deny) {
        deny = false;
        return route.fulfill({
          status: 409,
          json: {
            code: 'LAST_ADMIN_PROTECTED',
            error: 'Keep at least one active organization administrator.',
          },
        });
      }
      return route.fulfill({ json: { id: 'colleague', changed: true, revokedSessions: 1 } });
    }
    if (path === '/api/invitations/summary')
      return route.fulfill({
        json: { count: 0, pending_count: 0, accepted_count: 0, revoked_count: 0, expired_count: 0 },
      });
    if (path === '/api/invitations/page')
      return route.fulfill({ json: { items: [], count: 0, hasMore: false, nextCursor: null } });
    return route.fulfill({ json: { items: [], rows: [], count: 0 } });
  });
  await page.goto('/pilot');
  return { queries, changes };
}

test('member pages search on server and retain explicit confirmation during refresh and denial', async ({
  page,
}) => {
  const { queries, changes } = await setup(page);
  const members = page.getByRole('region', { name: 'Organization members' });
  await expect(members.getByRole('heading', { name: 'Organization members' })).toBeVisible();
  await expect(
    members
      .getByRole('article', { name: 'admin@example.test' })
      .getByRole('button', { name: 'Deactivate member' }),
  ).toBeDisabled();
  await expect(
    members
      .getByRole('article', { name: 'protected@example.test' })
      .getByRole('button', { name: 'Change role' }),
  ).toBeDisabled();
  await members
    .getByRole('article', { name: 'colleague@example.test' })
    .getByRole('button', { name: 'Change role' })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('New member role').selectOption('supplier_member');
  await dialog.getByLabel('Reason for member change').fill('Responsibility changed');
  await dialog.getByLabel('Current password').fill('Sensitive-password');
  await expect(
    dialog.getByRole('button', { name: 'Confirm role change', exact: true }),
  ).toBeDisabled();
  await dialog.getByLabel('Confirm member email').fill('colleague@example.test');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await members.getByRole('button', { name: 'Refresh members' }).click();
  await expect(dialog.getByLabel('Current password')).toHaveValue('Sensitive-password');
  await expect(dialog.getByLabel('Reason for member change')).toHaveValue('Responsibility changed');
  await dialog.getByRole('button', { name: 'Confirm role change', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Keep at least one');
  await expect(dialog.getByLabel('Current password')).toHaveValue('Sensitive-password');
  await dialog.getByRole('button', { name: 'Confirm role change', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(changes[0]).toEqual({
    method: 'PATCH',
    path: '/api/team/members/colleague/role',
    data: {
      role: 'supplier_member',
      reason: 'Responsibility changed',
      currentPassword: 'Sensitive-password',
    },
  });
  await members.getByRole('button', { name: 'Next members' }).click();
  await expect(members.getByRole('article', { name: 'later@example.test' })).toBeVisible();
  expect(queries.some((url) => url.searchParams.get('cursor') === 'opaque-next')).toBeTruthy();
  await members.getByLabel('Search members', { exact: true }).fill('later');
  await members.getByRole('button', { name: 'Search members', exact: true }).click();
  await expect.poll(() => queries.at(-1)?.searchParams.get('search')).toBe('later');
  expect(queries.at(-1)?.searchParams.get('limit')).toBe('20');
  expect(queries.at(-1)?.searchParams.has('cursor')).toBe(false);
});

test('member loading failure is unavailable, with retry and confirmed deactivation', async ({
  page,
}) => {
  const { changes } = await setup(page, { fail: true });
  const members = page.getByRole('region', { name: 'Organization members' });
  await expect(members.getByRole('alert')).toContainText('Member service unavailable');
  await expect(members.getByText('0 members on this page')).toHaveCount(0);
  await members.getByRole('button', { name: 'Retry members' }).click();
  await members
    .getByRole('article', { name: 'colleague@example.test' })
    .getByRole('button', { name: 'Deactivate member' })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Reason for member change').fill('Access ended');
  await dialog.getByLabel('Current password').fill('Sensitive-password');
  await dialog.getByLabel('Confirm member email').fill('colleague@example.test');
  await dialog.getByRole('button', { name: 'Confirm deactivation', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirm deactivation', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(changes.at(-1)).toEqual({
    method: 'POST',
    path: '/api/team/members/colleague/deactivate',
    data: { reason: 'Access ended', currentPassword: 'Sensitive-password' },
  });
});

test('member administration is hidden without permission', async ({ page }) => {
  const { queries } = await setup(page, { permission: false });
  await expect(page.getByRole('heading', { name: 'Invitations', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Organization members' })).toHaveCount(0);
  expect(queries).toHaveLength(0);
});
