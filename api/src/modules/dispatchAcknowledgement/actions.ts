import { query } from '../../db';
import { AppError } from '../../errors';
import type { Execute } from '../catalog/paging';
import type { TradeAction } from '../tradeActions/types';
import { exceptionHash } from './policy';
export async function loadDispatchAcknowledgementActions(
  actor: { organizationId: string; permissions: string[] },
  execute: Execute = query,
): Promise<TradeAction[]> {
  if (!actor.permissions.includes('shipment.read') && !actor.permissions.includes('*')) return [];
  const result = await execute(
    `SELECT s.id,s.contract_id,s.dispatch_exception_reason,s.dispatch_exception_recorded_at,
    c.buyer_organization_id,c.seller_organization_id FROM shipments s JOIN sales_contracts c ON c.id=s.contract_id
    WHERE s.dispatch_exception AND c.status<>'cancelled' AND (c.buyer_organization_id=$1 OR c.seller_organization_id=$1)
    ORDER BY s.id LIMIT 1001`,
    [actor.organizationId],
  );
  if (result.rows.length > 1000)
    throw new AppError(
      'Dispatch notices exceed the complete current notice limit',
      422,
      'NOTIFICATION_SOURCE_LIMIT',
    );
  const candidates = result.rows.map((row) => ({
    row,
    hash: exceptionHash({
      id: String(row.id),
      contract_id: String(row.contract_id),
      dispatch_exception_reason: row.dispatch_exception_reason as string | null,
      dispatch_exception_recorded_at: row.dispatch_exception_recorded_at as Date | string | null,
    }),
  }));
  const receipts = candidates.length
    ? await execute(
        `SELECT a.shipment_id,a.exception_hash FROM dispatch_acknowledgements a
    JOIN unnest($1::uuid[],$2::text[],$3::uuid[]) AS current_exception(shipment_id,exception_hash,buyer_id)
    ON a.shipment_id=current_exception.shipment_id AND a.exception_hash=current_exception.exception_hash AND a.organization_id=current_exception.buyer_id`,
        [
          candidates.map((c) => c.row.id),
          candidates.map((c) => c.hash),
          candidates.map((c) => c.row.buyer_organization_id),
        ],
      )
    : { rows: [] };
  const acknowledged = new Set(
    receipts.rows.map((row) => `${row.shipment_id}:${row.exception_hash}`),
  );
  const output: TradeAction[] = [];
  for (const { row, hash } of candidates) {
    if (acknowledged.has(`${row.id}:${hash}`)) continue;
    const buyer = row.buyer_organization_id === actor.organizationId;
    const canAct =
      buyer && (actor.permissions.includes('shipment.update') || actor.permissions.includes('*'));
    output.push({
      id: `dispatch-exception:${row.id}:${hash}`,
      kind: canAct ? 'transport' : 'waiting',
      priority: 5,
      requiresAction: canAct,
      title: buyer
        ? 'Review exceptional dispatch'
        : 'Awaiting buyer awareness of exceptional dispatch',
      description:
        'A seller recorded exceptional dispatch. Buyer acknowledgement records awareness only; payment and settlement rules remain unchanged.',
      actionLabel: 'Review dispatch exception',
      actionPath: `/shipments/${row.id}`,
      contractId: String(row.contract_id),
      operation: 'view',
    });
  }
  return output;
}
