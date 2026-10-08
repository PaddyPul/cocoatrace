import { test, expect, type Page } from '@playwright/test';
async function mock(
  page: Page,
  options: { fail?: boolean; malformed?: boolean; read?: boolean } = {},
) {
  const permissions = [
    'farm.read',
    'batch.read',
    'batch.attest',
    ...(options.read === false ? [] : ['certificate.read']),
  ];
  await page.addInitScript(
    ({ permissions }) =>
      localStorage.setItem(
        'ct_user',
        JSON.stringify({
          id: 'detail-user',
          organizationId: 'detail-org',
          orgType: 'certifier',
          roles: [],
          permissions,
          name: 'Detail reader',
        }),
      ),
    { permissions },
  );
  const seen: string[] = [];
  let failed = false;
  let selected = '';
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname;
    if (path === '/api/me') {
      await route.fulfill({
        json: {
          id: 'detail-user',
          organization_id: 'detail-org',
          org_type: 'certifier',
          roles: [],
          permissions,
          name: 'Detail reader',
        },
      });
      return;
    }
    if (path === '/api/onboarding') {
      await route.fulfill({ json: { status: 'completed', primary_goal: 'contribute_proof' } });
      return;
    }
    if (path === '/api/farms/farm-one') {
      seen.push(url.search);
      await route.fulfill({
        json: {
          farm: {
            id: 'farm-one',
            name: 'Paged farm',
            region: 'Northern',
            district: 'Tamale',
            country: 'GH',
            farmer_organization_id: 'source-org',
            verification_status: 'self_declared',
          },
          plots: [],
          certificates: null,
          certificate_collection: 'paged',
        },
      });
      return;
    }
    if (path === '/api/batches/batch-one') {
      await route.fulfill({
        json: {
          batch: {
            id: 'batch-one',
            farm_id: 'farm-one',
            farm_name: 'Paged farm',
            crop: 'cocoa',
            quantity_kg: 10,
            harvest_date: '2026-01-01',
            organic_claim_status: 'pending_attestation',
            current_holder_id: 'source-org',
          },
          evidence: [],
        },
      });
      return;
    }
    if (path === '/api/batches/batch-one/attest') {
      selected = route.request().postDataJSON().certificateId;
      await route.fulfill({ json: { ok: true } });
      return;
    }
    if (path === '/api/certificates/summary') {
      seen.push(path + url.search);
      await route.fulfill({
        json: {
          count: 1005,
          active_count: 1005,
          suspended_count: 0,
          revoked_count: 0,
          expired_count: 0,
        },
      });
      return;
    }
    if (path === '/api/certificates/page') {
      seen.push(path + url.search);
      if (options.fail && !failed) {
        failed = true;
        await route.fulfill({ status: 503, json: { error: 'Certificate read failed' } });
        return;
      }
      if (options.malformed) {
        await route.fulfill({ json: { items: [], hasMore: true, nextCursor: null } });
        return;
      }
      const later = Boolean(
        url.searchParams.get('cursor') || url.searchParams.get('search') === 'LATE',
      );
      const certificate = {
        id: later ? 'late-certificate' : 'first-certificate',
        farm_id: 'farm-one',
        standard: later ? 'LATE STANDARD' : 'FIRST STANDARD',
        status: 'active',
        valid_from: '2026-01-01',
        valid_to: '2027-01-01',
      };
      await route.fulfill({
        json: {
          items: [certificate],
          hasMore: !later,
          nextCursor: later ? null : 'certificate-next',
        },
      });
      return;
    }
    await route.fulfill({ status: 503, json: { error: 'Unexpected detail fixture request' } });
  });
  return { seen, submitted: () => selected };
}
test('farm certificate panel uses scoped pages and full count without embedded arrays', async ({
  page,
}) => {
  const fixture = await mock(page);
  await page.goto('/farms/farm-one');
  const panel = page.getByRole('region', { name: 'Farm certificate records', exact: true });
  await expect(
    panel.getByText('Certificates — 1005 accessible records', { exact: true }),
  ).toBeVisible();
  await expect(panel.getByText('FIRST STANDARD', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Next farm certificates', exact: true }).click();
  await expect(panel.getByText('LATE STANDARD', { exact: true })).toBeVisible();
  await panel.getByLabel('Search farm certificates', { exact: true }).fill('LATE');
  await expect(panel.getByText('Page 1', { exact: true })).toBeVisible();
  expect(fixture.seen.some((value) => value.includes('certificateMode=paged'))).toBe(true);
  expect(
    fixture.seen.some((value) => value.includes('/certificates/summary?farmId=farm-one')),
  ).toBe(true);
  expect(fixture.seen.some((value) => value.includes('cursor=certificate-next'))).toBe(true);
});
test('failed farm certificate read retries without claiming there are no certificates', async ({
  page,
}) => {
  await mock(page, { fail: true });
  await page.goto('/farms/farm-one');
  const panel = page.getByRole('region', { name: 'Farm certificate records', exact: true });
  await expect(panel.getByRole('alert')).toContainText('Farm certificates unavailable');
  await expect(panel.getByText('No certificates match', { exact: false })).toHaveCount(0);
  await panel.getByRole('button', { name: 'Retry farm certificates', exact: true }).click();
  await expect(panel.getByText('FIRST STANDARD', { exact: true })).toBeVisible();
});
test('farm-only access never requests certificate pages or totals', async ({ page }) => {
  const fixture = await mock(page, { read: false });
  await page.goto('/farms/farm-one');
  await expect(
    page.getByText('Certificate records are unavailable with your access.', { exact: true }),
  ).toBeVisible();
  expect(fixture.seen.some((value) => value.includes('/certificates/'))).toBe(false);
});
test('attestation selector retains an off-page choice across search and submits that certificate', async ({
  page,
}) => {
  const fixture = await mock(page);
  await page.goto('/batches/batch-one');
  await page.getByRole('button', { name: 'Attest Batch', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Attestation certificate selector', exact: true });
  await panel.getByRole('button', { name: 'Next attestation certificates', exact: true }).click();
  await expect(panel.getByRole('option', { name: /LATE STANDARD/ })).toBeAttached();
  await panel
    .getByLabel('Select attestation certificate', { exact: true })
    .selectOption('late-certificate');
  await panel.getByLabel('Search attestation certificates', { exact: true }).fill('FIRST');
  await expect(panel.getByText('Page 1', { exact: true })).toBeVisible();
  await expect(panel.getByLabel('Select attestation certificate', { exact: true })).toHaveValue(
    'late-certificate',
  );
  await page.getByRole('button', { name: 'Confirm Attestation', exact: true }).click();
  await expect.poll(() => fixture.submitted()).toBe('late-certificate');
  expect(
    fixture.seen.some(
      (value) => value.includes('farmId=farm-one') && value.includes('status=active'),
    ),
  ).toBe(true);
});
test('malformed attestation choices are visible failures with selection disabled', async ({
  page,
}) => {
  await mock(page, { malformed: true });
  await page.goto('/batches/batch-one');
  await page.getByRole('button', { name: 'Attest Batch', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Attestation certificate selector', exact: true });
  await expect(panel.getByRole('alert')).toContainText('Invalid page response');
  await expect(panel.getByLabel('Select attestation certificate', { exact: true })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Confirm Attestation', exact: true }),
  ).toBeDisabled();
});
