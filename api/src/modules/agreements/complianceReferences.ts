import type { AuthenticatedActor } from '../../services/authSessionService';
import * as audit from '../../services/audit';
import { saveEudrReference, saveComplianceReference } from './complianceRepository';
export async function updateBuyerEudrReference(
  actor: AuthenticatedActor,
  id: string,
  reference: string,
) {
  const contract = await saveEudrReference(id, actor.organizationId, reference);
  if (!contract) return null;
  await audit.record({
    actorUserId: actor.id,
    actorOrganizationId: actor.organizationId,
    action: 'contract.eudr.update',
    entityType: 'sales_contract',
    entityId: id,
  });
  return contract;
}
export async function updateBuyerComplianceReference(
  actor: AuthenticatedActor,
  id: string,
  scheme: string,
  reference: string,
) {
  const contract = await saveComplianceReference(id, actor.organizationId, scheme, reference);
  if (!contract) return null;
  await audit.record({
    actorUserId: actor.id,
    actorOrganizationId: actor.organizationId,
    action: 'contract.compliance.update',
    entityType: 'sales_contract',
    entityId: id,
  });
  return contract;
}
