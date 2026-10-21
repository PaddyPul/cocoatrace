import crypto from 'node:crypto';
import { query } from '../../db';
import { hashObject } from '../../services/audit';
import { hasExplicitPermission } from '../../services/resourcePolicy';
import type { AuthenticatedActor } from '../../services/authSessionService';
import type { completeAuditExport } from './auditExport';
import type { completeProvenancePack } from './provenanceExport';
export async function recordAuditDownload(
  actor: AuthenticatedActor,
  report: Awaited<ReturnType<typeof completeAuditExport>>,
) {
  await query(
    `INSERT INTO audit_events
    (actor_user_id,actor_organization_id,action,entity_type,entity_id,reason,metadata,new_state_hash)
    VALUES($1,$2,'export','audit',$3,'Audit log export requested',$4,$5)`,
    [
      actor.id,
      actor.organizationId,
      crypto.randomUUID(),
      JSON.stringify({
        ...report.filters,
        recordCount: report.count,
        bytes: report.bytes,
        scope: hasExplicitPermission(actor, 'audit.export.all') ? 'network' : 'organization',
      }),
      hashObject({ count: report.count, bytes: report.bytes, at: new Date().toISOString() }),
    ],
  );
}
export async function recordProvenanceDownload(
  actor: AuthenticatedActor,
  batchId: string,
  report: Awaited<ReturnType<typeof completeProvenancePack>>,
) {
  await query(
    `INSERT INTO audit_events
    (actor_user_id,actor_organization_id,action,entity_type,entity_id,new_state_hash,reason,metadata)
    VALUES($1,$2,'provenance.export','harvest_batch',$3,$4,'Exported provenance pack as json',$5)`,
    [
      actor.id,
      actor.organizationId,
      batchId,
      hashObject({ batchId, at: report.payload.generatedAt }),
      JSON.stringify({
        contractId: report.payload.contractId,
        bytes: Buffer.byteLength(report.serialized, 'utf8'),
      }),
    ],
  );
}
