import { expect, test, type Page } from '@playwright/test';

const ticket = '11111111-1111-4111-8111-111111111111';
async function mock(page: Page, admin = true) {
  let malformed = false,
    failed = false,
    requeued = false;
  const retryBodies: unknown[] = [];
  const permissions = admin ? ['*'] : ['batch.read'];
  await page.addInitScript(
    ({ permissions }) =>
      localStorage.setItem(
        'ct_user',
        JSON.stringify({
          id: 'operations-reader',
          organizationId: 'own-org',
          orgType: 'exporter',
          roles: [],
          permissions,
          name: 'Operations reader',
        }),
      ),
    { permissions },
  );
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path === '/api/me')
      body = {
        id: 'operations-reader',
        organization_id: 'own-org',
        org_type: 'exporter',
        roles: [],
        permissions,
        name: 'Operations reader',
      };
    else if (path === '/api/onboarding') body = { status: 'completed', primary_goal: 'sell' };
    else if (path === '/api/operations/status') {
      if (failed) return route.fulfill({ status: 503, json: { error: 'Unavailable' } });
      body = malformed
        ? { healthy: true, jobs: 'missing' }
        : {
            healthy: false,
            jobs: ['evidence_scan', 'evidence_cleanup', 'payment_reminders', 'recall_email'].map(
              (name) => ({
                job_name: name,
                status: name === 'evidence_cleanup' ? 'failed' : 'succeeded',
                error_code: name === 'evidence_cleanup' ? 'TERMINAL_WORK_PENDING' : null,
                last_success_at: new Date().toISOString(),
                consecutive_failures: name === 'evidence_cleanup' ? 1 : 0,
              }),
            ),
          };
    } else if (path === '/api/operations/cleanup/dead')
      body = {
        more: false,
        items: requeued
          ? []
          : [
              { id: ticket, state: 'dead', last_error_code: 'MAX_ATTEMPTS_EXCEEDED', attempts: 8 },
              {
                id: '22222222-2222-4222-8222-222222222222',
                state: 'dead',
                last_error_code: 'LIVE_EVIDENCE_REFERENCE',
                attempts: 1,
              },
            ],
      };
    else if (path === `/api/operations/cleanup/${ticket}/retry`) {
      retryBodies.push(route.request().postDataJSON());
      requeued = true;
      body = { queued: true };
    }
    return route.fulfill({ json: body });
  });
  return {
    retryBodies,
    fail: () => {
      failed = true;
    },
    recover: () => {
      failed = false;
    },
    malform: () => {
      malformed = true;
    },
  };
}

test('operator reviews a safe retry, preserves explanation during refresh and sees refreshed terminal work', async ({
  page,
}) => {
  const state = await mock(page);
  await page.goto('/operations');
  const monitor = page.getByRole('region', { name: 'Operations monitor', exact: true });
  await expect(monitor.getByText('Scheduled jobs need attention', { exact: true })).toBeVisible();
  await expect(
    monitor.getByRole('button', { name: 'Review cleanup retry', exact: true }),
  ).toHaveCount(1);
  await monitor.getByRole('button', { name: 'Review cleanup retry', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Cleanup recovery', exact: true });
  await dialog
    .getByLabel('Recovery explanation', { exact: true })
    .fill('Provider outage investigated and corrected');
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('textbox', { name: 'Recovery explanation', exact: true }),
  ).toHaveAccessibleName('Recovery explanation');
  await monitor.getByRole('button', { name: 'Refresh operations', exact: true }).click();
  await expect(dialog.getByLabel('Recovery explanation', { exact: true })).toHaveValue(
    'Provider outage investigated and corrected',
  );
  state.fail();
  await monitor.getByRole('button', { name: 'Refresh operations', exact: true }).click();
  await expect(monitor.getByRole('alert')).toContainText(
    'healthy operation has not been confirmed',
  );
  await expect(dialog.getByLabel('Recovery explanation', { exact: true })).toHaveValue(
    'Provider outage investigated and corrected',
  );
  state.recover();
  await monitor.getByRole('button', { name: 'Refresh operations', exact: true }).click();
  await expect(monitor.getByText('Scheduled jobs need attention', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Queue reviewed retry', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    monitor.getByText('No terminal cleanup records observed.', { exact: true }),
  ).toBeVisible();
  expect(state.retryBodies).toEqual([{ reason: 'Provider outage investigated and corrected' }]);
});
test('failed and malformed status stays unknown and supports explicit refresh', async ({
  page,
}) => {
  const state = await mock(page);
  state.fail();
  await page.goto('/operations');
  const monitor = page.getByRole('region', { name: 'Operations monitor', exact: true });
  await expect(monitor.getByRole('alert')).toContainText(
    'healthy operation has not been confirmed',
  );
  await expect(monitor.getByText('Scheduled jobs healthy', { exact: true })).toHaveCount(0);
  state.recover();
  await monitor.getByRole('button', { name: 'Refresh operations', exact: true }).click();
  await expect(monitor.getByText('Scheduled jobs need attention', { exact: true })).toBeVisible();
  state.malform();
  await monitor.getByRole('button', { name: 'Refresh operations', exact: true }).click();
  await expect(monitor.getByRole('alert')).toContainText(
    'healthy operation has not been confirmed',
  );
});
test('ordinary workspace cannot see or operate administrator recovery controls', async ({
  page,
}) => {
  await mock(page, false);
  await page.goto('/operations');
  const monitor = page.getByRole('region', { name: 'Operations monitor', exact: true });
  await expect(monitor.getByRole('alert')).toHaveText('Platform administrator access required.');
  await expect(
    monitor.getByRole('button', { name: 'Review cleanup retry', exact: true }),
  ).toHaveCount(0);
});
