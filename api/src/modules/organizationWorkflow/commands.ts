import { insertOrganization } from './creationRepository';
import { recordAudit, type AuditActor } from '../../services/auditWriter';
import { inDatabaseTransaction } from '../../services/databaseTransaction';
import type { z } from 'zod';
import { createOrganizationSchema } from '../../validation';
export async function createOrganization(
  actor: AuditActor,
  input: z.infer<typeof createOrganizationSchema>,
) {
  return inDatabaseTransaction(async (client) => {
    const created = await insertOrganization(client, input);
    await recordAudit(client, actor, 'organization.create', 'organization', created.id);
    return created;
  });
}
