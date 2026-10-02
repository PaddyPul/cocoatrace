import type { PoolClient } from 'pg';
import { AppError } from '../../errors';

// Shared locks allow unrelated trades concurrently; activation takes the same
// boundary exclusively before reading impact, so stock cannot escape its snapshot.
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
  ))`;

export async function assertBatchNotRecalled(client: PoolClient, batchId: string): Promise<void> {
  const result = await client.query(`SELECT ${activeBatchRecallSql('$1::uuid')} AS held`, [batchId]);
  if (result.rows[0].held) throw new AppError('This inventory is on an active recall safety hold. Trading, transfer and dispatch are blocked.',409,'ACTIVE_RECALL');
}
