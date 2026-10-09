import type { Request, Response } from 'express';
import { NotFoundError } from '../../errors';
import { type Execute, literal, pageResult, parsePage, text, withCatalogRead } from './paging';

// Public approval requires the latest independent review, valid bytes and a clean scan.
const eligibility = `e.linked_entity_type='batch' AND e.linked_entity_id=$1::uuid
 AND e.review_status='approved' AND e.validation_status='validated' AND e.malware_scan_status='clean'
 AND EXISTS(SELECT 1 FROM LATERAL (
 SELECT tr.status,tr.expires_at,tr.reviewer_user_id,tr.reviewer_organization_id FROM trust_claim_reviews tr
 WHERE tr.entity_type='evidence' AND tr.entity_id=e.id AND tr.claim_key='evidence_review'
 AND tr.reviewed_at<=NOW()
 ORDER BY tr.reviewed_at DESC,(tr.status='revoked') DESC,tr.id DESC LIMIT 1
 ) current_review WHERE current_review.status='reviewed'
 AND current_review.reviewer_organization_id<>e.uploader_organization_id
 AND EXISTS(SELECT 1 FROM users reviewer WHERE reviewer.id=current_review.reviewer_user_id AND reviewer.organization_id=current_review.reviewer_organization_id)
 AND (current_review.expires_at IS NULL OR current_review.expires_at>NOW()))`;
export async function publicEvidencePage(
  execute: Execute,
  slug: string,
  parameters: Record<string, unknown> = {},
  expected?: { id: string; batchId: string },
) {
  const name = text(slug, 'product slug', 100);
  const profile = (
    await execute(
      "SELECT id,batch_id FROM product_profiles WHERE slug=$1 AND visibility='published' LIMIT 1",
      [name],
    )
  ).rows[0];
  if (
    !profile ||
    (expected && (profile.id !== expected.id || profile.batch_id !== expected.batchId))
  )
    throw new NotFoundError('Product profile');
  const input = parsePage(parameters, ['public-evidence', profile.id, profile.batch_id], []);
  const rows = (
    await execute(
      `WITH candidates AS MATERIALIZED (
 SELECT e.id FROM evidence_items e WHERE ${eligibility}
 AND ($2::uuid IS NULL OR e.id>$2::uuid)
 AND ($3::text='' OR concat_ws(' ',e.file_name,e.claim_description,e.type) ILIKE $4::text ESCAPE '\\')
 ORDER BY e.id LIMIT $5::int)
 SELECT e.id,e.type,e.file_name,e.sha256_hash,e.review_status,e.claim_description,e.created_at
 FROM evidence_items e JOIN candidates candidate ON candidate.id=e.id ORDER BY e.id`,
      [
        profile.batch_id,
        input.cursor?.id || null,
        input.search,
        literal(input.search),
        input.limit + 1,
      ],
    )
  ).rows;
  const total = (
    await execute(`SELECT COUNT(*)::int AS count FROM evidence_items e WHERE ${eligibility}`, [
      profile.batch_id,
    ])
  ).rows[0];
  return { ...pageResult(rows, input), count: total.count };
}
export const readPublicEvidence = (
  slug: string,
  parameters: Record<string, unknown> = {},
  expected?: { id: string; batchId: string },
) => withCatalogRead((execute) => publicEvidencePage(execute, slug, parameters, expected));
export async function getPublicEvidencePage(req: Request, res: Response) {
  const result = await readPublicEvidence(req.params.slug, req.query);
  res.set('Cache-Control', 'no-store').json(result);
}
