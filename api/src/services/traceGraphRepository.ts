import { query } from '../db';
import { TraceGraph } from './recallTrace';
import { activeBatchRecallSql } from '../modules/recall/safety';

type TraceQuery = (sql: string, params?: any[]) => Promise<{ rows: any[] }>;

export async function loadTraceGraph(runQuery: TraceQuery = query): Promise<TraceGraph> {
  const [lotsResult, edgesResult, distributionsResult] = await Promise.all([
    runQuery(
      `SELECT ml.id, ml.lot_code, ml.lot_type, ml.product_name, ml.quantity_kg,
              ml.batch_id, ml.owner_organization_id, CASE WHEN ${activeBatchRecallSql('ml.batch_id')} OR EXISTS (
                SELECT 1 FROM recall_safety_holds safety JOIN recall_notices recall ON recall.id=safety.recall_id
                WHERE safety.entity_type='lot' AND safety.entity_id=ml.id AND recall.status='active'
              ) THEN 'held' ELSE ml.status END AS status, ml.produced_at,
              o.name AS owner_name, b.source_mode,
              COALESCE(f.name, b.source_name, b.source_region, b.source_country) AS source_label,
              (SELECT COUNT(*)::int FROM lot_genealogy_edges ge WHERE ge.source_lot_id=ml.id) AS downstream_lot_count,
              (SELECT COUNT(*)::int FROM lot_distributions ld WHERE ld.lot_id=ml.id) AS distribution_count
       FROM material_lots ml
       JOIN organizations o ON o.id = ml.owner_organization_id
       LEFT JOIN harvest_batches b ON b.id=ml.batch_id
       LEFT JOIN farms f ON f.id=b.farm_id
       ORDER BY ml.produced_at, ml.lot_code`
    ),
    runQuery(
      `SELECT ge.id, ge.source_lot_id, ge.destination_lot_id,
              ge.allocated_input_kg, ge.allocation_method,
              te.event_code, te.event_type, te.occurred_at
       FROM lot_genealogy_edges ge
       JOIN transformation_events te ON te.id = ge.transformation_event_id
       ORDER BY te.occurred_at, ge.id`
    ),
    runQuery(
      `SELECT ld.id, ld.lot_id, ld.recipient_organization_id,
              o.name AS recipient_name, ld.quantity_kg,
              ld.distribution_reference, ld.shipment_id, ld.dispatched_at
       FROM lot_distributions ld
       JOIN organizations o ON o.id = ld.recipient_organization_id
       ORDER BY ld.dispatched_at, ld.id`
    ),
  ]);

  return {
    lots: lotsResult.rows.map((row: any) => ({
      id: row.id,
      lotCode: row.lot_code,
      lotType: row.lot_type,
      productName: row.product_name,
      quantityKg: Number(row.quantity_kg),
      batchId: row.batch_id,
      ownerName: row.owner_name,
      ownerOrganizationId: row.owner_organization_id,
      status: row.status,
      producedAt: row.produced_at,
      sourceMode: row.source_mode,
      sourceLabel: row.source_label,
      downstreamLotCount: Number(row.downstream_lot_count || 0),
      distributionCount: Number(row.distribution_count || 0),
    })),
    edges: edgesResult.rows.map((row: any) => ({
      id: row.id,
      sourceLotId: row.source_lot_id,
      destinationLotId: row.destination_lot_id,
      allocatedInputKg: Number(row.allocated_input_kg),
      allocationMethod: row.allocation_method,
      eventCode: row.event_code,
      eventType: row.event_type,
      occurredAt: row.occurred_at,
    })),
    distributions: distributionsResult.rows.map((row: any) => ({
      id: row.id,
      lotId: row.lot_id,
      recipientOrganizationId: row.recipient_organization_id,
      recipientName: row.recipient_name,
      quantityKg: Number(row.quantity_kg),
      distributionReference: row.distribution_reference,
      shipmentId: row.shipment_id,
      dispatchedAt: row.dispatched_at,
    })),
  };
}

export async function accessibleTraceLotIds(organizationId: string, seeAll = false, runQuery: TraceQuery = query): Promise<Set<string>> {
  if (seeAll) {
    const result = await runQuery('SELECT id FROM material_lots');
    return new Set(result.rows.map((row: any) => row.id));
  }
  const result = await runQuery(
    `SELECT DISTINCT ml.id
       FROM material_lots ml
       LEFT JOIN batch_holdings h ON h.batch_id=ml.batch_id
       LEFT JOIN sales_contracts c ON c.holding_id=h.id
       LEFT JOIN lot_distributions ld ON ld.lot_id=ml.id
      WHERE ml.owner_organization_id=$1
         OR h.holder_organization_id=$1
         OR c.seller_organization_id=$1
         OR c.buyer_organization_id=$1
         OR ld.recipient_organization_id=$1`,
    [organizationId]
  );
  return new Set(result.rows.map((row: any) => row.id));
}
