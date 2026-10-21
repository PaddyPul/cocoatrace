import { insertSourcingRequest } from './creationRepository';
import type { AuditActor } from '../../services/auditWriter';
import type { z } from 'zod';
import { query } from '../../db';
import * as audit from '../../services/audit';
import { createSourcingRequestSchema } from '../../validation';
import { inDatabaseTransaction } from '../../services/databaseTransaction';
import { recordAudit } from '../../services/auditWriter';
import { editSourcingRequest } from './edit';
import { closeoutSourcing, sourcingCloseout, closeoutSchema } from './lifecycle';
export async function createRequest(
  actor: AuditActor,
  input: z.infer<typeof createSourcingRequestSchema>,
) {
  const created = await insertSourcingRequest(actor, input);
  await audit.record({
    actorUserId: actor.id,
    actorOrganizationId: actor.organizationId,
    action: 'sourcing_request.create',
    entityType: 'sourcing_request',
    entityId: created.id,
  });
  return created;
}

export async function updateRequest(
  actor: AuditActor,
  id: string,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const result = await inDatabaseTransaction(async (client) => {
    const row = await editSourcingRequest(client.query.bind(client), actor, id, input);
    await recordAudit(client, actor, 'sourcing_request.update', 'sourcing_request', id, {
      changedFields: Object.keys(input),
    });
    return row;
  });
  return result;
}

export async function closeoutRequest(
  actor: AuditActor,
  id: string,
  input: z.infer<typeof closeoutSchema>,
): Promise<Record<string, unknown>> {
  const row = await inDatabaseTransaction(async (client) => {
    const result = await closeoutSourcing(client.query.bind(client), actor, id, input);
    await recordAudit(client, actor, 'sourcing_request.closeout', 'sourcing_request', id, {
      status: input.status,
      reason: input.reason.trim(),
      contractId: input.contractId || null,
      associationBasis: input.contractId ? 'buyer_manual' : null,
    });
    return result;
  });
  return row;
}

export async function getCloseout(organizationId: string, id: string) {
  return sourcingCloseout(query, organizationId, id);
}
