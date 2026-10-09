import { test, expect, Page } from '@playwright/test';

const notice = { id: 'recall-response', reference_code: 'RECALL-1', title: 'Peanut recovery', reason: 'Quality issue', instructions: 'Hold stock and contact the supplier.', severity: 'warning', status: 'active', initiated_at: '2026-10-02', issued_by: 'Supplier', batch_ids: ['batch'] };
const response = (canManage = false) => ({ notice, canManage, myOrganizationId: 'buyer-org', participants: [{ organization_id: 'buyer-org', organization_name: 'Buyer organization', acknowledged_at: null, acknowledgement_note: null, contact_status: 'pending', email_statuses: ['submitted'], eligible_contact_count: 1 }], holdings: [{ id: 'holding-one', batch_id: 'batch', holder_organization_id: 'buyer-org', quantity_kg: 10 }], recoveries: [], evidence: [{ id: 'evidence-one', file_name: 'Recovery proof.pdf' }] });

async function mock(page: Page, manager = false, unavailableTrace = false) {
  const requests: Array<{ path: string; body: any }> = [];
  let acknowledged = false;
  await page.addInitScript(({ manager }) => localStorage.setItem('ct_user', JSON.stringify({ id: 'buyer', organizationId: 'buyer-org', roles: ['buyer_admin'], permissions: manager ? ['*'] : ['lot.read', 'evidence.read', 'evidence.upload'], name: 'Buyer' })), { manager });
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (unavailableTrace && path === '/api/traceability/lots/page') { await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Investigation access required' }) }); return; }
    if (['POST', 'PUT', 'PATCH'].includes(route.request().method())) {
      requests.push({ path, body: route.request().postDataJSON() });
      if (path.endsWith('/acknowledge')) acknowledged = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); return;
    }
    const view = response(manager);
    if (unavailableTrace) view.participants[0].eligible_contact_count = 0;
    if (acknowledged) view.participants[0].acknowledged_at = '2026-10-02' as any;
    const selectedHolding = new URL(route.request().url()).searchParams.get('selectedHoldingId') === view.holdings[0]?.id ? view.holdings[0] : null;
    const paging = Object.fromEntries(['participants','holdings','recoveries','evidence'].map(name => [name,{count:(view as any)[name].length,hasMore:false,nextCursor:null}]));
    const body = path === '/api/me' ? { id: 'buyer', organization_id: 'buyer-org', roles: ['buyer_admin'], permissions: manager ? ['*'] : ['lot.read', 'evidence.read', 'evidence.upload'], name: 'Buyer' }
      : path === '/api/onboarding' ? { status: 'completed' }
      : path === '/api/traceability/lots/page' ? { items: [], nextCursor: null, hasMore: false }
      : path === '/api/recalls/page' ? {items:[{...notice,batch_count:1,affected_lot_count:0}],hasMore:false,nextCursor:null}
      : path === '/api/recalls/summary' ? {count:1,active_count:1}
      : path.endsWith('/response') ? {...view,paging,selectedHolding} : [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return requests;
}

test('affected recipient sees and acknowledges recall without manager controls', async ({ page }) => {
  const requests = await mock(page);
  await page.goto('/recalls');
  await page.getByRole('button', { name: 'Open response', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Recall response and recovery' })).toBeVisible();
  await expect(page.getByText('Email delivery: submitted')).toBeVisible();
  await page.getByLabel('Acknowledgement note').fill('Stock isolated and instructions received.');
  await page.getByRole('button', { name: 'Acknowledge instructions' }).click();
  await expect(page.getByText('Acknowledged · Contact: pending')).toBeVisible();
  expect(requests[0]).toEqual({ path: '/api/recalls/recall-response/acknowledge', body: { note: 'Stock isolated and instructions received.' } });
  await expect(page.getByRole('button', { name: 'Resolve recall with evidence' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Record contact with/ })).toHaveCount(0);
});

test('recovery accounting rejects overflow and saves a full replacement snapshot', async ({ page }) => {
  const requests = await mock(page);
  await page.goto('/recalls');
  await page.getByRole('button', { name: 'Open response' }).click();
  await page.getByLabel('Your affected holding').selectOption('holding-one');
  await page.getByLabel('Quarantined (kg)', { exact: true }).fill('11');
  await page.getByRole('button', { name: 'Save recovery accounting' }).click();
  await expect(page.getByRole('alert')).toContainText('no more than the affected holding');
  expect(requests).toHaveLength(0);
  await page.getByLabel('Quarantined (kg)', { exact: true }).fill('0');
  await page.getByLabel('Returned (kg)', { exact: true }).fill('10');
  await page.getByLabel('Recovery note').fill('Entire stock returned under recall instructions.');
  await page.getByRole('button', { name: 'Save recovery accounting' }).click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0].body).toEqual({ quarantinedKg: 0, returnedKg: 10, destroyedKg: 0, correctedKg: 0, releasedKg: 0, note: 'Entire stock returned under recall instructions.' });
});

test('manager resolution requires an explanation and selected supporting evidence', async ({ page }) => {
  const requests = await mock(page, true);
  await page.goto('/recalls');
  await expect(page.getByRole('button', { name: 'Resolve', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open response' }).click();
  const resolve = page.getByRole('button', { name: 'Resolve recall with evidence' });
  await expect(resolve).toBeDisabled();
  await page.getByLabel('Resolution reason', { exact: true }).fill('All stock returned and the recovery has been verified.');
  await expect(resolve).toBeDisabled();
  await page.getByLabel('Use Recovery proof.pdf for resolution').check();
  await resolve.click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0]).toEqual({ path: '/api/recalls/recall-response/resolve', body: { reason: 'All stock returned and the recovery has been verified.', evidenceIds: ['evidence-one'] } });
});


test('resolved recall with retained inventory hold never presents a clear public safety badge', async ({ page }) => {
  await page.route('**/api/public/products/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    profile: { displayName: 'Recalled peanut lot', slug: 'held-peanut', description: 'Recorded product', lotCode: 'HELD-1' },
    product: { organicClaimStatus: 'none', harvestDate: '2026-10-02' }, origin: { farmName: null, region: 'Northern', country: 'Ghana', plot_count: 0, total_area_hectares: 0 },
    evidence: [], journey: [], safety: { status: 'clear', inventoryHeld: true, activeRecalls: [], resolvedRecalls: [], checkedAt: '2026-10-02' },
  }) }));
  await page.goto('/p/held-peanut');
  await expect(page.getByText('INVENTORY SAFETY HOLD', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Material remains on safety hold');
  await expect(page.getByText('No active recalls recorded', { exact: true })).toHaveCount(0);
});


test('unavailable genealogy does not hide recall responses or missing-contact escalation', async ({ page }) => {
  await mock(page, true, true);
  await page.goto('/recalls');
  await expect(page.getByText(/Genealogy records are unavailable:/)).toBeVisible();
  await page.getByRole('button', { name: 'Open response', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Recall response and recovery' })).toBeVisible();
  await expect(page.getByText(/No eligible contact account is available/)).toBeVisible();
});
