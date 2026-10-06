import type { PoolClient } from 'pg';
import { hashObject } from './audit';
export interface AuditActor { id: string; organizationId: string }

/** Security/business mutations and their audits commit together, or neither commits. */
export async function recordAudit(client: PoolClient, actor: AuditActor, action: string, entityType: string,
  entityId: string, metadata: Record<string, unknown> = {}): Promise<void> {
  await client.query(`INSERT INTO audit_events
    (actor_user_id,actor_organization_id,action,entity_type,entity_id,new_state_hash,metadata)
    VALUES($1,$2,$3,$4,$5,$6,$7)`,
  [actor.id, actor.organizationId, action, entityType, entityId, hashObject({ action, entityId, ...metadata }), JSON.stringify(metadata)]);
}
