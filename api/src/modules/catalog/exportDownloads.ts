import type { AuthenticatedActor } from '../../services/authSessionService';
import { completeAuditExport } from './auditExport';
import { completeProvenancePack } from './provenanceExport';
import { recordAuditDownload, recordProvenanceDownload } from './exportAttribution';
export async function downloadAuditReport(
  actor: AuthenticatedActor,
  parameters: Record<string, unknown>,
) {
  const report = await completeAuditExport(actor, parameters);
  await recordAuditDownload(actor, report);
  return report;
}
export async function downloadProvenanceReport(
  actor: AuthenticatedActor,
  batchId: string,
  parameters: Record<string, unknown>,
) {
  const report = await completeProvenancePack(actor, batchId, parameters, 'export');
  await recordProvenanceDownload(actor, batchId, report);
  return report;
}
