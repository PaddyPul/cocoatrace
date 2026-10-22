import { hashObject } from '../../services/audit';
import type { AuditActor } from '../../services/auditWriter';
import { query } from '../../db';
import { DownloadEvidenceItem } from './policy';

export async function findDownloadEvidence(id: string): Promise<DownloadEvidenceItem | undefined> {
  const { rows } = await query(
    `SELECT e.*,
            c.seller_organization_id,
            c.buyer_organization_id,
            p.release_status
       FROM evidence_items e
       LEFT JOIN shipments sh ON e.linked_entity_type='shipment' AND e.linked_entity_id=sh.id
       LEFT JOIN sales_contracts c
         ON (e.linked_entity_type='contract' AND e.linked_entity_id=c.id) OR sh.contract_id=c.id
       LEFT JOIN LATERAL (
         SELECT release_status FROM payment_requests
          WHERE contract_id=c.id ORDER BY created_at DESC LIMIT 1
       ) p ON TRUE
      WHERE e.id=$1`,
    [id],
  );
  return rows[0] as DownloadEvidenceItem | undefined;
}

/** Records readiness to release bytes, never a claim that the client received them. */
export async function auditEvidenceAccess(
  actor: AuditActor,
  id: string,
  bytes: number,
): Promise<void> {
  await query(
    `INSERT INTO audit_events
      (actor_user_id,actor_organization_id,action,entity_type,entity_id,new_state_hash,metadata)
     VALUES($1,$2,'evidence.download.release_ready','evidence',$3,$4,$5)`,
    [
      actor.id,
      actor.organizationId,
      id,
      hashObject({ action: 'evidence.download.release_ready', id, bytes }),
      JSON.stringify({ bytes, outcome: 'release_ready' }),
    ],
  );
}
