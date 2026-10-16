import { expect, test } from '@playwright/test';
const user = {
  id: 'notices-user',
  email: 'notice@example.test',
  name: 'Reader',
  organizationId: 'org',
  orgName: 'Notice org',
  orgType: 'exporter',
  permissions: ['offer.respond'],
  roles: [],
};
test('current notice failures are explicit and receipts can be retried', async ({ page }) => {
  await page.addInitScript((v) => localStorage.setItem('ct_user', JSON.stringify(v)), user);
  let failed = true,
    read = false,
    rejectWrite = true;
  let finishWrite: (() => void) | undefined;
  const fingerprint = 'a'.repeat(64);
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path === '/api/me')
      body = { ...user, organization_id: 'org', org_name: 'Notice org', org_type: 'exporter' };
    if (path === '/api/onboarding') body = { status: 'completed' };
    if (path.startsWith('/api/notifications/')) {
      if (failed) {
        await route.fulfill({ status: 503, json: { error: 'Current notices unavailable' } });
        return;
      }
      if (path.endsWith('/read')) {
        await new Promise<void>((resolve) => {
          finishWrite = resolve;
        });
        if (rejectWrite) {
          await route.fulfill({ status: 503, json: { error: 'Receipt storage unavailable' } });
          return;
        }
        read = route.request().postDataJSON().read;
        body = { fingerprint, read };
      } else if (path.endsWith('/summary'))
        body = { currentCount: 1, unreadCount: read ? 0 : 1, revision: 'r' };
      else
        body = {
          currentCount: 1,
          unreadCount: read ? 0 : 1,
          items: [
            {
              fingerprint,
              kind: 'offer_decision',
              title: 'Review offer',
              description: 'Buyer submitted terms',
              requiresAction: true,
              responsibleParty: 'you',
              actionLabel: 'Open offer',
              actionPath: '/offers?tab=received',
              read,
            },
          ],
          hasMore: false,
          nextCursor: null,
          revision: 'r',
        };
    }
    await route.fulfill({ json: body });
  });
  await page.goto('/notifications');
  await expect(page.getByRole('alert')).toContainText('Current notices unavailable');
  await expect(page.getByText('Unread count unavailable')).toBeVisible();
  failed = false;
  await page.getByRole('button', { name: 'Retry notifications', exact: true }).click();
  await expect(page.getByText('1 unread of 1 current notices')).toBeVisible();
  const checkbox = page.getByLabel('Mark “Review offer” as read', { exact: true });
  await checkbox.check();
  await expect(page.getByText('Saving read status…', { exact: true })).toBeVisible();
  await expect.poll(() => Boolean(finishWrite)).toBe(true);
  finishWrite!();
  finishWrite = undefined;
  await expect(page.getByRole('alert')).toContainText('Receipt storage unavailable');
  await expect(checkbox).not.toBeChecked();
  await expect(page.getByText('1 unread of 1 current notices')).toBeVisible();
  rejectWrite = false;
  await checkbox.check();
  await expect(page.getByText('Saving read status…', { exact: true })).toBeVisible();
  await expect.poll(() => Boolean(finishWrite)).toBe(true);
  finishWrite!();
  finishWrite = undefined;
  await expect(page.getByLabel('Mark “Review offer” as read', { exact: true })).toBeChecked();
  await expect(page.getByText('0 unread of 1 current notices')).toBeVisible();
});
