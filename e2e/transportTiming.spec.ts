import { test, expect } from '@playwright/test';
const id = '11111111-1111-4111-8111-111111111111';
test('reviewed arrival timing retains explanation after conflict and saves a revised estimate', async ({
  page,
}) => {
  const identity = {
    id: 'actor',
    organization_id: 'buyer',
    org_type: 'importer',
    permissions: ['contract.read', 'shipment.read', 'shipment.update'],
    roles: ['buyer_admin'],
    name: 'Buyer',
  };
  await page.addInitScript(
    (user) =>
      localStorage.setItem(
        'ct_user',
        JSON.stringify({ ...user, organizationId: user.organization_id, orgType: user.org_type }),
      ),
    identity,
  );
  let writes = 0;
  let eta = '2020-01-01';
  let revision = 0;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/me') return route.fulfill({ json: identity });
    if (path === '/api/health/live')
      return route.fulfill({ json: { status: 'ok', environment: 'test' } });
    if (path === '/api/onboarding')
      return route.fulfill({ json: { status: 'completed', primary_goal: 'buy' } });
    if (path === `/api/shipments/${id}/timing`) {
      if (route.request().method() === 'POST') {
        writes++;
        if (writes === 1)
          return route.fulfill({
            status: 409,
            json: { error: 'Timing changed. Review the current timing before saving.' },
          });
        eta = route.request().postDataJSON().etaArrival;
        revision++;
      }
      return route.fulfill({
        json: {
          shipmentId: id,
          revision,
          etaArrival: eta,
          overdue: revision === 0,
          canEdit: true,
          history: revision
            ? [
                {
                  revision,
                  etaArrival: eta,
                  reason: 'Port congestion investigated',
                  recordedAt: '2026-10-16T00:00:00Z',
                },
              ]
            : [],
          historyHasMore: false,
        },
      });
    }
    if (path === `/api/contracts/${id}`)
      return route.fulfill({
        json: {
          id,
          seller_organization_id: 'seller',
          buyer_organization_id: 'buyer',
          seller_name: 'Supplier',
          buyer_name: 'Buyer',
          quantity_kg: 100,
          price_per_kg: 5,
          currency: 'EUR',
          currency_minor_units: 2,
          incoterm: 'FOB',
          status: 'in_transit',
          payment_terms_status: 'agreed',
          shipment_id: id,
          shipment: { id, current_milestone: 'departed' },
          documents: [],
        },
      });
    if (path === `/api/shipments/${id}`)
      return route.fulfill({
        json: {
          shipment: {
            id,
            payment_plan: 'pay_before_dispatch',
            payment_terms_status: 'agreed',
            transport_mode: 'sea',
            security_status: 'not_required',
            amount_confirmed: '0',
            dispatch_required_amount: '500',
            contract_id: id,
            current_milestone: 'departed',
            transport_coordinator_organization_id: 'buyer',
            incoterm: 'FOB',
            seller_organization_id: 'seller',
            buyer_organization_id: 'buyer',
          },
          milestones: [],
          permissions: { canArrange: true, supported: true, milestones: [], responsibilities: {} },
        },
      });
    return route.fulfill({ status: 503, json: { error: 'Supporting data unavailable' } });
  });
  await page.goto(`/shipments/${id}`);
  const panel = page.getByRole('region', { name: 'Transport timing', exact: true });
  await panel.getByRole('button', { name: 'Review transport timing' }).click();
  await expect(panel).toContainText('Arrival overdue');
  await panel.getByLabel('Arrival estimate (UTC date)', { exact: true }).fill('2030-01-01');
  await panel
    .getByLabel('Timing change or delay reason', { exact: true })
    .fill('Port congestion investigated');
  await panel.getByRole('button', { name: 'Save reviewed timing', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('Timing changed');
  await expect(panel.getByLabel('Timing change or delay reason', { exact: true })).toHaveValue(
    'Port congestion investigated',
  );
  await panel.getByRole('button', { name: 'Save reviewed timing', exact: true }).click();
  await expect(panel).toContainText('Revision 1: 2030-01-01');
});
