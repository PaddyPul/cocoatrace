import crypto from 'node:crypto';
import type { PoolClient } from 'pg';
import { query } from '../db';

export type SecurityEvent = {
  eventType: string;
  success: boolean;
  actorUserId?: string;
  actorOrganizationId?: string;
  sessionId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
};

export function securityIdentifierHash(value: string): string {
  return `sha256:${crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex')}`;
}

export async function recordSecurityEvent(event: SecurityEvent, client?: PoolClient): Promise<void> {
  const execute = client ? client.query.bind(client) : query;
  await execute(
    `INSERT INTO security_events
      (event_type,actor_user_id,actor_organization_id,session_id,success,reason,metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [event.eventType, event.actorUserId || null, event.actorOrganizationId || null,
      event.sessionId || null, event.success, event.reason || null, JSON.stringify(event.metadata || {})],
  );
}
