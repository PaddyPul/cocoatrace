import { test, expect, type Page } from '@playwright/test';
async function mock(
  page: Page,
  options: { failure?: boolean; malformed?: boolean; totalsFailure?: boolean } = {},
) {
  const seen: string[] = [];
  let failed = false;
  const notice = {
    id: 'recall-one',
    title: 'FIRST RECALL',
    reference_code: 'RECALL-1',
    reason: 'Quality issue',
    instructions: 'Isolate stock',
    status: 'active',
    severity: 'warning',
    initiated_at: '2026-01-01',
    issued_by: 'Supplier',
    batch_count: 1005,
    affected_lot_count: 3,
  };
  await page.addInitScript(() =>
    localStorage.setItem(
      'ct_user',
      JSON.stringify({
        id: 'recipient',
        organizationId: 'buyer-org',
        orgType: 'importer',
        roles: [],
        permissions: [],
        name: 'Recipient',
      }),
    ),
  );
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname;
    seen.push(path + url.search);
    if (path === '/api/me') {
      await route.fulfill({
        json: {
          id: 'recipient',
          organization_id: 'buyer-org',
          org_type: 'importer',
          roles: [],
          permissions: [],
          name: 'Recipient',
        },
      });
      return;
    }
    if (path === '/api/onboarding') {
      await route.fulfill({ json: { status: 'completed' } });
      return;
    }
    if (path === '/api/recalls/summary') {
      if (options.totalsFailure) {
        await route.fulfill({ status: 503, json: { error: 'Unavailable' } });
        return;
      }
      await route.fulfill({ json: { count: 1005, active_count: 1004 } });
      return;
    }
    if (path === '/api/recalls/page') {
      if (options.failure && !failed) {
        failed = true;
        await route.fulfill({ status: 503, json: { error: 'Temporarily unavailable' } });
        return;
      }
      if (options.malformed) {
        await route.fulfill({ json: { items: [], hasMore: true, nextCursor: null } });
        return;
      }
      const later = Boolean(
        url.searchParams.get('search') ||
          url.searchParams.get('cursor') ||
          url.searchParams.get('status') === 'resolved',
      );
      await route.fulfill({
        json: {
          items: [
            {
              ...notice,
              title: later ? 'LATE RECALL' : 'FIRST RECALL',
              status: url.searchParams.get('status') === 'resolved' ? 'resolved' : 'active',
            },
          ],
          hasMore: !later,
          nextCursor: later ? null : 'recalls-next',
        },
      });
      return;
    }
    if (path === '/api/recalls/recall-one/response') {
      await route.fulfill({
        json: {
          notice,
          canManage: false,
          myOrganizationId: 'buyer-org',
          participants: [],
          holdings: [
            {
              id: 'holding-one',
              batch_id: 'batch-one',
              holder_organization_id: 'buyer-org',
              quantity_kg: 10,
            },
          ],
          recoveries: [],
          evidence: [],
        },
      });
      return;
    }
    await route.fulfill({ status: 503, json: { error: 'Unused fixture path' } });
  });
  return seen;
}
test('recall register pages and searches notices with full totals and linked counts', async ({
  page,
}) => {
  const seen = await mock(page);
  await page.goto('/recalls');
  const panel = page.getByRole('region', { name: 'Recall register', exact: true });
  await expect(panel.getByRole('heading', { name: /^Recall notices —/ })).toContainText(
    '1,005 recorded · 1,004 active',
  );
  await expect(panel.getByText('1005 source batches', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Next recall notices', exact: true }).click();
  await expect(panel.getByText('LATE RECALL', { exact: true })).toBeVisible();
  await panel.getByLabel('Search recall notices', { exact: true }).fill('LATE');
  await expect(panel.getByText('Page 1', { exact: true })).toBeVisible();
  await panel.getByLabel('Recall status', { exact: true }).selectOption('resolved');
  await panel.getByLabel('Recall severity', { exact: true }).selectOption('critical');
  await expect(panel.getByText(/This notice is resolved/)).toBeVisible();
  expect(seen.some((value) => value.includes('cursor=recalls-next'))).toBe(true);
  expect(seen.some((value) => value.includes('severity=critical'))).toBe(true);
  expect(seen.some((value) => value === '/api/recalls')).toBe(false);
});
test('recipient response remains available without investigation or manager controls and closes on search change', async ({
  page,
}) => {
  await mock(page);
  await page.goto('/recalls');
  const panel = page.getByRole('region', { name: 'Recall register', exact: true });
  await panel.getByRole('button', { name: 'Open response', exact: true }).click();
  await expect(
    panel.getByRole('heading', { name: 'Recall response and recovery', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Activate recall', exact: true })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Resolve recall', exact: true })).toHaveCount(0);
  await panel.getByLabel('Search recall notices', { exact: true }).fill('LATE');
  await expect(panel.getByText('LATE RECALL', { exact: true })).toBeVisible();
  await expect(
    panel.getByRole('heading', { name: 'Recall response and recovery', exact: true }),
  ).toHaveCount(0);
});
test('recall failure retries without asserting there are no notices', async ({ page }) => {
  await mock(page, { failure: true });
  await page.goto('/recalls');
  const panel = page.getByRole('region', { name: 'Recall register', exact: true });
  await expect(panel.getByRole('alert')).toContainText('Recall notices unavailable');
  await expect(panel.getByText(/No permitted recall notices/)).toHaveCount(0);
  await panel.getByRole('button', { name: 'Retry recall notices', exact: true }).click();
  await expect(panel.getByText('FIRST RECALL', { exact: true })).toBeVisible();
});
test('malformed recall page never presents an empty or safe workspace', async ({ page }) => {
  await mock(page, { malformed: true });
  await page.goto('/recalls');
  const panel = page.getByRole('region', { name: 'Recall register', exact: true });
  await expect(panel.getByRole('alert')).toContainText('Invalid page response');
  await expect(panel.getByText(/No permitted recall notices/)).toHaveCount(0);
});
test('unavailable recall totals stay unknown while scoped notice response remains usable', async ({
  page,
}) => {
  await mock(page, { totalsFailure: true });
  await page.goto('/recalls');
  const panel = page.getByRole('region', { name: 'Recall register', exact: true });
  await expect(panel.getByRole('alert')).toContainText('Recall totals unavailable');
  await expect(panel.getByRole('heading', { name: /^Recall notices —/ })).toContainText(
    'total unavailable',
  );
  await expect(panel.getByText('FIRST RECALL', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Open response', exact: true }).click();
  await expect(
    panel.getByRole('heading', { name: 'Recall response and recovery', exact: true }),
  ).toBeVisible();
});

test('same-page focus refresh retains the open recovery form and unsaved quantities', async ({
  page,
}) => {
  await mock(page);
  await page.goto('/recalls');
  const panel = page.getByRole('region', { name: 'Recall register', exact: true });
  await panel.getByRole('button', { name: 'Open response', exact: true }).click();
  await panel.getByLabel('Your affected holding', { exact: true }).selectOption('holding-one');
  await panel.getByLabel('Destroyed (kg)', { exact: true }).fill('6');
  await panel.getByLabel('Recovery note', { exact: true }).fill('Unsaved recovery explanation');
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/recalls/page**', async (route) => {
    await pending;
    await route.fallback();
  });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(panel).toHaveAttribute('aria-busy', 'true');
  await expect(panel.getByLabel('Destroyed (kg)', { exact: true })).toHaveValue('6');
  await expect(panel.getByLabel('Recovery note', { exact: true })).toHaveValue(
    'Unsaved recovery explanation',
  );
  release();
  await expect(panel).toHaveAttribute('aria-busy', 'false');
  await expect(panel.getByLabel('Destroyed (kg)', { exact: true })).toHaveValue('6');
  await expect(panel.getByLabel('Recovery note', { exact: true })).toHaveValue(
    'Unsaved recovery explanation',
  );
});
test('failed same-page refresh clears stale notice actions instead of retaining inaccessible rows', async ({
  page,
}) => {
  await mock(page);
  await page.goto('/recalls');
  const panel = page.getByRole('region', { name: 'Recall register', exact: true });
  await panel.getByRole('button', { name: 'Open response', exact: true }).click();
  await expect(
    panel.getByRole('heading', { name: 'Recall response and recovery', exact: true }),
  ).toBeVisible();
  await page.route('**/api/recalls/page**', (route) =>
    route.fulfill({ status: 403, json: { error: 'Access revoked' } }),
  );
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(panel.getByRole('alert')).toContainText('Recall notices unavailable');
  await expect(
    panel.getByRole('heading', { name: 'Recall response and recovery', exact: true }),
  ).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Open response', exact: true })).toHaveCount(0);
});
