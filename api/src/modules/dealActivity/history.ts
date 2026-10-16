import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { NotFoundError, ValidationError } from '../../errors';
import { type Execute, withCatalogRead } from '../catalog/paging';

// Customer history is an explicit product projection, never an audit-log endpoint.
export const activityLabels: Record<string, string> = {
  'payment.terms.propose': 'Payment terms proposed',
  'payment.terms.confirm': 'Payment terms confirmed',
  'payment.submit': 'Payment submitted',
  'payment.receipt.verify': 'Payment receipt verified',
  'payment.receipt.reject': 'Payment receipt rejected',
  'payment.documents.present': 'Payment documents presented',
  'payment.security.submit': 'Payment security submitted',
  'payment.security.verify': 'Payment security verified',
  'transport.arrangement.update': 'Transport arrangement updated',
  'transport.milestone.booked': 'Transport booked',
  'transport.milestone.cargo_ready': 'Cargo ready',
  'transport.milestone.picked_up': 'Cargo picked up',
  'transport.milestone.handed_over': 'Cargo handed over',
  'transport.milestone.port_received': 'Cargo received at port',
  'transport.milestone.loaded': 'Cargo loaded',
  'transport.milestone.departed': 'Departed origin',
  'transport.milestone.arrived': 'Arrived at destination',
  'transport.milestone.customs_cleared': 'Customs cleared',
  'transport.milestone.delivered': 'Delivery reported',
  'delivery.accept': 'Delivery accepted',
  'delivery.discrepancy.report': 'Delivery discrepancy reported',
  'delivery.resolution.propose': 'Delivery resolution proposed',
  'delivery.resolution.approve': 'Delivery resolution approved',
  'contract.cancellation.request': 'Cancellation requested',
  'contract.cancellation.approved': 'Cancellation approved',
  'contract.cancellation.rejected': 'Cancellation rejected',
};
export function activityInput(
  parameters: Record<string, unknown>,
  organizationId: string,
  contractId: string,
) {
  if (Object.keys(parameters).some((key) => !['limit', 'cursor'].includes(key)))
    throw new ValidationError('Unknown activity parameter');
  const limit = parameters.limit ?? '25';
  if (typeof limit !== 'string' || !/^[1-9]\d?$/.test(limit) || Number(limit) > 50)
    throw new ValidationError('Activity limit must be between 1 and 50');
  const scope = createHash('sha256')
    .update(JSON.stringify([organizationId, contractId]))
    .digest('hex');
  let cursor: { id: string; at: string } | null = null;
  if (parameters.cursor !== undefined) {
    try {
      const value = parameters.cursor;
      if (typeof value !== 'string' || value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value))
        throw new Error();
      const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
      if (
        Object.keys(decoded).length !== 3 ||
        decoded.scope !== scope ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decoded.id) ||
        typeof decoded.at !== 'string' ||
        !/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d(?::\d\d)?)$/.test(
          decoded.at,
        ) ||
        !Number.isFinite(Date.parse(decoded.at))
      )
        throw new Error();
      cursor = { id: decoded.id, at: decoded.at };
    } catch {
      throw new ValidationError('Invalid activity cursor; restart the history');
    }
  }
  return { limit: Number(limit), scope, cursor };
}
export async function dealActivity(
  execute: Execute,
  organizationId: string,
  contractId: string,
  parameters: Record<string, unknown>,
) {
  const input = activityInput(parameters, organizationId, contractId);
  const authorized = await execute(
    `SELECT id FROM sales_contracts WHERE id=$1 AND $2::uuid IN (buyer_organization_id,seller_organization_id)`,
    [contractId, organizationId],
  );
  if (!authorized.rows.length) throw new NotFoundError('Deal');
  const result = await execute(
    `SELECT a.id,a.action,a.occurred_at::text AS at,
    CASE WHEN a.actor_organization_id=c.seller_organization_id THEN 'seller'
      WHEN a.actor_organization_id=c.buyer_organization_id THEN 'buyer' ELSE 'system' END AS party
    FROM audit_events a JOIN sales_contracts c ON c.id=$1
    WHERE $2::uuid IN (c.buyer_organization_id,c.seller_organization_id)
    AND a.action=ANY($3::text[])
    AND ((a.entity_type='sales_contract' AND a.entity_id=c.id)
      OR (a.entity_type='shipment' AND a.entity_id IN (SELECT id FROM shipments WHERE contract_id=c.id))
      OR (a.entity_type='payment_request' AND a.entity_id IN (SELECT id FROM payment_requests WHERE contract_id=c.id))
      OR (a.entity_type='payment_installment' AND a.entity_id IN (SELECT i.id FROM payment_installments i JOIN payment_requests p ON p.id=i.payment_request_id WHERE p.contract_id=c.id)))
    AND ($4::timestamptz IS NULL OR (a.occurred_at,a.id)<($4::timestamptz,$5::uuid))
    ORDER BY a.occurred_at DESC,a.id DESC LIMIT $6`,
    [
      contractId,
      organizationId,
      Object.keys(activityLabels),
      input.cursor?.at ?? null,
      input.cursor?.id ?? null,
      input.limit + 1,
    ],
  );
  const selected = result.rows.slice(0, input.limit);
  const hasMore = result.rows.length > input.limit;
  const last = selected[selected.length - 1];
  return {
    items: selected.map((row) => ({
      id: row.id,
      label: activityLabels[String(row.action)],
      occurredAt: row.at,
      party: row.party,
    })),
    hasMore,
    nextCursor: hasMore
      ? Buffer.from(JSON.stringify({ scope: input.scope, id: last.id, at: last.at })).toString(
          'base64url',
        )
      : null,
  };
}
export async function listDealActivity(req: Request, res: Response) {
  res.set('Cache-Control', 'no-store');
  res.json(
    await withCatalogRead((execute) =>
      dealActivity(execute, req.user!.organizationId, req.params.id, req.query),
    ),
  );
}
