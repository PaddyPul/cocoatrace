import { AppError } from '../../errors';
import { recordAudit } from '../../services/auditWriter';
import { inDatabaseTransaction } from '../../services/databaseTransaction';
import {
  hasBatchRelationship,
  hasExplicitPermission,
  type Actor,
} from '../../services/resourcePolicy';
import * as repository from './repository';
import type { UpsertProfileInput } from './types';
export type ProfileActor = Actor & { id: string };
export class PublicProductWorkflowError extends AppError {
  constructor(status: number, message: string) {
    super(message, status);
  }
}

export async function getProfileForBatch(actor: ProfileActor, batchId: string) {
  const allowed =
    hasExplicitPermission(actor, 'product_profile.read.all') ||
    (await hasBatchRelationship(actor, batchId));
  if (!allowed) {
    throw new PublicProductWorkflowError(403, 'Access denied');
  }
  const result = await repository.findProfileForBatch([batchId]);
  if (!result.rows[0]) {
    throw new PublicProductWorkflowError(404, 'Product profile not found');
  }
  const profile = result.rows[0];
  return profile;
}

export async function upsertProfile(actor: ProfileActor, payload: UpsertProfileInput) {
  return inDatabaseTransaction(async (client) => {
    const { batchId, slug, displayName, brandName, description, gtin, lotCode, heroImageUrl } =
      payload;
    const batchRes = await repository.findProfileBatch([batchId], client);
    if (!batchRes.rows[0]) {
      throw new PublicProductWorkflowError(404, 'Batch not found');
    }
    const perms = actor.permissions || [];
    if (!perms.includes('*') && batchRes.rows[0].current_holder_id !== actor.organizationId) {
      throw new PublicProductWorkflowError(
        403,
        'Only the current holder can manage this product profile',
      );
    }
    const result = await repository.saveProfile(
      [
        batchId,
        slug,
        displayName,
        brandName || null,
        description || '',
        gtin || null,
        lotCode,
        heroImageUrl || null,
      ],
      client,
    );
    const profile = result.rows[0];
    await recordAudit(client, actor, 'product_profile.upsert', 'product_profile', profile.id);
    return profile;
  });
}

export async function publishProfile(actor: ProfileActor, id: string) {
  return inDatabaseTransaction(async (client) => {
    await repository.lockProfileBatch(id, client);
    const result = await repository.publishOwnedProfile(
      [id, (actor.permissions || []).includes('*'), actor.organizationId],
      client,
    );
    if (!result.rows[0])
      throw new PublicProductWorkflowError(404, 'Product profile not found or access denied');
    await recordAudit(
      client,
      actor,
      'product_profile.publish',
      'product_profile',
      result.rows[0].id,
    );
    return result.rows[0];
  });
}
