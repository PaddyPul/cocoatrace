import { expect, test } from '@playwright/test';
const id = '11111111-1111-4111-8111-111111111111';
test('saved sourcing deep link reviews and updates the same brief while preserving other specifications', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'ct_user',
      JSON.stringify({
        id: 'buyer',
        organizationId: 'buyer-org',
        orgType: 'importer',
        roles: ['buyer'],
        permissions: ['listing.read', 'offer.create'],
        name: 'Buyer',
      }),
    ),
  );
  let row = {
    id,
    buyer_organization_id: 'buyer-org',
    title: 'Saved peanut brief',
    commodity: 'peanut',
    quantity_kg: '10.000',
    incoterm: 'FOB',
    delivery_location: 'Tema',
    status: 'open',
    visibility: 'matched',
    origin_countries: ['GH'],
    quality_requirements: { moistureMax: 7, notes: 'Original note' },
    assurance_requirements: { independentLab: true, organic: false },
    required_by: null,
    offer_deadline: null,
  };
  const edits: Record<string, unknown>[] = [];
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === '/api/me')
      return route.fulfill({
        json: {
          id: 'buyer',
          organization_id: 'buyer-org',
          org_type: 'importer',
          roles: ['buyer'],
          permissions: ['listing.read', 'offer.create'],
          name: 'Buyer',
        },
      });
    if (path === '/api/onboarding')
      return route.fulfill({ json: { status: 'completed', primary_goal: 'buy' } });
    if (path === '/api/sourcing-requests/page')
      return route.fulfill({ json: { items: [row], hasMore: false, nextCursor: null } });
    if (path === `/api/sourcing-requests/${id}` && route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON();
      edits.push(body);
      row = {
        ...row,
        title: body.title,
        commodity: body.commodity,
        quantity_kg: String(body.quantityKg),
        quality_requirements: body.qualityRequirements,
        assurance_requirements: body.assuranceRequirements,
      };
      return route.fulfill({ json: row });
    }
    if (path === '/api/listings/page')
      return route.fulfill({ json: { items: [], hasMore: false, nextCursor: null } });
    if (path === '/api/listings/summary')
      return route.fulfill({ json: { count: 0, own_count: 0, quantity_kg: '0' } });
    return route.fulfill({ json: {} });
  });
  await page.goto(`/source/new?request=${id}`);
  await expect(
    page.getByRole('heading', { name: 'Edit saved sourcing brief', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Quantity (kg)', { exact: true })).toHaveValue('10.000');
  await page.getByLabel('Quantity (kg)', { exact: true }).fill('43');
  const quality = page.getByRole('textbox', { name: 'Quality requirements', exact: true });
  await expect(quality).toHaveValue('Original note');
  await page.getByText('Quality requirements', { exact: true }).click();
  await expect(quality).toBeFocused();
  await quality.fill('Reviewed note');
  await page.getByRole('button', { name: 'Save reviewed changes', exact: true }).click();
  await expect(page).toHaveURL(
    (url) => url.pathname === '/marketplace' && url.searchParams.get('request') === id,
  );
  expect(edits).toHaveLength(1);
  expect(edits[0]).toMatchObject({
    quantityKg: 43,
    qualityRequirements: { moistureMax: 7, notes: 'Reviewed note' },
    assuranceRequirements: { independentLab: true, organic: false },
  });
  await page.goto(`/source/new?request=${id}`);
  await expect(page.getByLabel('Quantity (kg)', { exact: true })).toHaveValue('43');
  await expect(page.getByLabel('Quality requirements', { exact: true })).toHaveValue(
    'Reviewed note',
  );
});
