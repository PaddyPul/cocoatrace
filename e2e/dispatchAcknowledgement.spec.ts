import { test, expect } from '@playwright/test';
const id = '11111111-1111-4111-8111-111111111111';
test('buyer reviews exceptional dispatch reason and retries awareness without changing transport', async ({
  page,
}) => {
  const identity = {
    id: 'buyer-user',
    organization_id: 'buyer',
    org_type: 'importer',
    permissions: ['shipment.read', 'shipment.update'],
    roles: ['buyer_operator'],
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
  let acknowledgedAt: string | null = null;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/me') return route.fulfill({ json: identity });
    if (path === '/api/health/live')
      return route.fulfill({ json: { status: 'ok', environment: 'test' } });
    if (path === '/api/onboarding')
      return route.fulfill({ json: { status: 'completed', primary_goal: 'buy' } });
    if (path === `/api/shipments/${id}/dispatch-acknowledgement`) {
      if (route.request().method() === 'POST') {
        writes++;
        expect(route.request().postDataJSON()).toEqual({
          exceptionHash: 'a'.repeat(64),
          confirmed: true,
        });
        if (writes === 1)
          return route.fulfill({
            status: 503,
            json: { error: 'Acknowledgement temporarily unavailable' },
          });
        acknowledgedAt = '2026-10-16T12:00:00Z';
      }
      return route.fulfill({
        json: {
          schemaVersion: 1,
          exception: {
            active: true,
            hash: 'a'.repeat(64),
            reason: 'Payment not confirmed at dispatch',
            recordedAt: '2026-10-16T11:00:00Z',
          },
          acknowledgedAt,
          yourRole: 'buyer',
          canAcknowledge: true,
        },
      });
    }
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
            buyer_organization_id: 'buyer',
            seller_organization_id: 'seller',
            current_milestone: 'loaded',
            origin_port: 'Tema',
            destination_port: 'Rotterdam',
            dispatch_exception: true,
          },
          milestones: [],
          permissions: { canArrange: false, supported: true, milestones: [], responsibilities: {} },
        },
      });
    return route.fulfill({ status: 503, json: { error: 'Supporting data unavailable' } });
  });
  await page.goto(`/shipments/${id}`);
  const panel = page.getByRole('region', {
    name: 'Exceptional dispatch acknowledgement',
    exact: true,
  });
  await panel.getByRole('button', { name: 'Review dispatch exception', exact: true }).click();
  await expect(panel).toContainText('Payment not confirmed at dispatch');
  await expect(panel).toContainText('does not waive rights');
  const save = panel.getByRole('button', {
    name: 'Acknowledge exceptional dispatch awareness',
    exact: true,
  });
  await expect(save).toBeDisabled();
  await panel.getByRole('checkbox').check();
  await save.click();
  await expect(panel.getByRole('alert')).toContainText('temporarily unavailable');
  await expect(panel.getByRole('checkbox')).toBeChecked();
  await save.click();
  await expect(panel).toContainText('Buyer acknowledged');
  expect(writes).toBe(2);
});
