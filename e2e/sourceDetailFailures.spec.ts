import { test, expect, type Page } from '@playwright/test';

async function workspace(page: Page) {
  const user = {
    id: 'detail-user',
    organizationId: 'detail-org',
    orgType: 'exporter',
    roles: [],
    permissions: ['*'],
    name: 'Detail user',
  };
  await page.addInitScript((user) => localStorage.setItem('ct_user', JSON.stringify(user)), user);
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      json:
        path === '/api/me'
          ? { ...user, organization_id: user.organizationId, org_type: user.orgType }
          : path === '/api/onboarding'
            ? { status: 'completed', primary_goal: 'sell' }
            : path.endsWith('/summary')
              ? { count: 0, total: 0 }
              : path.endsWith('/page')
                ? { items: [], hasMore: false, nextCursor: null }
                : [],
    });
  });
}

for (const kind of ['farm', 'holding', 'batch'] as const) {
  test(`${kind} detail rejects malformed records and retries without stale failure`, async ({
    page,
  }) => {
    await workspace(page);
    const plural = kind === 'batch' ? 'batches' : `${kind}s`;
    let malformed = true;
    await page.route(new RegExp(`/api/${plural}/${kind}-review(?:\\?.*)?$`), (route) =>
      route.fulfill({
        json: malformed
          ? {}
          : {
              [kind]: {
                id: `${kind}-review`,
                name: 'Reviewed farm',
                farmer_organization_id: 'detail-org',
                current_holder_id: 'detail-org',
                crop: 'peanut',
                quantity_kg: 10,
                status: 'available',
                organic_claim_status: 'none',
                harvest_date: '2026-01-01',
              },
            },
      }),
    );
    await page.route('**/api/product-profiles/batch/**', (route) =>
      route.fulfill({ status: 404, json: { error: 'Not found' } }),
    );
    await page.goto(`/${plural}/${kind}-review`);
    await expect(page.getByRole('alert')).toContainText(`Invalid ${kind} response.`);
    malformed = false;
    await page.getByRole('button', { name: `Retry ${kind}`, exact: true }).click();
    await expect(
      page.getByRole('heading', {
        name:
          kind === 'farm'
            ? 'Reviewed farm'
            : new RegExp(`${kind === 'batch' ? 'Batch' : 'Holding'} ${kind}`),
      }),
    ).toBeVisible();
    await expect(page.getByText(`Invalid ${kind} response.`, { exact: true })).toHaveCount(0);
  });
}

test('failed batch product identity stays unknown and cannot invite duplicate creation', async ({
  page,
}) => {
  await workspace(page);
  await page.route(/\/api\/batches\/batch-review(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: {
        batch: {
          id: 'batch-review',
          current_holder_id: 'detail-org',
          crop: 'peanut',
          quantity_kg: 10,
          organic_claim_status: 'none',
          harvest_date: '2026-01-01',
        },
      },
    }),
  );
  let unavailable = true;
  await page.route('**/api/product-profiles/batch/batch-review', (route) =>
    route.fulfill(
      unavailable
        ? { status: 503, json: { error: 'Product identity timed out' } }
        : { status: 404, json: { error: 'Not found' } },
    ),
  );
  await page.goto('/batches/batch-review');
  await expect(
    page.getByRole('alert').filter({ hasText: 'Product identity unavailable' }),
  ).toContainText('Product identity timed out');
  await expect(page.getByRole('button', { name: 'Create product page', exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByText('No public product page has been published for this batch.', { exact: true }),
  ).toHaveCount(0);
  unavailable = false;
  await page.getByRole('button', { name: 'Retry product identity', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Create product page', exact: true }),
  ).toBeVisible();
});

test('confirmed publication with failed refresh shows unknown identity without replaying the write', async ({
  page,
}) => {
  await workspace(page);
  await page.route(/\/api\/batches\/batch-review(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: {
        batch: {
          id: 'batch-review',
          current_holder_id: 'detail-org',
          crop: 'peanut',
          quantity_kg: 10,
          organic_claim_status: 'none',
          harvest_date: '2026-01-01',
        },
      },
    }),
  );
  let published = false;
  let writes = 0;
  await page.route('**/api/product-profiles/batch/batch-review', (route) =>
    route.fulfill(
      published
        ? { status: 503, json: { error: 'Read temporarily unavailable' } }
        : {
            json: {
              id: 'profile-review',
              batch_id: 'batch-review',
              slug: 'review-product',
              display_name: 'Review product',
              lot_code: 'REVIEW',
              visibility: 'draft',
            },
          },
    ),
  );
  await page.route('**/api/product-profiles/profile-review/publish', (route) => {
    writes += 1;
    published = true;
    return route.fulfill({ json: { id: 'profile-review' } });
  });
  await page.goto('/batches/batch-review');
  await page.getByRole('button', { name: 'Publish & activate QR', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Review public product publication', exact: true })
    .getByRole('button', { name: 'Confirm public publication', exact: true })
    .click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Product identity unavailable' }),
  ).toBeVisible();
  await expect(
    page.getByRole('dialog', { name: 'Review public product publication', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Publish & activate QR', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry product identity', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Product identity unavailable' }),
  ).toBeVisible();
  expect(writes).toBe(1);
});
