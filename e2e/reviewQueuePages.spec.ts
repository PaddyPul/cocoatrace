import { expect, test, type Page } from '@playwright/test';
async function mock(page: Page, permissions = ['*']) {
  let failed = false,
    malformed = false,
    summaryFailed = false;
  const seen: string[] = [];
  await page.addInitScript(
    (permissions) =>
      localStorage.setItem(
        'ct_user',
        JSON.stringify({
          id: 'review-user',
          organizationId: 'review-org',
          orgType: 'exporter',
          roles: [],
          permissions,
          name: 'Review admin',
        }),
      ),
    permissions,
  );
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    seen.push(path + url.search);
    let body: unknown = [];
    const later = Boolean(url.searchParams.get('cursor') || url.searchParams.get('search'));
    if (path === '/api/me')
      body = {
        id: 'review-user',
        organization_id: 'review-org',
        org_type: 'exporter',
        roles: [],
        permissions,
        name: 'Review admin',
      };
    else if (path === '/api/onboarding') body = { status: 'completed', primary_goal: 'sell' };
    else if (path === '/api/access-applications/page' || path === '/api/pilot-feedback/page') {
      if (failed)
        return route.fulfill({ status: 503, json: { error: 'Review records unavailable' } });
      body = malformed
        ? { items: [], count: 1005, hasMore: true, nextCursor: null }
        : {
            items: path.includes('access-applications')
              ? [
                  {
                    id: later ? 'late-application' : 'first-application',
                    status: 'pending_review',
                    organizationName: later ? 'Later applicant' : 'First applicant',
                    organizationType: 'supplier',
                    jurisdiction: 'Ghana',
                    adminName: 'Admin',
                    adminEmail: 'admin@example.test',
                    createdAt: '2026-01-01T00:00:00Z',
                    reviewReason: null,
                    firstAdminInvitationId: null,
                  },
                ]
              : [
                  {
                    id: later ? 'late-feedback' : 'first-feedback',
                    page: '/holdings',
                    task: later ? 'Later review task' : 'First review task',
                    rating: 5,
                    comment: 'Helpful',
                    created_at: '2026-01-01T00:00:00Z',
                    user_name: 'Pilot user',
                    organization_name: 'Own organization',
                  },
                ],
            count: 1005,
            hasMore: !later,
            nextCursor: later ? null : 'next',
          };
    } else if (path === '/api/access-applications/summary') {
      if (summaryFailed)
        return route.fulfill({ status: 503, json: { error: 'Summary unavailable' } });
      body = {
        count: 1005,
        pending_review_count: 1004,
        pending_email_verification_count: 1,
        approved_count: 0,
        rejected_count: 0,
      };
    } else if (path === '/api/pilot-feedback/summary') {
      if (summaryFailed)
        return route.fulfill({ status: 503, json: { error: 'Summary unavailable' } });
      body = {
        count: 1005,
        rating_1_count: 0,
        rating_2_count: 0,
        rating_3_count: 0,
        rating_4_count: 0,
        rating_5_count: 1005,
      };
    } else if (path === '/api/invitations/summary')
      body = { count: 0, pending_count: 0, accepted_count: 0, revoked_count: 0, expired_count: 0 };
    else if (path === '/api/invitations/page')
      body = { items: [], count: 0, hasMore: false, nextCursor: null };
    await route.fulfill({ json: body });
  });
  return {
    seen,
    fail: () => {
      failed = true;
    },
    restore: () => {
      failed = false;
    },
    malform: () => {
      malformed = true;
    },
    failSummary: () => {
      summaryFailed = true;
    },
    restoreSummary: () => {
      summaryFailed = false;
    },
  };
}
test('access applications search and filter server-side with full totals before reviewing an off-page applicant', async ({
  page,
}) => {
  const setup = await mock(page);
  await page.goto('/access-applications');
  const panel = page.getByRole('region', { name: 'Access application register', exact: true });
  await expect(panel).toContainText('1,005 recorded');
  await panel.getByRole('button', { name: 'Next applications', exact: true }).click();
  await expect(panel.getByRole('heading', { name: 'Later applicant', exact: true })).toBeVisible();
  // Filter before opening the modal: background controls are not part of an
  // active access decision, and clicking its backdrop deliberately closes it.
  await panel.getByLabel('Search access applications', { exact: true }).fill('later');
  await page.getByLabel('Filter applications', { exact: true }).selectOption('all');
  await expect(panel.getByRole('heading', { name: 'Later applicant', exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Review', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Access decision', exact: true });
  await dialog.getByLabel('Review reason or note', { exact: true }).fill('Unsaved review');
  await expect(dialog.getByLabel('Review reason or note', { exact: true })).toHaveValue(
    'Unsaved review',
  );
  await expect(panel).toContainText('1,005 recorded');
  expect(setup.seen.some((query) => query.includes('search=later'))).toBe(true);
});
test('access application failures retry and malformed pages never report empty review queues', async ({
  page,
}) => {
  const setup = await mock(page);
  setup.fail();
  await page.goto('/access-applications');
  const panel = page.getByRole('region', { name: 'Access application register', exact: true });
  await expect(panel.getByRole('alert')).toContainText('Review records unavailable');
  await expect(panel.getByText('No matching applications', { exact: true })).toHaveCount(0);
  setup.restore();
  await panel.getByRole('button', { name: 'Retry applications', exact: true }).click();
  await expect(panel.getByRole('heading', { name: 'First applicant', exact: true })).toBeVisible();
  setup.malform();
  await panel.getByLabel('Search access applications', { exact: true }).fill('changed');
  await expect(panel.getByRole('alert')).toContainText('Invalid page response.');
});
test('application summary failure leaves scoped review available with unknown totals', async ({
  page,
}) => {
  const setup = await mock(page);
  setup.failSummary();
  await page.goto('/access-applications');
  const panel = page.getByRole('region', { name: 'Access application register', exact: true });
  await expect(panel).toContainText('total unavailable');
  await expect(panel.getByRole('button', { name: 'Review', exact: true })).toBeVisible();
  setup.restoreSummary();
  await panel.getByRole('button', { name: 'Retry application totals', exact: true }).click();
  await expect(panel).toContainText('1,005 recorded');
});
test('feedback review pages searches and ratings retain independent full scope totals', async ({
  page,
}) => {
  const setup = await mock(page, ['organization.admin']);
  await page.goto('/pilot');
  const panel = page.getByRole('region', { name: 'Pilot feedback register', exact: true });
  await expect(panel).toContainText('1,005 recorded');
  await panel.getByRole('button', { name: 'Next feedback', exact: true }).click();
  await expect(panel.getByRole('cell', { name: 'Later review task', exact: true })).toBeVisible();
  await panel.getByLabel('Search pilot feedback', { exact: true }).fill('later');
  await panel.getByLabel('Feedback rating', { exact: true }).selectOption('5');
  await expect(panel).toContainText('1,005 recorded');
  expect(
    setup.seen.some((query) => query.includes('search=later') && query.includes('rating=5')),
  ).toBe(true);
});
test('feedback failures retry and malformed pages stay explicit', async ({ page }) => {
  const setup = await mock(page);
  setup.fail();
  await page.goto('/pilot');
  const panel = page.getByRole('region', { name: 'Pilot feedback register', exact: true });
  await expect(panel.getByRole('alert')).toContainText('Review records unavailable');
  await expect(panel.getByText('No feedback recorded.', { exact: true })).toHaveCount(0);
  setup.restore();
  await panel.getByRole('button', { name: 'Retry feedback', exact: true }).click();
  await expect(panel.getByRole('cell', { name: 'First review task', exact: true })).toBeVisible();
  setup.malform();
  await panel.getByLabel('Search pilot feedback', { exact: true }).fill('changed');
  await expect(panel.getByRole('alert')).toContainText('Invalid page response.');
});
test('feedback totals failure leaves safe rows available and ordinary users never request the register', async ({
  page,
  browser,
}) => {
  const setup = await mock(page);
  setup.failSummary();
  await page.goto('/pilot');
  const panel = page.getByRole('region', { name: 'Pilot feedback register', exact: true });
  await expect(panel).toContainText('total unavailable');
  await expect(panel.getByRole('cell', { name: 'First review task', exact: true })).toBeVisible();
  setup.restoreSummary();
  await panel.getByRole('button', { name: 'Retry feedback totals', exact: true }).click();
  await expect(panel).toContainText('1,005 recorded');
  const context = await browser.newContext();
  try {
    const ordinary = await context.newPage();
    const restricted = await mock(ordinary, ['listing.read']);
    await ordinary.goto('/pilot');
    await expect(
      ordinary.getByRole('region', { name: 'Invitation register', exact: true }),
    ).toBeVisible();
    await expect(
      ordinary.getByRole('region', { name: 'Pilot feedback register', exact: true }),
    ).toHaveCount(0);
    expect(restricted.seen.some((query) => query.startsWith('/api/pilot-feedback'))).toBe(false);
  } finally {
    await context.close();
  }
});
