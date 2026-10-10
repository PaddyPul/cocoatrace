import { expect, test, type Page } from '@playwright/test';
async function mock(page: Page) {
  let summariesFail = false,
    membersFail = false,
    malformed = false,
    revoked = false;
  const queries: string[] = [];
  await page.addInitScript(() =>
    localStorage.setItem(
      'ct_user',
      JSON.stringify({
        id: 'admin-page-user',
        organizationId: 'own-org',
        orgType: 'exporter',
        roles: [],
        permissions: ['*'],
        name: 'Admin reader',
      }),
    ),
  );
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname;
    queries.push(path + url.search);
    let body: unknown = [];
    const later = Boolean(url.searchParams.get('cursor') || url.searchParams.get('search'));
    if (path === '/api/me')
      body = {
        id: 'admin-page-user',
        organization_id: 'own-org',
        org_type: 'exporter',
        roles: [],
        permissions: ['*'],
        name: 'Admin reader',
      };
    else if (path === '/api/onboarding') body = { status: 'completed', primary_goal: 'sell' };
    else if (path === '/api/organizations/summary' || path.endsWith('/members/summary')) {
      if (summariesFail)
        return route.fulfill({ status: 503, json: { error: 'Totals unavailable' } });
      body = { count: 1005 };
    } else if (path === '/api/organizations/page')
      body = {
        items: [
          {
            id: later ? 'late-org' : 'first-org',
            name: later ? 'Later organization' : 'First organization',
            type: 'supplier',
            jurisdiction: 'Ghana',
            verification_status: 'verified',
          },
        ],
        count: 1005,
        hasMore: !later,
        nextCursor: later ? null : 'org-next',
      };
    else if (path.endsWith('/members/page')) {
      if (membersFail)
        return route.fulfill({ status: 503, json: { error: 'Members unavailable' } });
      body = {
        items: [
          {
            id: later ? 'late-user' : 'first-user',
            email: later ? 'late@example.test' : 'first@example.test',
            name: 'Member',
            roles: ['supplier_admin'],
          },
        ],
        count: 1005,
        hasMore: !later,
        nextCursor: later ? null : 'member-next',
      };
    } else if (path === '/api/invitations/summary')
      body = {
        count: 1005,
        pending_count: revoked ? 1004 : 1005,
        accepted_count: 0,
        revoked_count: revoked ? 1 : 0,
        expired_count: 0,
      };
    else if (path === '/api/invitations/page')
      body = malformed
        ? { items: [], count: 1005, hasMore: true, nextCursor: null }
        : {
            items: [
              {
                id: later ? 'late-invite' : 'first-invite',
                email: later ? 'late@example.test' : 'first@example.test',
                organization_name: 'Own org',
                role: 'supplier_admin',
                expires_at: '2099-01-01T00:00:00Z',
                accepted_at: null,
                revoked_at: revoked ? '2026-01-01T00:00:00Z' : null,
                email_delivery_status: 'sent',
              },
            ],
            count: 1005,
            hasMore: !later,
            nextCursor: later ? null : 'invite-next',
          };
    else if (path.endsWith('/resend')) body = { emailDelivery: 'sent' };
    else if (path.endsWith('/revoke')) {
      revoked = true;
      body = {};
    } else if (path === '/api/invitations' && route.request().method() === 'POST')
      body = { emailDelivery: 'sent' };
    await route.fulfill({ json: body });
  });
  return {
    queries,
    failSummaries: () => {
      summariesFail = true;
    },
    restoreSummaries: () => {
      summariesFail = false;
    },
    failMembers: () => {
      membersFail = true;
    },
    restoreMembers: () => {
      membersFail = false;
    },
    malform: () => {
      malformed = true;
    },
  };
}
test('organizations and member dialogs search before pagination with full scoped totals', async ({
  page,
}) => {
  const setup = await mock(page);
  await page.goto('/organizations');
  const register = page.getByRole('region', { name: 'Organization register', exact: true });
  await expect(register).toContainText('1,005 recorded');
  await register.getByRole('button', { name: 'Next organizations', exact: true }).click();
  await expect(
    register.getByRole('cell', { name: 'Later organization', exact: true }),
  ).toBeVisible();
  await register.getByLabel('Search organizations', { exact: true }).fill('later');
  await expect(register).toContainText('1,005 recorded');
  await register.getByRole('button', { name: 'Members →', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Later organization members', exact: true });
  await expect(dialog).toContainText('1,005 members');
  await dialog.getByRole('button', { name: 'Next members', exact: true }).click();
  await expect(dialog.getByRole('cell', { name: 'late@example.test', exact: true })).toBeVisible();
  await dialog.getByLabel('Search members', { exact: true }).fill('late');
  await expect(dialog).toContainText('supplier_admin');
  expect(
    setup.queries.some(
      (query) => query.includes('/late-org/members/page') && query.includes('search=late'),
    ),
  ).toBe(true);
});
test('member failure remains an explicit error and retries without claiming no members', async ({
  page,
}) => {
  const setup = await mock(page);
  setup.failMembers();
  await page.goto('/organizations');
  await page.getByRole('button', { name: 'Members →', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('alert')).toContainText('Members unavailable');
  await expect(dialog.getByText('No members recorded.', { exact: true })).toHaveCount(0);
  setup.restoreMembers();
  await dialog.getByRole('button', { name: 'Retry members', exact: true }).click();
  await expect(dialog).toContainText('1,005 members');
});
test('invitations page and search server-side and resend or revoke refresh current page and full totals', async ({
  page,
}) => {
  const setup = await mock(page);
  await page.goto('/pilot');
  const register = page.getByRole('region', { name: 'Invitation register', exact: true });
  await expect(register).toContainText('1,005 total');
  await register.getByRole('button', { name: 'Next invitations', exact: true }).click();
  await expect(register.getByText('late@example.test', { exact: true })).toBeVisible();
  await register.getByRole('button', { name: 'Resend', exact: true }).click();
  await expect(register.getByText('late@example.test', { exact: true })).toBeVisible();
  await register.getByRole('button', { name: 'Revoke', exact: true }).click();
  await expect(register).toContainText('1 revoked');
  await expect(register.getByRole('button', { name: 'Resend', exact: true })).toHaveCount(0);
  expect(
    setup.queries.filter(
      (query) => query.includes('/invitations/page') && query.includes('cursor=invite-next'),
    ).length,
  ).toBeGreaterThanOrEqual(3);
  await register.getByLabel('Search invitations', { exact: true }).fill('late');
  await register.getByLabel('Invitation status', { exact: true }).selectOption('revoked');
  await expect(register).toContainText('1,005 total');
  expect(
    setup.queries.some(
      (query) => query.includes('search=late') && query.includes('status=revoked'),
    ),
  ).toBe(true);
});
test('malformed invitation envelope stays explicit and never claims empty history', async ({
  page,
}) => {
  const setup = await mock(page);
  setup.malform();
  await page.goto('/pilot');
  const register = page.getByRole('region', { name: 'Invitation register', exact: true });
  await expect(register.getByRole('alert')).toContainText('Invalid page response.');
  await expect(register.getByText('No invitations yet.', { exact: true })).toHaveCount(0);
});

test('organization summary failure keeps authorized rows usable and total unknown', async ({
  page,
}) => {
  const setup = await mock(page);
  setup.failSummaries();
  await page.goto('/organizations');
  const register = page.getByRole('region', { name: 'Organization register', exact: true });
  await expect(register).toContainText('total unavailable');
  await expect(
    register.getByRole('cell', { name: 'First organization', exact: true }),
  ).toBeVisible();
  await expect(register.getByRole('alert')).toContainText('Full totals unavailable');
  setup.restoreSummaries();
  await register.getByRole('button', { name: 'Retry organization totals', exact: true }).click();
  await expect(register).toContainText('1,005 recorded');
});

test('member summary failure keeps the scoped directory available without false totals', async ({
  page,
}) => {
  const setup = await mock(page);
  await page.goto('/organizations');
  await expect(page.getByRole('cell', { name: 'First organization', exact: true })).toBeVisible();
  setup.failSummaries();
  await page.getByRole('button', { name: 'Members →', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('cell', { name: 'first@example.test', exact: true })).toBeVisible();
  await expect(dialog.getByRole('alert')).toContainText('Full totals unavailable');
  setup.restoreSummaries();
  await dialog.getByRole('button', { name: 'Retry member totals', exact: true }).click();
  await expect(dialog).toContainText('1,005 members');
});
