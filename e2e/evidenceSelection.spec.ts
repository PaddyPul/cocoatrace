import { test, expect, Page } from '@playwright/test';
const first = '11111111-1111-1111-1111-111111111111',
  later = '22222222-2222-2222-2222-222222222222',
  linked = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
async function fixture(page: Page, mode = 'pages') {
  await page.addInitScript(() =>
    localStorage.setItem(
      'ct_user',
      JSON.stringify({
        id: 'supplier',
        organizationId: 'supplier',
        orgType: 'exporter',
        permissions: ['*'],
        roles: ['supplier_admin'],
        name: 'Supplier',
      }),
    ),
  );
  const queries: string[] = [];
  let lookupReads = 0,
    failedReads = 0;
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/evidence/record-options') {
      queries.push(url.search);
      if (mode === 'failure' && failedReads++ === 0) {
        await route.fulfill({ status: 503, json: { error: 'Selection unavailable' } });
        return;
      }
      if (mode === 'malformed') {
        await route.fulfill({ json: [] });
        return;
      }
      if (url.searchParams.get('id')) {
        lookupReads++;
        if (mode === 'lookup-retry' && lookupReads === 1) {
          await route.fulfill({ status: 503, json: { error: 'Lookup unavailable' } });
          return;
        }
        await route.fulfill({
          json: {
            items:
              mode === 'missing' ? [] : [{ id: linked, label: 'Linked source beyond page one' }],
            hasMore: false,
            nextCursor: null,
          },
        });
        return;
      }
      const next = Boolean(url.searchParams.get('cursor') || url.searchParams.get('search'));
      await route.fulfill({
        json: {
          items: [
            {
              id: next ? later : first,
              label: next ? 'Later permitted record' : 'First permitted record',
            },
          ],
          hasMore: !next,
          nextCursor: next ? null : 'next-record',
        },
      });
      return;
    }
    if (['/api/farms', '/api/batches', '/api/contracts', '/api/shipments'].includes(url.pathname)) {
      await route.fulfill({
        status: 500,
        json: { error: 'Legacy full-array selection must not be used' },
      });
      return;
    }
    if (url.pathname === '/api/evidence/upload-intents') {
      await route.fulfill({
        status: 201,
        json: { uploadUrl: '/evidence/upload-intents/test/content' },
      });
      return;
    }
    if (url.pathname === '/api/evidence/upload-intents/test/content') {
      await route.fulfill({ status: 201, json: { id: 'evidence' } });
      return;
    }
    await route.fulfill({
      json:
        url.pathname === '/api/me'
          ? {
              id: 'supplier',
              organization_id: 'supplier',
              org_type: 'exporter',
              permissions: ['*'],
              roles: ['supplier_admin'],
              name: 'Supplier',
            }
          : url.pathname === '/api/onboarding'
            ? { status: 'completed', primary_goal: 'sell' }
            : [],
    });
  });
  return queries;
}
test('selection retains context, explanation and file across pages and search, and uploads to the chosen record', async ({
  page,
}) => {
  const queries = await fixture(page);
  await page.goto('/evidence/contribute');
  await page.getByRole('button', { name: 'Next evidence records', exact: true }).click();
  await page.getByLabel('Evidence record', { exact: true }).selectOption(later);
  await page.getByLabel('Evidence explanation', { exact: true }).fill('Source origin proof');
  await page.getByLabel('Evidence file', { exact: true }).setInputFiles({
    name: 'origin.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n%%EOF'),
  });
  await page.getByRole('button', { name: 'Previous evidence records', exact: true }).click();
  await expect(page.getByLabel('Evidence record', { exact: true })).toHaveValue(later);
  await expect(page.getByLabel('Evidence explanation', { exact: true })).toHaveValue(
    'Source origin proof',
  );
  await page.getByLabel('Search evidence records', { exact: true }).fill('exact source');
  await expect
    .poll(() =>
      queries.some((query) => query.includes('search=exact+source') && !query.includes('cursor=')),
    )
    .toBe(true);
  await expect(page.getByRole('button', { name: 'Attach evidence', exact: true })).toBeEnabled();
  const sent = page.waitForRequest(
    (request) =>
      request.url().endsWith('/api/evidence/upload-intents') && request.method() === 'POST',
  );
  await page.getByRole('button', { name: 'Attach evidence', exact: true }).click();
  expect((await sent).postDataJSON()).toMatchObject({
    linkedEntityType: 'farm',
    linkedEntityId: later,
    claimDescription: 'Source origin proof',
  });
  await expect(page.getByText(/Evidence attached to Later permitted record/)).toBeVisible();
});
test('off-page deep link uses exact authorized lookup and changing record kind clears the old context', async ({
  page,
}) => {
  const queries = await fixture(page);
  await page.goto(`/evidence/contribute?entityType=farm&entityId=${linked.toUpperCase()}`);
  await expect(page.getByLabel('Evidence record', { exact: true })).toHaveValue(linked);
  await expect(page.getByTestId('evidence-context')).toContainText('Linked source beyond page one');
  expect(
    queries.some(
      (query) => query.toLowerCase().includes(`id=${linked}`) && query.includes('kind=farm'),
    ),
  ).toBe(true);
  await page.getByLabel('Evidence explanation', { exact: true }).fill('Old source explanation');
  await page.getByLabel('Evidence record type', { exact: true }).selectOption('contract');
  await expect(page.getByTestId('evidence-context')).toHaveCount(0);
  await page.getByLabel('Evidence record', { exact: true }).selectOption(first);
  await expect(page.getByLabel('Evidence explanation', { exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Attach evidence', exact: true })).toBeDisabled();
  await expect
    .poll(() => queries.some((query) => query.includes('kind=contract') && !query.includes('id=')))
    .toBe(true);
});
test('failed page retries without exposing an empty-source action or enabling upload', async ({
  page,
}) => {
  await fixture(page, 'failure');
  await page.goto('/evidence/contribute');
  await expect(page.getByRole('alert')).toContainText('Records could not be loaded');
  await expect(page.getByTestId('supply-path-choice')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Attach evidence', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry records', exact: true }).click();
  await expect(page.getByLabel('Evidence record', { exact: true })).toBeEnabled();
  await page.getByLabel('Evidence record', { exact: true }).selectOption(first);
  await expect(page.getByTestId('evidence-context')).toContainText('First permitted record');
});
test('failed deep-link lookup can be retried and missing links never invent a supporting record', async ({
  page,
}) => {
  await fixture(page, 'lookup-retry');
  await page.goto(`/evidence/contribute?entityType=farm&entityId=${linked}`);
  await expect(page.getByRole('alert')).toContainText('requested record could not be loaded');
  await page.getByRole('button', { name: 'Retry requested record', exact: true }).click();
  await expect(page.getByLabel('Evidence record', { exact: true })).toHaveValue(linked);
  await fixture(page, 'missing');
  await page.goto(`/evidence/contribute?entityType=farm&entityId=${linked}`);
  await expect(page.getByRole('alert')).toContainText(
    'not available in your permitted selection scope',
  );
  await expect(page.getByTestId('evidence-context')).toHaveCount(0);
});
test('malformed options remain a retryable read failure', async ({ page }) => {
  await fixture(page, 'malformed');
  await page.goto('/evidence/contribute');
  await expect(page.getByRole('alert')).toContainText('Invalid page response');
  await expect(page.getByTestId('supply-path-choice')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Attach evidence', exact: true })).toHaveCount(0);
});
