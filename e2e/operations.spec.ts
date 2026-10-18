import { expect, test, type Page } from '@playwright/test';
import { validBacklog } from '../web/src/components/operations/backlog';

const ticket = '11111111-1111-4111-8111-111111111111';
async function mock(page: Page, admin = true) {
  let malformed = false,
    failed = false,
    requeued = false;
  const retryBodies: unknown[] = [];
  const emailRetries: { queue: string; body: unknown }[] = [];
  const recoveredEmails = new Set<string>();
  let emailFailure = '',
    malformedEmail = false,
    backlogFailure = false,
    backlogMalformed = false,
    backlogCapped = false,
    alertsMode = 'disabled',
    alertRegisterFailure = false;
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
    else if (path === '/api/operations/alerts') {
      if (alertsMode === 'unavailable')
        return route.fulfill({ status: 503, json: { code: 'OPERATIONS_ALERTS_UNAVAILABLE' } });
      body =
        alertsMode === 'malformed'
          ? { enabled: false, healthy: true }
          : alertsMode === 'disabled'
            ? {
                enabled: false,
                configuredRecipients: 0,
                healthy: false,
                terminal: false,
                pending: false,
                observation: null,
              }
            : {
                enabled: true,
                configuredRecipients: 1,
                healthy: alertsMode === 'healthy',
                terminal: alertsMode !== 'healthy',
                pending: alertsMode !== 'healthy',
                observation: {
                  last_poll_at: new Date().toISOString(),
                  last_success_at: alertsMode === 'healthy' ? new Date().toISOString() : null,
                  error_code: alertsMode === 'healthy' ? null : 'TERMINAL_ALERT_PENDING',
                  consecutive_failures: alertsMode === 'healthy' ? 0 : 1,
                },
              };
    } else if (path === '/api/operations/backlog') {
      if (backlogFailure)
        return route.fulfill({ status: 503, json: { code: 'OPERATIONS_BACKLOG_UNAVAILABLE' } });
      body = backlogMalformed
        ? { needsAttention: false, queues: [] }
        : {
            observedAt: new Date().toISOString(),
            limit: 1000,
            overdueAfterSeconds: 900,
            needsAttention: true,
            queues: ['cleanup', 'payment_reminder', 'recall', 'fee_statement'].map((name) => ({
              name,
              queued: {
                count: backlogCapped && name === 'cleanup' ? 1000 : 0,
                more: backlogCapped && name === 'cleanup',
              },
              leased: { count: name === 'recall' ? 1 : 0, more: false },
              terminal: { count: 2, more: false },
              retryingObserved: 0,
              expiredLeasesObserved: name === 'recall' ? 1 : 0,
              oldestDueAt:
                backlogCapped && name === 'cleanup'
                  ? new Date(Date.now() - 3600000).toISOString()
                  : null,
              incidents: [
                'TERMINAL_WORK_PENDING',
                ...(name === 'recall' ? ['EXPIRED_LEASE'] : []),
                ...(backlogCapped && name === 'cleanup'
                  ? ['OVERDUE_WORK', 'MONITOR_LIMIT_REACHED']
                  : []),
              ],
            })),
          };
    } else if (path === '/api/operations/status') {
      if (failed) return route.fulfill({ status: 503, json: { error: 'Unavailable' } });
      body = malformed
        ? { healthy: true, jobs: 'missing' }
        : {
            healthy: false,
            jobs: [
              'evidence_scan',
              'evidence_cleanup',
              'payment_reminders',
              'recall_email',
              'fee_statement_email',
            ].map((name) => ({
              job_name: name,
              status: name === 'evidence_cleanup' ? 'failed' : 'succeeded',
              error_code: name === 'evidence_cleanup' ? 'TERMINAL_WORK_PENDING' : null,
              last_success_at: new Date().toISOString(),
              consecutive_failures: name === 'evidence_cleanup' ? 1 : 0,
            })),
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
    else if (
      path === '/api/operations/alerts/dead' ||
      /\/operations\/email\/[^/]+\/dead$/.test(path)
    ) {
      const queue = path.includes('/operations/alerts/') ? 'operator_alert' : path.split('/')[4];
      if (queue === 'operator_alert' && alertRegisterFailure)
        return route.fulfill({
          status: 503,
          json: { code: 'OPERATIONS_ALERT_REGISTER_UNAVAILABLE' },
        });
      const absent =
        recoveredEmails.has(queue) || (queue === 'operator_alert' && alertsMode === 'disabled');
      body = malformedEmail
        ? { items: null, more: false }
        : {
            more: !absent,
            items: absent
              ? []
              : [
                  {
                    id: ticket,
                    status: 'failed_terminal',
                    attempts: 8,
                    last_error_code: 'SMTP_SUBMISSION_FAILED',
                    retryable: true,
                  },
                  {
                    id: '33333333-3333-4333-8333-333333333333',
                    status: 'failed_terminal',
                    attempts: 8,
                    last_error_code: 'FINAL_LEASE_EXPIRED',
                    retryable: false,
                  },
                ],
          };
    } else if (
      /\/operations\/alerts\/[^/]+\/retry$/.test(path) ||
      /\/operations\/email\/[^/]+\/[^/]+\/retry$/.test(path)
    ) {
      const queue = path.includes('/operations/alerts/') ? 'operator_alert' : path.split('/')[4];
      emailRetries.push({ queue, body: route.request().postDataJSON() });
      if (emailFailure)
        return route.fulfill({
          status: emailFailure === 'MFA_STEP_UP_REQUIRED' ? 403 : 409,
          json: { code: emailFailure, error: 'Recovery was not confirmed' },
        });
      recoveredEmails.add(queue);
      body = { queued: true };
    } else if (path === '/api/auth/mfa/authentication/options') {
      return route.fulfill({
        status: 403,
        json: { error: 'Fresh passkey verification unavailable' },
      });
    } else if (path === `/api/operations/cleanup/${ticket}/retry`) {
      retryBodies.push(route.request().postDataJSON());
      requeued = true;
      body = { queued: true };
    }
    return route.fulfill({ json: body });
  });
  return {
    failAlertRegister: (value = true) => {
      alertRegisterFailure = value;
    },
    alertMode: (value: string) => {
      alertsMode = value;
    },
    capBacklog: () => {
      backlogCapped = true;
    },
    failBacklog: (value = true) => {
      backlogFailure = value;
    },
    malformBacklog: () => {
      backlogMalformed = true;
    },
    retryBodies,
    emailRetries,
    emailFailure: (value: string) => {
      emailFailure = value;
    },
    malformEmail: () => {
      malformedEmail = true;
    },
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
  await dialog.getByRole('button', { name: 'Cancel recovery', exact: true }).click();
  const discardReview = page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true });
  await discardReview.getByRole('button', { name: 'Stay and keep editing', exact: true }).click();
  await expect(discardReview).toHaveCount(0);
  await expect(dialog.getByLabel('Recovery explanation', { exact: true })).toHaveValue(
    'Provider outage investigated and corrected',
  );
  await dialog.getByRole('button', { name: 'Cancel recovery', exact: true }).click();
  await discardReview.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(discardReview).toHaveCount(0);
  await expect(dialog).toHaveCount(0);
  await monitor.getByRole('button', { name: 'Review cleanup retry', exact: true }).click();
  await expect(dialog.getByLabel('Recovery explanation', { exact: true })).toHaveValue('');
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
  await expect(
    monitor.getByRole('button', { name: 'Review email retry', exact: true }),
  ).toHaveCount(0);
});

