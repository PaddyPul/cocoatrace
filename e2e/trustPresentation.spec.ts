import { test, expect, Page } from '@playwright/test';

const declared = { status: 'self_declared', claimSource: 'Supplier source record', sourceReference: 'source-one' };
const reviewed = { status: 'reviewed', claimSource: 'Organic certificate', sourceReference: 'CERT-123', reviewerName: 'Review Organization', reviewMethod: 'Certificate scope review', reviewedAt: '2026-01-01', expiresAt: '2099-01-01' };
const listing = { id: 'lot', batch_id: 'batch', seller_name: 'Supplier One', crop: 'peanut', organic_claim_status: 'attested', available_quantity_kg: 10, price_per_kg: 10, incoterm: 'FOB', trust: { organic: declared, origin: declared, eudr: { status: 'not_claimed' } } };

async function mock(page: Page, publicProduct?: () => object) {
  await page.addInitScript(() => localStorage.setItem('ct_user', JSON.stringify({ id: 'buyer', organizationId: 'buyer-org', roles: ['buyer_admin'], permissions: ['*'], name: 'Buyer' })));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const body = path === '/api/me' ? { id: 'buyer', organization_id: 'buyer-org', name: 'Buyer', roles: ['buyer_admin'], permissions: ['*'] }
      : path === '/api/onboarding' ? { status: 'completed' }
      : path === '/api/listings/page' ? {items: url.searchParams.get('organic') === 'true' && listing.trust?.organic?.status !== 'reviewed' ? [] : [listing],nextCursor:null,hasMore:false}
      : path === '/api/listings/lot' ? listing
      : path.endsWith('/notices/page') ? {items:[],count:0,nextCursor:null,hasMore:false,safety:{status:'clear',inventoryHeld:false,activeCount:0,resolvedCount:0,criticalCount:0,warningCount:0,advisoryCount:0,checkedAt:'2026-01-01'}}
      : path.endsWith('/journey/page') ? {items:[],count:0,nextCursor:null,hasMore:false}
      : path.endsWith('/evidence/page') ? {items:[],count:0,nextCursor:null,hasMore:false}
      : path.startsWith('/api/public/products/') ? publicProduct?.() || {}
      : [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

test('legacy attested field never turns a supplier declaration into reviewed marketplace supply', async ({ page }) => {
  await mock(page);
  await page.goto('/marketplace');
  await expect(page.getByRole('heading', { name: 'peanut inventory' })).toBeVisible();
  await expect(page.getByText('Supplier declared · not reviewed', { exact: true })).toHaveCount(2);
  await page.getByLabel('Organic reviewed only').check();
  await expect(page.getByText('No supply matches these filters.')).toBeVisible();
});

test('listing details do not invent requirement matches or origin and expose claim sources', async ({ page }) => {
  await mock(page);
  await page.goto('/listing/lot');
  await expect(page.getByText(/% requirement match/)).toHaveCount(0);
  await expect(page.getByText(/Origin not recorded/).first()).toBeVisible();
  await expect(page.getByText('Rotterdam', { exact: true })).toHaveCount(0);
  await page.getByText('Organic · Supplier declared · not reviewed', { exact: true }).click();
  await expect(page.getByText('source-one', { exact: true }).first()).toBeVisible();
});

test('public review shows its attribution and loses reviewed status after revocation refresh', async ({ page }) => {
  let organic = reviewed;
  const product = () => ({ profile: { displayName: 'Peanut lot', slug: 'peanut', description: 'Recorded product', lotCode: 'ONE' }, product: { organicClaimStatus: 'attested', harvestDate: '2026-01-01' }, origin: { farmName: 'Farm One', region: 'Northern', country: 'Ghana', plot_count: 1, total_area_hectares: 1 }, trust: { organic, origin: declared, eudr: { status: 'unknown' } }, evidence: [], journey: [], safety: { status: 'clear', activeRecalls: [], checkedAt: '2026-01-01' } });
  await mock(page, product);
  await page.goto('/p/peanut');
  await expect(page.getByText('No active recalls recorded', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'proof', exact: true }).click();
  await page.getByText('Organic · Reviewed', { exact: true }).click();
  await expect(page.getByText('Review Organization', { exact: true })).toBeVisible();
  await expect(page.getByText('Certificate scope review', { exact: true })).toBeVisible();
  organic = { ...reviewed, status: 'revoked' };
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('Organic · Revoked · not verified', { exact: true })).toBeVisible();
  await expect(page.getByText('Organic · Reviewed', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Origin verified', { exact: true })).toHaveCount(0);
});

 test('conventional inventory never invents a farm or harvest in its listing journey', async ({ page }) => {
  await mock(page);
  await page.route('**/api/listings/lot', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...listing, source_mode: 'direct_inventory', source_name: 'Warehouse stock', source_country: 'Ghana', source_region: 'Northern', farm_name: 'Stale farm name' }) }));
  await page.goto('/listing/lot');
  await expect(page.getByRole('heading', { name: 'peanut inventory' })).toBeVisible();
  await expect(page.getByText('Declared inventory source', { exact: true })).toBeVisible();
  await expect(page.getByText('Inventory lot', { exact: true })).toBeVisible();
  await expect(page.getByText('Linked farm record', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Farm & plots', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Harvest lot', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Stale farm name', { exact: true })).toHaveCount(0);
 });
