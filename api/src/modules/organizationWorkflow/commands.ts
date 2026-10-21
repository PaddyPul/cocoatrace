import { insertOrganization } from './creationRepository';
import type { AuditActor } from '../../services/auditWriter';
import type { z } from 'zod';
import * as audit from '../../services/audit';
import { createOrganizationSchema } from '../../validation';
export async function createOrganization(
  actor: AuditActor,
  input: z.infer<typeof createOrganizationSchema>,
) {
  const created = await insertOrganization(input);
  await audit.record({
    actorUserId: actor.id,
    actorOrganizationId: actor.organizationId,
    action: 'organization.create',
    entityType: 'organization',
    entityId: created.id,
  });
  return created;
}
