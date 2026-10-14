import { AppError } from '../../errors';
import type { Execute } from '../catalog/paging';
import { transportPermissions } from './responsibilities';

export async function privateShipmentDetail(execute: Execute, id: string, organizationId: string) {
  const shipRes = await execute(
    `SELECT sh.*,c.seller_organization_id,c.buyer_organization_id,c.incoterm,c.payment_plan,c.payment_terms_status,c.deposit_percentage,
            p.id payment_request_id,p.status payment_status,p.amount_total,p.amount_confirmed,p.dispatch_required_amount,p.security_status,p.release_status,
            seller.name as seller_name, buyer.name as buyer_name,
            coordinator.name as transport_coordinator_name
     FROM shipments sh
     JOIN sales_contracts c ON c.id=sh.contract_id
     JOIN organizations seller ON seller.id=c.seller_organization_id
     JOIN organizations buyer ON buyer.id=c.buyer_organization_id
     LEFT JOIN organizations coordinator ON coordinator.id=sh.transport_coordinator_organization_id
     LEFT JOIN LATERAL(SELECT * FROM payment_requests WHERE contract_id=c.id ORDER BY created_at DESC LIMIT 1)p ON TRUE
     WHERE sh.id=$1 AND (c.seller_organization_id=$2 OR c.buyer_organization_id=$2)`,
    [id, organizationId],
  );
  const shipment = shipRes.rows[0];
  if (!shipment) return null;
  const milestoneRes = await execute(
    `SELECT sm.*, u.name as recorded_by_name, o.name as recorded_by_organization_name
       FROM shipment_milestones sm
       JOIN users u ON u.id=sm.recorded_by_user_id
       JOIN organizations o ON o.id=u.organization_id
      WHERE sm.shipment_id=$1 ORDER BY sm.recorded_at ASC, sm.id ASC LIMIT 1001`,
    [id],
  );
  if (milestoneRes.rows.length > 1000)
    throw new AppError(
      'Shipment history exceeds the complete read limit. Contact the platform operator.',
      422,
      'CATALOG_READ_LIMIT',
    );
  return {
    shipment,
    milestones: milestoneRes.rows,
    permissions: transportPermissions(
      shipment as unknown as Parameters<typeof transportPermissions>[0],
      organizationId,
    ),
  };
}
