import { query } from '../../db';
import {
  accessibleTraceLotIds,
  type TraceQuery,
  type TraceLotRow,
} from '../../services/traceGraphRepository';
import { activeBatchRecallSql } from '../recall/safety';
import { TRACE_LIMITS } from './limits';

export async function accessibleSeedIds(
  organizationId: string,
  seeAll: boolean,
  lotIds: string[],
): Promise<Set<string>> {
  return accessibleTraceLotIds(organizationId, seeAll, query, lotIds);
}
export async function readLotSummaries(
  execute: TraceQuery,
  lotIds: string[],
): Promise<TraceLotRow[]> {
  const result = await execute<TraceLotRow>(
    `SELECT ml.id,ml.lot_code,ml.lot_type,ml.product_name,ml.quantity_kg,
    ml.batch_id,CASE WHEN ${activeBatchRecallSql('ml.batch_id')} OR EXISTS (SELECT 1 FROM recall_safety_holds h JOIN recall_notices r ON r.id=h.recall_id WHERE h.entity_type='lot' AND h.entity_id=ml.id AND r.status='active') THEN 'held' ELSE ml.status END AS status,ml.produced_at,ml.owner_organization_id,o.name AS owner_name,
    b.source_mode,COALESCE(f.name,b.source_name,b.source_region,b.source_country) AS source_label,
    (SELECT COUNT(*)::int FROM lot_genealogy_edges e WHERE e.source_lot_id=ml.id) AS downstream_lot_count,
    (SELECT COUNT(*)::int FROM lot_distributions d WHERE d.lot_id=ml.id) AS distribution_count
    FROM material_lots ml JOIN organizations o ON o.id=ml.owner_organization_id
    LEFT JOIN harvest_batches b ON b.id=ml.batch_id LEFT JOIN farms f ON f.id=b.farm_id
    WHERE ml.id=ANY($1::uuid[]) ORDER BY ml.produced_at,ml.lot_code LIMIT $2`,
    [lotIds, TRACE_LIMITS.lots + 1],
  );
  return result.rows;
}
