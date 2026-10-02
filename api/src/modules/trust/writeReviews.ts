import type { PoolClient } from 'pg';
import { recordTradeAudit, TradeActor } from '../trading/transaction';

export function certificateExpiry(validTo: string | Date): Date {
  const date = new Date(validTo);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

export async function recordClaimReview(client: PoolClient, actor: TradeActor, input: {
  entityType: 'batch' | 'certificate'; entityId: string; sourceReference: string;
  reviewMethod: string; expiresAt: Date; snapshot: Record<string, unknown>;
}): Promise<void> {
  const review = await client.query(`INSERT INTO trust_claim_reviews
    (entity_type,entity_id,claim_key,claim_source,source_reference,reviewer_user_id,
     reviewer_organization_id,review_method,expires_at,snapshot_metadata)
    VALUES($1,$2,'organic','organic_certificate',$3,$4,$5,$6,$7,$8) RETURNING id`,
  [input.entityType,input.entityId,input.sourceReference,actor.id,actor.organizationId,
    input.reviewMethod,input.expiresAt,JSON.stringify(input.snapshot)]);
  await recordTradeAudit(client, actor, 'trust.review.record', input.entityType, input.entityId,
    { reviewId: review.rows[0].id, method: input.reviewMethod, ...input.snapshot });
}
