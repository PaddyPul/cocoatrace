import { PoolClient } from 'pg';
import { getClient } from '../../db';
import { hashObject } from '../../services/audit';

export interface TradeActor { id: string; organizationId: string }

export async function inTradeTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Critical inventory audit events commit with the mutation, or neither commits. */
export async function recordTradeAudit(client: PoolClient, actor: TradeActor, action: string, entityType: string,
  entityId: string, metadata: Record<string, unknown> = {}): Promise<void> {
  await client.query(`INSERT INTO audit_events
    (actor_user_id,actor_organization_id,action,entity_type,entity_id,new_state_hash,metadata)
    VALUES($1,$2,$3,$4,$5,$6,$7)`,
  [actor.id, actor.organizationId, action, entityType, entityId, hashObject({ action, entityId, ...metadata }), JSON.stringify(metadata)]);
}
