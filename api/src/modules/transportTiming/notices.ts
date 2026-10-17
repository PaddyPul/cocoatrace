import { AppError } from '../../errors';
import type { TradeAction } from '../tradeActions/types';
import type { Execute } from '../catalog/paging';
export async function loadTransportTimingNotices(
  actor: { organizationId: string; permissions: string[] },
  execute: Execute,
): Promise<TradeAction[]> {
  if (!actor.permissions.includes('*') && !actor.permissions.includes('shipment.read')) return [];
  const rows = (
    await execute(
      `SELECT sh.id,sh.contract_id,sh.timing_revision,sh.eta_arrival::text AS eta,c.seller_organization_id,c.buyer_organization_id,sh.transport_coordinator_organization_id FROM shipments sh JOIN sales_contracts c ON c.id=sh.contract_id WHERE (c.buyer_organization_id=$1 OR c.seller_organization_id=$1) AND c.status<>'cancelled' AND sh.current_milestone NOT IN ('arrived','customs_cleared','unloaded','delivered') AND sh.eta_arrival<(NOW() AT TIME ZONE 'UTC')::date ORDER BY sh.id LIMIT 1001`,
      [actor.organizationId],
    )
  ).rows;
  if (rows.length > 1000)
    throw new AppError(
      'Too many current transport notices. Contact the platform operator.',
      422,
      'TRANSPORT_NOTICE_LIMIT',
    );
  return rows.map((row) => ({
    id: `transport-eta:${row.id}:${row.timing_revision}:${row.eta}`,
    kind: 'transport',
    priority: 10,
    requiresAction:
      row.transport_coordinator_organization_id === actor.organizationId &&
      (actor.permissions.includes('*') || actor.permissions.includes('shipment.update')),
    title: 'Arrival overdue',
    description: `Expected arrival ${row.eta} passed at the end of that UTC calendar day; arrival has not been recorded.`,
    actionLabel: 'Review transport',
    actionPath: `/shipments/${row.id}`,
    contractId: String(row.contract_id),
  }));
}
