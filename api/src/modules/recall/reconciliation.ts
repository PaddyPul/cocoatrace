import type { PoolClient } from 'pg';

export async function reconcileRecallSafety(client:PoolClient) {
  const issues = await client.query(`WITH active_batches AS (
      SELECT affected.recall_id,affected.batch_id FROM recall_affected_batches affected
      JOIN recall_notices recall ON recall.id=affected.recall_id WHERE recall.status='active'
    )
    SELECT 'ACTIVE_RECALL_LISTING_PUBLISHED' AS code,'listing' AS entity_type,listing.id AS entity_id
    FROM listings listing JOIN batch_holdings holding ON holding.id=listing.holding_id
    WHERE listing.active AND EXISTS(SELECT 1 FROM active_batches affected WHERE affected.batch_id=holding.batch_id)
    UNION ALL
    SELECT 'ACTIVE_RECALL_HOLD_MISSING','holding',holding.id FROM batch_holdings holding
    JOIN active_batches affected ON affected.batch_id=holding.batch_id
    WHERE NOT EXISTS(SELECT 1 FROM recall_safety_holds hold WHERE hold.recall_id=affected.recall_id
      AND hold.entity_type='holding' AND hold.entity_id=holding.id AND hold.released_at IS NULL)
    UNION ALL
    SELECT 'ACTIVE_RECALL_LOT_HOLD_MISSING','lot',affected.lot_id FROM recall_affected_lots affected
    JOIN recall_notices recall ON recall.id=affected.recall_id WHERE recall.status='active'
    AND NOT EXISTS(SELECT 1 FROM recall_safety_holds hold WHERE hold.recall_id=affected.recall_id
      AND hold.entity_type='lot' AND hold.entity_id=affected.lot_id AND hold.released_at IS NULL)
    ORDER BY code,entity_id`);
  const summary=await client.query(`SELECT
    (SELECT COUNT(*)::int FROM recall_notices WHERE status='active') AS active_recalls,
    COUNT(DISTINCT hold.entity_id) FILTER(WHERE hold.entity_type='lot')::int AS held_lots,
    COUNT(DISTINCT hold.entity_id) FILTER(WHERE hold.entity_type='holding')::int AS held_holdings
    FROM recall_safety_holds hold JOIN recall_notices recall ON recall.id=hold.recall_id
    WHERE recall.status='active' AND hold.released_at IS NULL`);
  return {ok:issues.rows.length===0,issueCount:issues.rows.length,issues:issues.rows,summary:summary.rows[0]};
}
