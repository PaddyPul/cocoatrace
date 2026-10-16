import { expect, test } from '@playwright/test';
test('privileged review preserves evidence uncertainty and binds confirmation to the reviewed hash', async ({
  page,
}) => {
  const user = {
    id: 'reviewer',
    email: 'reviewer@example.test',
    name: 'Reviewer',
    organizationId: 'org',
    orgName: 'Platform',
    orgType: 'admin',
    permissions: ['*'],
    roles: [],
  };
  await page.addInitScript((value) => localStorage.setItem('ct_user', JSON.stringify(value)), user);
  let posted: Record<string, unknown> | undefined;
  const report = {
    snapshotHash: `sha256:${'a'.repeat(64)}`,
    due: true,
    latestReview: null,
    snapshot: {
      counts: { total: 1, unavailable: 0, unknownActivity: 1, staleRetainedEvidence: 0 },
      rows: [
        {
          id: 'target',
          name: 'Unknown activity administrator',
          email: 'target@example.test',
          organization_name: 'Platform',
          active: true,
          created_at: '2025-01-01',
          last_retained_activity_at: null,
          activityFinding: 'unknown',
        },
      ],
    },
  };
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path === '/api/me')
      body = { ...user, organization_id: 'org', org_name: 'Platform', org_type: 'admin' };
    if (path === '/api/onboarding') body = { status: 'completed' };
    if (path === '/api/admin/access-review') {
      if (route.request().method() === 'POST') {
        posted = route.request().postDataJSON();
        await route.fulfill({
          status: 409,
          json: { error: 'Privileged roster or findings changed; reload and review again' },
        });
        return;
      }
      body = report;
    }
    await route.fulfill({ json: body });
  });
  await page.goto('/access-review');
  await expect(
    page.getByRole('heading', { name: 'Privileged access review', exact: true, level: 2 }),
  ).toBeVisible();
  await expect(page.getByText('No retained evidence', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Record review receipt' })).toBeDisabled();
  await page
    .getByLabel('Review reason and follow-up')
    .fill('Investigate unknown activity with account owner');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Record review receipt' }).click();
  await expect(page.getByRole('alert')).toContainText('reload and review again');
  expect(posted?.expectedSnapshotHash).toBe(report.snapshotHash);
  await expect(page.getByRole('button', { name: 'Record review receipt' })).toHaveCount(0);
});
