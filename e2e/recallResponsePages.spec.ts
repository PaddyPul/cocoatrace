import { expect, Page, test } from '@playwright/test';
const notice = {
  id: 'response-notice',
  reference_code: 'RESPONSE-1',
  title: 'Paged response',
  reason: 'Quality investigation',
  instructions: 'Isolate affected stock',
  status: 'active',
  severity: 'warning',
  initiated_at: '2026-10-09',
  issued_by: 'Supplier',
  batch_count: 1,
  affected_lot_count: 0,
};
const user = {
  id: 'response-user',
  organizationId: 'response-org',
  organization_id: 'response-org',
  name: 'Response user',
  roles: [],
  permissions: ['evidence.read', 'evidence.upload'],
};
async function mock(
  page: Page,
  options: { fail?: boolean; malformed?: boolean; manager?: boolean } = {},
) {
  const requests: Array<Record<string, string>> = [];
  const writes: Array<{ path: string; body: unknown }> = [];
  await page.addInitScript((user) => localStorage.setItem('ct_user', JSON.stringify(user)), user);
  let failed = false;
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname;
    if (path === '/api/me') {
      await route.fulfill({ json: user });
      return;
    }
    if (path === '/api/onboarding') {
      await route.fulfill({ json: { status: 'completed' } });
      return;
    }
    if (path === '/api/recalls/page') {
      await route.fulfill({ json: { items: [notice], hasMore: false, nextCursor: null } });
      return;
    }
    if (path === '/api/recalls/summary') {
      await route.fulfill({ json: { count: 1, active_count: 1 } });
      return;
    }
    if (route.request().method() !== 'GET') {
      writes.push({ path, body: route.request().postDataJSON() });
      await route.fulfill({ json: {} });
      return;
    }
    if (path === '/api/recalls/response-notice/response') {
      const parameters = Object.fromEntries(url.searchParams);
      requests.push(parameters);
      if (options.fail && !failed) {
        failed = true;
        await route.fulfill({ status: 503, json: { error: 'Read timed out' } });
        return;
      }
      const holdingsLater = Boolean(parameters.holdingsCursor || parameters.holdingsSearch);
      const evidenceLater = Boolean(parameters.evidenceCursor || parameters.evidenceSearch);
      const recoveriesLater = Boolean(parameters.recoveriesCursor || parameters.recoveriesSearch);
      const holding = {
        id: holdingsLater ? 'holding-late' : 'holding-first',
        batch_id: 'batch',
        holder_organization_id: 'response-org',
        quantity_kg: 10,
        recovery: {
          holding_id: holdingsLater ? 'holding-late' : 'holding-first',
          quarantined_kg: 0,
          returned_kg: 0,
          destroyed_kg: 2,
          corrected_kg: 0,
          released_kg: 0,
          note: 'Recorded snapshot',
        },
      };
      const paging = Object.fromEntries(
        ['participants', 'holdings', 'recoveries', 'evidence'].map((name) => [
          name,
          {
            count: 1005,
            hasMore: !parameters[`${name}Cursor`] && !parameters[`${name}Search`],
            nextCursor:
              parameters[`${name}Cursor`] || parameters[`${name}Search`] ? null : `${name}-next`,
          },
        ]),
      ) as Record<string, unknown>;
      if (options.malformed) paging.holdings = { count: 1005, hasMore: true, nextCursor: null };
      await route.fulfill({
        json: {
          notice,
          canManage: Boolean(options.manager),
          myOrganizationId: 'response-org',
          participants: [
            {
              organization_id: 'response-org',
              organization_name: parameters.participantsSearch
                ? 'LATE RECIPIENT'
                : 'FIRST RECIPIENT',
              acknowledged_at: null,
              acknowledgement_note: null,
              contact_status: 'pending',
              email_statuses: [],
              eligible_contact_count: 0,
            },
          ],
          holdings: [holding],
          ...(parameters.selectedHoldingId
            ? { selectedHolding: { ...holding, id: parameters.selectedHoldingId } }
            : {}),
          recoveries: [
            { ...holding.recovery, holding_id: recoveriesLater ? 'history-late' : 'history-first' },
          ],
          evidence: [
            {
              id: evidenceLater ? 'evidence-late' : 'evidence-first',
              file_name: evidenceLater ? 'Late proof.pdf' : 'First proof.pdf',
            },
          ],
          paging,
        },
      });
      return;
    }
    await route.fulfill({ status: 403, json: { error: 'No investigation access' } });
  });
  return { requests, writes };
}
async function open(page: Page) {
  await page.goto('/recalls');
  await page.getByRole('button', { name: 'Open response', exact: true }).click();
  return page.getByRole('region', { name: 'Recall response', exact: true });
}
test('response collections search and page independently with full totals and scoped holding recovery', async ({
  page,
}) => {
  const { requests } = await mock(page);
  const panel = await open(page);
  await expect(panel.getByLabel('Recall holdings navigation', { exact: true })).toContainText(
    '1,005 recorded',
  );
  await panel.getByRole('button', { name: 'Next holdings', exact: true }).click();
  await panel
    .getByRole('combobox', { name: 'Your affected holding', exact: true })
    .selectOption('holding-late');
  await expect(panel.getByLabel('Destroyed (kg)', { exact: true })).toHaveValue('2');
  await expect(panel.getByRole('textbox', { name: 'Recovery note', exact: true })).toHaveValue(
    'Recorded snapshot',
  );
  await panel.getByLabel('Search recall participants', { exact: true }).fill('%_ late');
  await expect(panel.getByText('LATE RECIPIENT', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Next recoveries', exact: true }).click();
  await expect
    .poll(() =>
      requests.some(
        (p) => p.recoveriesCursor === 'recoveries-next' && p.holdingsCursor === 'holdings-next',
      ),
    )
    .toBe(true);
  await panel.getByRole('button', { name: 'Previous holdings', exact: true }).click();
  await expect(
    panel.getByRole('combobox', { name: 'Your affected holding', exact: true }),
  ).toHaveValue('holding-late');
  await expect(panel.getByRole('textbox', { name: 'Recovery note', exact: true })).toHaveValue(
    'Recorded snapshot',
  );
});
test('unsaved recovery and selected file survive response paging and focus refresh', async ({
  page,
}) => {
  await mock(page);
  const panel = await open(page);
  await panel
    .getByRole('combobox', { name: 'Your affected holding', exact: true })
    .selectOption('holding-first');
  await panel.getByLabel('Destroyed (kg)', { exact: true }).fill('6');
  await panel
    .getByRole('textbox', { name: 'Recovery note', exact: true })
    .fill('Unsaved recovery explanation');
  await panel.getByLabel('Response evidence file', { exact: true }).setInputFiles({
    name: 'response.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\nTest proof'),
  });
  await panel.getByRole('button', { name: 'Next holdings', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Previous holdings', exact: true })).toBeEnabled();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(panel).toHaveAttribute('aria-busy', 'false');
  await expect(panel.getByLabel('Destroyed (kg)', { exact: true })).toHaveValue('6');
  await expect(panel.getByRole('textbox', { name: 'Recovery note', exact: true })).toHaveValue(
    'Unsaved recovery explanation',
  );
  expect(
    await panel
      .getByLabel('Response evidence file', { exact: true })
      .evaluate((element: HTMLInputElement) => element.files?.[0]?.name),
  ).toBe('response.pdf');
});
test('resolution evidence selection survives evidence paging without granting recipient manager controls', async ({
  page,
}) => {
  const { writes } = await mock(page, { manager: true });
  const panel = await open(page);
  await panel.getByLabel('Use First proof.pdf for resolution', { exact: true }).check();
  await panel.getByRole('button', { name: 'Next evidence', exact: true }).click();
  await panel.getByLabel('Use Late proof.pdf for resolution', { exact: true }).check();
  await expect(panel.getByText(/2 supporting documents selected across pages/)).toBeVisible();
  await panel
    .getByRole('textbox', { name: 'Resolution reason', exact: true })
    .fill('Verified recovery and supporting documents reviewed');
  await panel.getByRole('button', { name: 'Resolve recall with evidence', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].body).toMatchObject({ evidenceIds: ['evidence-first', 'evidence-late'] });
});
test('failed response retries and malformed paging never presents an empty or actionable response', async ({
  page,
}) => {
  await mock(page, { fail: true });
  const panel = await open(page);
  await expect(panel.getByRole('alert')).toContainText('Recall response unavailable');
  await expect(
    panel.getByRole('button', { name: 'Save recovery accounting', exact: true }),
  ).toHaveCount(0);
  await panel.getByRole('button', { name: 'Retry response records', exact: true }).click();
  await expect(
    panel.getByRole('combobox', { name: 'Your affected holding', exact: true }),
  ).toBeVisible();
  await page.route('**/api/recalls/response-notice/response**', (route) =>
    route.fulfill({
      json: {
        notice,
        canManage: false,
        myOrganizationId: 'response-org',
        participants: [],
        holdings: [],
        recoveries: [],
        evidence: [],
        paging: {},
      },
    }),
  );
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(panel.getByRole('alert')).toContainText('Invalid recall response page');
  await expect(
    panel.getByRole('combobox', { name: 'Your affected holding', exact: true }),
  ).toHaveCount(0);
});
test('revoked response access clears open recovery controls after refresh', async ({ page }) => {
  await mock(page);
  const panel = await open(page);
  await panel
    .getByRole('combobox', { name: 'Your affected holding', exact: true })
    .selectOption('holding-first');
  await page.route('**/api/recalls/response-notice/response**', (route) =>
    route.fulfill({ status: 404, json: { error: 'Recall not found' } }),
  );
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(panel.getByRole('alert')).toContainText('Recall response unavailable');
  await expect(
    panel.getByRole('button', { name: 'Save recovery accounting', exact: true }),
  ).toHaveCount(0);
  await expect(
    panel.getByRole('button', { name: 'Upload response evidence', exact: true }),
  ).toHaveCount(0);
});
