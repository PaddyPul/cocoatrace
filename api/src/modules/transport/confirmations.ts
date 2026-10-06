import type { PoolClient } from 'pg';
import type { TransportFacts } from './responsibilities';

/** Read recorded actor attribution; a late status alone cannot prove another party's work. */
export async function loadOriginConfirmations(
  client: PoolClient,
  shipmentId: string,
  facts: TransportFacts,
) {
  const originMilestones =
    facts.incoterm === 'EXW'
      ? ['cargo_ready']
      : ['FOB', 'CFR', 'CIF'].includes(facts.incoterm || '')
        ? ['loaded']
        : ['handed_over', 'loaded', 'port_received'];
  const result = await client.query<{
    origin_confirmed: boolean;
    unloading_confirmed: boolean;
    import_confirmed: boolean;
  }>(
    `
    SELECT
      EXISTS(SELECT 1 FROM shipment_milestones m JOIN users u ON u.id=m.recorded_by_user_id
        WHERE m.shipment_id=$1 AND u.organization_id=$2 AND m.milestone=ANY($3::text[])) AS origin_confirmed,
      EXISTS(SELECT 1 FROM shipment_milestones m JOIN users u ON u.id=m.recorded_by_user_id
        WHERE m.shipment_id=$1 AND u.organization_id=$2 AND m.milestone='unloaded') AS unloading_confirmed,
      EXISTS(SELECT 1 FROM shipment_milestones m JOIN users u ON u.id=m.recorded_by_user_id
        WHERE m.shipment_id=$1 AND u.organization_id=$2 AND m.milestone='customs_cleared') AS import_confirmed`,
    [shipmentId, facts.seller_organization_id, originMilestones],
  );
  return result.rows[0];
}
