import type { PoolClient } from 'pg';
import { AppError } from '../../errors';

// Acquire this boundary before material row locks, so recall snapshots cannot
// race with inventory movement.
export async function lockRecallBoundary(client: PoolClient, _exclusive = false): Promise<void> {
  // Serialize the complete safety boundary. This is deliberately conservative:
  // the recall path is low volume, and one lock avoids a shared/exclusive
  // upgrade deadlock between an offer and a recall activation.
  await client.query('SELECT pg_advisory_xact_lock(20261002,22)');
}

export const activeBatchRecallSql = (batchExpression: string) => `EXISTS (
  SELECT 1 FROM recall_notices recall WHERE recall.status='active' AND (
    EXISTS (SELECT 1 FROM recall_affected_batches affected WHERE affected.recall_id=recall.id AND affected.batch_id=${batchExpression}) OR
    EXISTS (SELECT 1 FROM recall_affected_lots affected JOIN material_lots lot ON lot.id=affected.lot_id WHERE affected.recall_id=recall.id AND lot.batch_id=${batchExpression})
  ) OR EXISTS(SELECT 1 FROM recall_safety_holds retained
    JOIN batch_holdings holding ON retained.entity_type='holding' AND holding.id=retained.entity_id
    WHERE retained.recall_id=recall.id AND retained.released_at IS NULL AND holding.batch_id=${batchExpression})
    OR EXISTS(SELECT 1 FROM recall_recovery_records recovery JOIN batch_holdings disposed ON disposed.id=recovery.holding_id
      WHERE recovery.recall_id=recall.id AND (recovery.returned_kg>0 OR recovery.destroyed_kg>0) AND disposed.batch_id=${batchExpression})
  )`;

export async function assertBatchNotRecalled(client: PoolClient, batchId: string): Promise<void> {
  const result = await client.query(`SELECT ${activeBatchRecallSql('$1::uuid')} AS held`, [batchId]);
  if (result.rows[0].held) throw new AppError('This inventory is on a recall safety hold. Trading, transfer and dispatch are blocked.',409,'ACTIVE_RECALL');
}
