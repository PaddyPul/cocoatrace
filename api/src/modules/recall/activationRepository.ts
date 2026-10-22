import type { PoolClient } from 'pg';
import type { TradeActor } from '../trading/transaction';
import type { calculateTraceForward } from '../../services/recallTrace';
import type { TraceBudget } from '../trace/limits';
import { TRACE_LIMITS } from '../trace/limits';

export type RecallInput = {
  acknowledgementDeadlineHours?: number;
  referenceCode: string;
  title: string;
  reason: string;
  instructions: string;
  severity: string;
  batchIds: string[];
  lots: Array<{ lotId: string; quantityKg?: number }>;
};
export interface ActivatedRecallRow {
  id: string;
  reference_code: string;
  title: string;
  reason: string;
  instructions: string;
  severity: string;
  status: string;
  initiated_by_user_id: string;
  initiated_by_organization_id: string;
  initiated_at: Date;
  acknowledgement_due_at: Date | null;
}
export async function loadActivationSourceLots(client: PoolClient, batchIds: string[]) {
  return batchIds.length
    ? (
        await client.query<{ id: string; batch_id: string }>(
          'SELECT id,batch_id FROM material_lots WHERE batch_id=ANY($1::uuid[]) ORDER BY id LIMIT $2',
          [batchIds, TRACE_LIMITS.seeds + 1],
        )
      ).rows
    : [];
}
export async function persistRecallActivation(
  client: PoolClient,
  actor: TradeActor,
  input: RecallInput,
  impact: ReturnType<typeof calculateTraceForward>,
  affectedBatchIds: string[],
  budget: TraceBudget,
) {
  const recall = (
    await client.query<ActivatedRecallRow>(
      `INSERT INTO recall_notices
      (reference_code,title,reason,instructions,severity,status,initiated_by_user_id,initiated_by_organization_id,acknowledgement_due_at)
      VALUES($1,$2,$3,$4,$5,'active',$6,$7,NOW()+($8::int*INTERVAL '1 hour')) RETURNING *`,
      [
        input.referenceCode,
        input.title,
        input.reason,
        input.instructions,
        input.severity,
        actor.id,
        actor.organizationId,
        input.acknowledgementDeadlineHours ?? 24,
      ],
    )
  ).rows[0];
  if (affectedBatchIds.length)
    await client.query(
      'INSERT INTO recall_affected_batches(recall_id,batch_id) SELECT $1,unnest($2::uuid[])',
      [recall.id, affectedBatchIds],
    );
  await client.query(
    `INSERT INTO recall_affected_lots(recall_id,lot_id,source_equivalent_kg,recall_quantity_kg,relationship_depth)
      SELECT $1,lot_id,equivalent,recall_quantity,depth FROM unnest($2::uuid[],$3::numeric[],$4::numeric[],$5::int[])
      AS affected(lot_id,equivalent,recall_quantity,depth)`,
    [
      recall.id,
      impact.impactedLots.map((lot) => lot.id),
      impact.impactedLots.map((lot) => lot.sourceEquivalentKg),
      impact.impactedLots.map((lot) => lot.recallQuantityKg),
      impact.impactedLots.map((lot) => lot.relationshipDepth),
    ],
  );
  await client.query(
    "INSERT INTO recall_safety_holds(recall_id,entity_type,entity_id) SELECT $1,'lot',unnest($2::uuid[])",
    [recall.id, impact.impactedLots.map((lot) => lot.id)],
  );
  budget.step();
  await client.query(
    `INSERT INTO recall_safety_holds(recall_id,entity_type,entity_id)
      SELECT $1,'holding',id FROM batch_holdings WHERE batch_id=ANY($2::uuid[]) ON CONFLICT DO NOTHING`,
    [recall.id, affectedBatchIds],
  );
  const withdrawn = await client.query<{ id: string }>(
    `UPDATE listings listing SET active=FALSE FROM batch_holdings holding
      WHERE listing.holding_id=holding.id AND holding.batch_id=ANY($1::uuid[]) AND listing.active RETURNING listing.id`,
    [affectedBatchIds],
  );
  budget.step();
  return { recall, withdrawnListingIds: withdrawn.rows.map((row) => row.id) };
}

export async function configureActivationTimeout(client: PoolClient) {
  await client.query(`SET LOCAL statement_timeout = '${TRACE_LIMITS.statementMs}ms'`);
}
