import type { AuthenticatedActor } from '../../services/authSessionService';
import { inDatabaseTransaction } from '../../services/databaseTransaction';
import { recordAudit } from '../../services/auditWriter';
import { saveEudrReference, saveComplianceReference } from './complianceRepository';
export async function updateBuyerEudrReference(
  actor: AuthenticatedActor,
  id: string,
  reference: string,
) {
  return inDatabaseTransaction(async (client) => {
    const contract = await saveEudrReference(client, id, actor.organizationId, reference);
    if (!contract) return null;
    await recordAudit(client, actor, 'contract.eudr.update', 'sales_contract', id);
    return contract;
  });
}
export async function updateBuyerComplianceReference(
  actor: AuthenticatedActor,
  id: string,
  scheme: string,
  reference: string,
) {
  return inDatabaseTransaction(async (client) => {
    const contract = await saveComplianceReference(
      client,
      id,
      actor.organizationId,
      scheme,
      reference,
    );
    if (!contract) return null;
    await recordAudit(client, actor, 'contract.compliance.update', 'sales_contract', id);
    return contract;
  });
}
