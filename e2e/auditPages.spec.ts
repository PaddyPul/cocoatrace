import { expect, Page, test } from '@playwright/test';
const first = '11111111-1111-1111-1111-111111111111',
  late = '22222222-2222-2222-2222-222222222222',
  entity = '33333333-3333-3333-3333-333333333333';
async function mock(page: Page) {
  let mode: 'normal' | 'failed' | 'malformed' | 'badHash' = 'normal';
  const queries: string[] = [];
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    let body: unknown = [];
    if (url.pathname === '/api/me')
      body = {
        user: {
          id: 'audit-reader',
          email: 'reader@example.test',
          name: 'Audit reader',
          organizationId: 'own-org',
          organizationName: 'Own org',
          organizationType: 'exporter',
          roles: ['auditor'],
          permissions: ['audit.read', 'audit.export'],
          preferences: {},
        },
      };
    else if (url.pathname === '/api/onboarding') body = { status: 'completed' };
    else if (url.pathname === '/api/audit/events/page') {
      queries.push(url.search);
      if (mode === 'failed') {
        await route.fulfill({ status: 503, json: { error: 'Read temporarily unavailable' } });
        return;
      }
      const later = Boolean(url.searchParams.get('cursor') || url.searchParams.get('search'));
      body =
        mode === 'malformed'
          ? { items: [], count: 1005, hasMore: true, nextCursor: null }
          : {
              items: [
                {
                  id: later ? late : first,
                  occurred_at: '2026-01-01T00:00:00.123Z',
                  action: later ? 'late.audit' : 'first.audit',
                  entity_type: 'audit_fixture',
                  entity_id: entity,
                  actor_user_id: later ? null : first,
                  new_state_hash: mode === 'badHash' ? 42 : 'sha256:record',
                },
              ],
              count: 1005,
              latestAt: '2026-01-01',
              hasMore: !later,
              nextCursor: later ? null : 'next',
            };
    }
    await route.fulfill({ json: body });
  });
  await page.goto('/audit');
  return {
    panel: page.getByRole('region', { name: 'Audit register', exact: true }),
    queries,
    setMode: (value: typeof mode) => {
      mode = value;
    },
  };
}
test('audit pages search beyond page one and retain full totals with exact filters', async ({
  page,
}) => {
  const { panel, queries } = await mock(page);
  await expect(panel.getByRole('cell', { name: 'first.audit', exact: true })).toBeVisible();
  await expect(panel.getByRole('heading', { level: 2 })).toContainText('1,005 recorded');
  await panel.getByRole('button', { name: 'Next audit events', exact: true }).click();
  await expect(panel.getByRole('cell', { name: 'late.audit', exact: true })).toBeVisible();
  await expect(panel).toContainText('System / actor unavailable');
  await expect(panel).toContainText('Page 2');
  await panel.getByLabel('Search audit log', { exact: true }).fill('%_');
  await expect(panel).toContainText('Page 1');
  await expect
    .poll(() => queries.some((q) => new URLSearchParams(q).get('search') === '%_'))
    .toBe(true);
  await panel.getByLabel('Audit entity type', { exact: true }).fill('audit_fixture');
  await panel.getByLabel('Audit entity ID', { exact: true }).fill(entity);
  await panel.getByRole('button', { name: 'Apply audit filters', exact: true }).click();
  await expect
    .poll(() => queries.some((q) => new URLSearchParams(q).get('entityId') === entity))
    .toBe(true);
  await expect(
    panel.getByRole('button', { name: 'Export entity history', exact: true }),
  ).toBeVisible();
  await expect(panel.getByRole('heading', { level: 2 })).toContainText('1,005 recorded');
});
test('audit failures retry without claiming empty history and malformed envelopes stay explicit', async ({
  page,
}) => {
  const { panel, setMode } = await mock(page);
  await expect(panel).toContainText('1,005 recorded');
  setMode('failed');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(panel.getByRole('alert')).toContainText('Audit events unavailable');
  await expect(panel.getByRole('heading', { level: 2 })).toContainText('total unavailable');
  await expect(
    panel.getByText('No audit events are recorded for this scope.', { exact: true }),
  ).toHaveCount(0);
  setMode('normal');
  await panel.getByRole('button', { name: 'Retry audit events', exact: true }).click();
  await expect(panel.getByRole('cell', { name: 'first.audit', exact: true })).toBeVisible();
  setMode('malformed');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(panel.getByRole('alert')).toContainText('Invalid page response');
  await expect(panel.getByRole('cell', { name: 'first.audit', exact: true })).toHaveCount(0);
});
test('audit register rejects malformed hashes instead of crashing row rendering', async ({
  page,
}) => {
  const { panel, setMode } = await mock(page);
  await expect(panel).toContainText('1,005 recorded');
  setMode('badHash');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(panel.getByRole('alert')).toContainText('Invalid audit page response');
  await expect(panel.getByRole('heading', { level: 2 })).toContainText('total unavailable');
});