for (const [queue, name] of [
  ['payment_reminder', 'Payment reminder'],
  ['recall', 'Recall'],
  ['fee_statement', 'Fee statement'],
  ['operator_alert', 'Operator alert'],
]) {
  test(`${name} recovery preserves review through conflicts, assurance failure and refresh`, async ({
    page,
  }) => {
    const state = await mock(page);
    if (queue === 'operator_alert') state.alertMode('failed');
    await page.goto('/operations');
    const section = page.getByRole('region', { name: `${name} terminal email`, exact: true });
    await expect(
      section.getByText('Showing the first 50 terminal email records.', { exact: false }),
    ).toBeVisible();
    await expect(
      section.getByRole('button', { name: 'Review email retry', exact: true }),
    ).toHaveCount(1);
    await section.getByRole('button', { name: 'Review email retry', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Email recovery', exact: true });
    await expect(dialog.getByText(/retry(?:ing)? can duplicate email/)).toBeVisible();
    const submit = dialog.getByRole('button', { name: 'Queue reviewed retry', exact: true });
    await expect(submit).toBeDisabled();
    const reason = 'Provider outage investigated and corrected';
    await dialog.getByLabel('Recovery explanation', { exact: true }).fill(reason);
    for (const failure of ['CONFLICT', 'MFA_STEP_UP_REQUIRED']) {
      state.emailFailure(failure);
      await submit.click();
      await expect(dialog.getByRole('alert')).toContainText(
        failure === 'CONFLICT'
          ? 'Recovery was not confirmed'
          : 'Fresh passkey verification unavailable',
      );
      await expect(dialog.getByLabel('Recovery explanation', { exact: true })).toHaveValue(reason);
    }
    await page.getByRole('button', { name: 'Refresh operations', exact: true }).click();
    await expect(dialog.getByLabel('Recovery explanation', { exact: true })).toHaveValue(reason);
    state.emailFailure('');
    await submit.click();
    await expect(dialog).toHaveCount(0);
    await expect(
      section.getByText('No terminal email records observed.', { exact: true }),
    ).toBeVisible();
    expect(state.emailRetries).toEqual(
      Array.from({ length: 3 }, () => ({ queue, body: { reason } })),
    );
  });
}

test('malformed terminal email response never reports an empty or healthy queue', async ({
  page,
}) => {
  const state = await mock(page);
  state.malformEmail();
  await page.goto('/operations');
  await expect(page.getByRole('alert')).toContainText('healthy operation has not been confirmed');
  await expect(page.getByText('No terminal email records observed.', { exact: true })).toHaveCount(
    0,
  );
});

test('queue backlog distinguishes capped counts, expired leases and overdue work', async ({
  page,
}) => {
  const state = await mock(page);
  state.capBacklog();
  await page.goto('/operations');
  const backlog = page.getByRole('region', { name: 'Queue backlog', exact: true });
  const cleanup = backlog.getByRole('row', { name: /Object cleanup/ });
  await expect(cleanup.getByRole('cell', { name: '≥1,000', exact: true })).toBeVisible();
  await expect(cleanup).toContainText('Due for at least 15 minutes');
  await expect(cleanup).toContainText('Observation limit reached');
  await expect(backlog.getByRole('row', { name: /Recall email/ })).toContainText(
    'Expired or missing lease',
  );
  await expect(
    backlog.getByText('Queue incidents need investigation', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Scheduled jobs healthy', { exact: true })).toHaveCount(0);
});

test('failed backlog observation stays unknown and preserves an open recovery explanation', async ({
  page,
}) => {
  const state = await mock(page);
  await page.goto('/operations');
  await page.getByRole('button', { name: 'Review cleanup retry', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Cleanup recovery', exact: true });
  const explanation = dialog.getByLabel('Recovery explanation', { exact: true });
  await explanation.fill('Investigating the delayed queue provider');
  state.failBacklog();
  await page.getByRole('button', { name: 'Refresh operations', exact: true }).click();
  const monitor = page.getByRole('region', { name: 'Operations monitor', exact: true });
  await expect(monitor.getByRole('alert')).toContainText('Queue backlog is unknown');
  await expect(page.getByRole('region', { name: 'Queue backlog', exact: true })).toHaveCount(0);
  await expect(explanation).toHaveValue('Investigating the delayed queue provider');
  state.failBacklog(false);
  await page.getByRole('button', { name: 'Refresh operations', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Queue backlog', exact: true })).toBeVisible();
  state.malformBacklog();
  await page.getByRole('button', { name: 'Refresh operations', exact: true }).click();
  await expect(monitor.getByRole('alert')).toContainText('Queue backlog is unknown');
  await expect(explanation).toHaveValue('Investigating the delayed queue provider');
});

test('backlog contract rejects inconsistent counts, incidents and missing queue observations', () => {
  const healthy = {
    observedAt: '2026-10-13T17:00:00.000Z',
    limit: 1000,
    overdueAfterSeconds: 900,
    needsAttention: false,
    queues: ['cleanup', 'payment_reminder', 'recall', 'fee_statement'].map((name) => ({
      name,
      queued: { count: 0, more: false },
      leased: { count: 0, more: false },
      terminal: { count: 0, more: false },
      retryingObserved: 0,
      expiredLeasesObserved: 0,
      oldestDueAt: null as string | null,
      incidents: [] as string[],
    })),
  };
  expect(validBacklog(healthy)).toBe(true);
  const corruptions = [
    (value: typeof healthy) => {
      value.needsAttention = true;
    },
    (value: typeof healthy) => {
      value.queues[1].name = 'cleanup';
    },
    (value: typeof healthy) => {
      value.queues[0].queued.count = -1;
    },
    (value: typeof healthy) => {
      value.queues[0].queued.more = true;
    },
    (value: typeof healthy) => {
      value.queues[0].terminal.count = 1;
    },
    (value: typeof healthy) => {
      value.queues[0].expiredLeasesObserved = 1;
    },
    (value: typeof healthy) => {
      value.queues[0].oldestDueAt = '2026-10-13T18:00:00.000Z';
    },
    (value: typeof healthy) => {
      value.queues[0].incidents = ['UNSUPPORTED_CLEAR_CLAIM'];
    },
  ];
  for (const corrupt of corruptions) {
    const value = structuredClone(healthy);
    corrupt(value);
    expect(validBacklog(value)).toBe(false);
  }
  expect(validBacklog({ ...healthy, queues: healthy.queues.slice(1) })).toBe(false);
});

test('operator alerts distinguish opt-out, pending terminal work and verified polling from inbox receipt', async ({
  page,
}) => {
  const state = await mock(page);
  await page.goto('/operations');
  const alerts = page.getByRole('region', { name: 'Operator alert delivery', exact: true });
  await expect(alerts.getByText('Operator alerts disabled', { exact: true })).toBeVisible();
  state.alertMode('failed');
  await page.getByRole('button', { name: 'Refresh operations', exact: true }).click();
  await expect(
    alerts.getByText('Operator alert delivery needs investigation', { exact: true }),
  ).toBeVisible();
  await expect(alerts).toContainText('Alert work remains queued or leased');
  state.alertMode('healthy');
  await page.getByRole('button', { name: 'Refresh operations', exact: true }).click();
  await expect(
    alerts.getByText('Alert polling and submission checks passed', { exact: true }),
  ).toBeVisible();
  await expect(alerts).toContainText('SMTP submission is not proof of inbox receipt');
});
test('unavailable or malformed alert status never claims healthy delivery and retains a recovery draft', async ({
  page,
}) => {
  const state = await mock(page);
  await page.goto('/operations');
  await page.getByRole('button', { name: 'Review cleanup retry', exact: true }).click();
  const explanation = page
    .getByRole('dialog', { name: 'Cleanup recovery', exact: true })
    .getByLabel('Recovery explanation', { exact: true });
  await explanation.fill('Provider incident investigation is still in progress');
  for (const mode of ['unavailable', 'malformed']) {
    state.alertMode(mode);
    await page.getByRole('button', { name: 'Refresh operations', exact: true }).click();
    await expect(
      page.getByRole('region', { name: 'Operations monitor', exact: true }).getByRole('alert'),
    ).toContainText('Operator alert delivery is unknown');
    await expect(explanation).toHaveValue('Provider incident investigation is still in progress');
    await expect(
      page.getByRole('region', { name: 'Operator alert delivery', exact: true }),
    ).toHaveCount(0);
  }
});

test('operator alert register failure preserves review and never reports empty terminal work', async ({
  page,
}) => {
  const state = await mock(page);
  state.alertMode('failed');
  await page.goto('/operations');
  const section = page.getByRole('region', { name: 'Operator alert terminal email', exact: true });
  await section.getByRole('button', { name: 'Review email retry', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Email recovery', exact: true });
  await dialog
    .getByLabel('Recovery explanation', { exact: true })
    .fill('Investigated original alert submission failure');
  state.failAlertRegister();
  await page.getByRole('button', { name: 'Refresh operations', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Operator alert delivery is unknown' }),
  ).toBeVisible();
  await expect(dialog.getByLabel('Recovery explanation', { exact: true })).toHaveValue(
    'Investigated original alert submission failure',
  );
  await expect(section).toHaveCount(0);
  state.failAlertRegister(false);
  await page.getByRole('button', { name: 'Refresh operations', exact: true }).click();
  await expect(section).toBeVisible();
  await expect(dialog.getByLabel('Recovery explanation', { exact: true })).toHaveValue(
    'Investigated original alert submission failure',
  );
});
