import {
  TRACE_LIMITS,
  TraceBudget,
  TraceIncompleteError,
  checkTraceSize,
} from '../modules/trace/limits';
import { getClient, query } from '../db';
import { TraceGraph } from './recallTrace';
import { activeBatchRecallSql } from '../modules/recall/safety';

type TraceQuery = (sql: string, params?: any[]) => Promise<{ rows: any[] }>;

export async function withTraceRead<T>(read: (runQuery: TraceQuery) => Promise<T>): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query(`SET LOCAL statement_timeout = '${TRACE_LIMITS.statementMs}ms'`);
    const budget = new TraceBudget(TRACE_LIMITS.databaseMs);
    const result = await read(async (sql, params) => {
      budget.step();
      const rows = await client.query(sql, params);
      budget.step();
      return rows;
    });
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    if ((error as { code?: string }).code === '57014')
      throw new TraceIncompleteError('DATABASE_TIMEOUT');
    throw error;
  } finally {
    client.release();
  }
}

export async function loadTraceGraph(
  runQuery?: TraceQuery,
  rootLotIds?: string[],
): Promise<TraceGraph> {
  if (!runQuery) return withTraceRead((execute) => loadTraceGraph(execute, rootLotIds));
  await runQuery(`SET LOCAL statement_timeout = '${TRACE_LIMITS.statementMs}ms'`);
  const budget = new TraceBudget(TRACE_LIMITS.databaseMs);
  const execute: TraceQuery = async (sql, params) => {
    budget.step();
    try {
      const result = await runQuery(sql, params);
      budget.step();
      return result;
    } catch (error) {
      if ((error as { code?: string }).code === '57014')
        throw new TraceIncompleteError('DATABASE_TIMEOUT');
      throw error;
    }
  };
  let ids: string[] | undefined;
  if (rootLotIds) {
    checkTraceSize(rootLotIds.length, TRACE_LIMITS.seeds, 'SEEDS_LIMIT');
    const known = new Set(rootLotIds);
    const edgeIds = new Set<string>();
    let frontier = [...known];
    let depth = 0;
    while (frontier.length) {
      budget.step(1, depth++);
      const neighbors = await execute(
        `SELECT id,source_lot_id,destination_lot_id FROM lot_genealogy_edges
        WHERE source_lot_id=ANY($1::uuid[]) OR destination_lot_id=ANY($1::uuid[])
        ORDER BY id LIMIT $2`,
        [frontier, TRACE_LIMITS.edges + 1],
      );
      checkTraceSize(neighbors.rows.length, TRACE_LIMITS.edges, 'EDGES_LIMIT');
      const next: string[] = [];
      for (const row of neighbors.rows) {
        budget.step();
        edgeIds.add(row.id);
        checkTraceSize(edgeIds.size, TRACE_LIMITS.edges, 'EDGES_LIMIT');
        for (const id of [row.source_lot_id, row.destination_lot_id]) {
          if (!known.has(id)) {
            known.add(id);
            next.push(id);
          }
          checkTraceSize(known.size, TRACE_LIMITS.lots, 'LOTS_LIMIT');
        }
      }
      frontier = next;
    }
    ids = [...known];
  }
  const [lotsResult, edgesResult, distributionsResult] = await Promise.all([
    execute(
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
       WHERE ($1::uuid[] IS NULL OR ml.id=ANY($1::uuid[]))
       ORDER BY ml.produced_at, ml.lot_code LIMIT $2`,
      [ids || null, TRACE_LIMITS.lots + 1],
    ),
    execute(
      `SELECT ge.id, ge.source_lot_id, ge.destination_lot_id,
              ge.allocated_input_kg, ge.allocation_method,
              te.event_code, te.event_type, te.occurred_at
       FROM lot_genealogy_edges ge
       JOIN transformation_events te ON te.id = ge.transformation_event_id
       WHERE ($1::uuid[] IS NULL OR ge.source_lot_id=ANY($1::uuid[]) OR ge.destination_lot_id=ANY($1::uuid[]))
       ORDER BY te.occurred_at, ge.id LIMIT $2`,
      [ids || null, TRACE_LIMITS.edges + 1],
    ),
    execute(
      `SELECT ld.id, ld.lot_id, ld.recipient_organization_id,
              o.name AS recipient_name, ld.quantity_kg,
              ld.distribution_reference, ld.shipment_id, ld.dispatched_at
       FROM lot_distributions ld
       JOIN organizations o ON o.id = ld.recipient_organization_id
       WHERE ($1::uuid[] IS NULL OR ld.lot_id=ANY($1::uuid[]))
       ORDER BY ld.dispatched_at, ld.id LIMIT $2`,
      [ids || null, TRACE_LIMITS.distributions + 1],
    ),
  ]);

  checkTraceSize(lotsResult.rows.length, TRACE_LIMITS.lots, 'LOTS_LIMIT');
  checkTraceSize(edgesResult.rows.length, TRACE_LIMITS.edges, 'EDGES_LIMIT');
  checkTraceSize(
    distributionsResult.rows.length,
    TRACE_LIMITS.distributions,
    'DISTRIBUTIONS_LIMIT',
  );
  budget.step();
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

export async function accessibleTraceLotIds(
  organizationId: string,
  seeAll = false,
  runQuery: TraceQuery = query,
  requestedIds?: string[],
): Promise<Set<string>> {
  if (runQuery === query)
    return withTraceRead((execute) =>
      accessibleTraceLotIds(organizationId, seeAll, execute, requestedIds),
    );
  if (requestedIds) checkTraceSize(requestedIds.length, TRACE_LIMITS.seeds, 'SEEDS_LIMIT');
  if (seeAll) {
    const result = await runQuery(
      'SELECT id FROM material_lots WHERE ($1::uuid[] IS NULL OR id=ANY($1::uuid[])) ORDER BY id LIMIT $2',
      [requestedIds || null, TRACE_LIMITS.lots + 1],
    );
    checkTraceSize(result.rows.length, TRACE_LIMITS.lots, 'LOTS_LIMIT');
    return new Set(result.rows.map((row: any) => row.id));
  }
  const result = await runQuery(
    `SELECT DISTINCT ml.id
       FROM material_lots ml
       LEFT JOIN batch_holdings h ON h.batch_id=ml.batch_id
       LEFT JOIN sales_contracts c ON c.holding_id=h.id
       LEFT JOIN lot_distributions ld ON ld.lot_id=ml.id
      WHERE ($2::uuid[] IS NULL OR ml.id=ANY($2::uuid[])) AND (ml.owner_organization_id=$1
         OR h.holder_organization_id=$1
         OR c.seller_organization_id=$1
         OR c.buyer_organization_id=$1
         OR ld.recipient_organization_id=$1) ORDER BY ml.id LIMIT $3`,
    [organizationId, requestedIds || null, TRACE_LIMITS.lots + 1],
  );
  checkTraceSize(result.rows.length, TRACE_LIMITS.lots, 'LOTS_LIMIT');
  return new Set(result.rows.map((row: any) => row.id));
}
