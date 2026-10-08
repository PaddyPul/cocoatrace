import { test, expect } from '@playwright/test';

test('incomplete trace explains the safety boundary without publishing a partial scope', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ct_user', JSON.stringify({ id: 'manager', organizationId: 'supplier', roles: ['supplier_admin'], permissions: ['*'], name: 'Manager' })));
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/trace-forward')) {
      await route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ code: 'TRACE_ANALYSIS_INCOMPLETE', error: 'Trace analysis incomplete (WORK_LIMIT). No safety clearance is established. Keep suspect material isolated and escalate to the recall manager; no partial recall was activated.', analysis: { status: 'incomplete', reason: 'WORK_LIMIT', safetyClearance: false } }) });
      return;
    }
    if (path === '/api/recalls/page') { await route.fulfill({json:{items:[],hasMore:false,nextCursor:null}}); return; }
    if (path === '/api/recalls/summary') { await route.fulfill({json:{count:0,active_count:0}}); return; }
    const body = path === '/api/me' ? { id: 'manager', organization_id: 'supplier', roles: ['supplier_admin'], permissions: ['*'], name: 'Manager' }
      : path === '/api/onboarding' ? { status: 'completed' }
      : path === '/api/traceability/lots/page' ? { items: [{ id: 'lot', lotCode: 'LOT-1', lotType: 'source', productName: 'Material', quantityKg: 10, downstreamLotCount: 1 }], nextCursor: null, hasMore: false } : [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/recalls');
  await page.getByRole('button', { name: 'Calculate', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No safety clearance is established');
  await expect(page.getByText('declared allocations', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Trace-forward recipients', { exact: true })).toHaveCount(0);
});
