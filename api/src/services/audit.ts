import crypto from 'crypto';
import { query } from '../db';

interface AuditParams {
  actorUserId: string;
  actorOrganizationId: string;
  action: string;
  entityType: string;
  entityId: string;
  newStateHash?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

function hashObject(obj: Record<string, unknown>): string {
  const canonical = JSON.stringify(obj, Object.keys(obj).sort());
  return 'sha256:' + crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

async function record(params: AuditParams): Promise<void> {
  const { actorUserId, actorOrganizationId, action, entityType, entityId, newStateHash, reason, metadata } = params;
  try {
    await query(
      `INSERT INTO audit_events (actor_user_id, actor_organization_id, action, entity_type, entity_id, new_state_hash, reason, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [actorUserId, actorOrganizationId, action, entityType, entityId,
       newStateHash || hashObject({ entityId, action, at: new Date().toISOString() }),
       reason || null, JSON.stringify(metadata || {})]
    );
  } catch (err) {
    console.error('Audit record failed:', (err as Error).message);
  }
}

export { record, hashObject };
