import { query } from '../../db';

export type TrustStatus = 'not_claimed' | 'self_declared' | 'reviewed' | 'expired' | 'revoked' | 'unknown';
export interface ClaimAssessment {
  status: TrustStatus;
  claimSource: string | null;
  sourceReference: string | null;
  reviewMethod: string | null;
  reviewedAt: string | null;
  expiresAt: string | null;
  reviewerName: string | null;
}
export interface TrustSummary { organic: ClaimAssessment; origin: ClaimAssessment; eudr: ClaimAssessment }
export interface ClaimReview {
  entity_type: string; entity_id: string; claim_key: string; claim_source: string;
  source_reference: string | null; review_method: string; reviewed_at: string | Date;
  expires_at: string | Date | null; status: string; reviewer_name: string | null; reviewer_organization_id?: string;
}
export interface TrustPlot { id: string; gps_lat: unknown; gps_lng: unknown; eudr_cutoff_checked: boolean; deforestation_risk_status: string }
export type TrustBatch = Record<string, any>;
const iso = (value: any): string | null => value == null || !Number.isFinite(new Date(value).getTime()) ? null : new Date(value).toISOString();
const publicReference = (value: string | null): string | null => value && !/(@|:\/\/|[\\/])/.test(value) ? value : null;
const base = (status: TrustStatus, claimSource: string | null = null): ClaimAssessment => ({ status, claimSource, sourceReference: null, reviewMethod: null, reviewedAt: null, expiresAt: null, reviewerName: null });
// Geographic coordinates are supplied data, including valid zero coordinates; never a verification decision.
export function hasGeolocation(plot: TrustPlot): boolean {
  return plot.gps_lat != null && plot.gps_lng != null && Number.isFinite(Number(plot.gps_lat)) && Number.isFinite(Number(plot.gps_lng)) && Math.abs(Number(plot.gps_lat)) <= 90 && Math.abs(Number(plot.gps_lng)) <= 180;
}
export function assessReview(review: ClaimReview | undefined, now = new Date()): ClaimAssessment {
  if (!review) return base('self_declared', 'supplier_declaration');
  const metadata = { claimSource: review.claim_source, sourceReference: publicReference(review.source_reference), reviewMethod: review.review_method, reviewedAt: iso(review.reviewed_at), expiresAt: iso(review.expires_at), reviewerName: review.reviewer_name };
  if (review.status === 'revoked') return { status: 'revoked', ...metadata };
  if (!metadata.reviewedAt || new Date(metadata.reviewedAt) > now || !review.review_method.trim() || !review.claim_source.trim()) return { status: 'unknown', ...metadata };
  if (review.expires_at && (!metadata.expiresAt || new Date(metadata.expiresAt) <= now)) return { status: 'expired', ...metadata };
  return { status: review.status === 'reviewed' ? 'reviewed' : 'unknown', ...metadata };
}
function latestReview(reviews: ClaimReview[], entityType: string, entityId: string, key: string) {
  return reviews.filter(r => r.entity_type === entityType && r.entity_id === entityId && r.claim_key === key).sort((a,b) => new Date(b.reviewed_at).getTime() - new Date(a.reviewed_at).getTime() || Number(b.status === 'revoked') - Number(a.status === 'revoked'))[0];
}
export function assessBatchTrust(batch: TrustBatch, plots: TrustPlot[], reviews: ClaimReview[], now = new Date()): TrustSummary {
  plots = plots.filter(plot => Array.isArray(batch.plot_ids) && batch.plot_ids.includes(plot.id));
  let organic = base(batch.organic_claim_status === 'none' ? 'not_claimed' : 'self_declared', 'supplier_declaration');
  if (batch.attestation_id) {
    organic = { ...base('unknown', 'organic_certificate'), sourceReference: publicReference(batch.certificate_reference || null), reviewMethod: 'certificate_attestation', reviewedAt: iso(batch.attested_at), expiresAt: iso(batch.certificate_valid_to) ? `${iso(batch.certificate_valid_to)!.slice(0,10)}T23:59:59.999Z` : null, reviewerName: batch.certifier_name || null };
    const currentDate = now.toISOString().slice(0,10);
    const harvest = iso(batch.harvest_date)?.slice(0,10);
    const from = iso(batch.certificate_valid_from)?.slice(0,10);
    const to = iso(batch.certificate_valid_to)?.slice(0,10);
    const scope = Array.isArray(batch.certificate_crop_scope) && batch.certificate_crop_scope.some((crop: string) => crop.trim().toLowerCase() === String(batch.crop).trim().toLowerCase());
    const linked = batch.attestation_batch_id === batch.id && batch.certificate_farm_id === batch.farm_id && batch.certificate_farmer_id === batch.farmer_organization_id && batch.attestation_certifier_id === batch.certificate_certifier_id && batch.certificate_certifier_id !== batch.farmer_organization_id && batch.attestation_user_org === batch.attestation_certifier_id && batch.certifier_type === 'certifier' && batch.certifier_workspace_status === 'verified';
    if (batch.certificate_status === 'revoked' || batch.certificate_status === 'suspended') organic.status = 'revoked';
    else if (to && to < currentDate) organic.status = 'expired';
    else if (linked && scope && batch.source_mode !== 'direct_inventory' && batch.certificate_status === 'active' && from && to && harvest && from <= harvest && harvest <= to && from <= currentDate && currentDate <= to && organic.reviewedAt && new Date(organic.reviewedAt) <= now) organic.status = 'reviewed';
  }
  let origin = batch.farm_id ? assessReview(latestReview(reviews,'farm',batch.farm_id,'verification'),now) : base('self_declared','supplier_declaration');
  const originReview = latestReview(reviews,'farm',batch.farm_id,'verification');
  if (origin.status === 'reviewed' && originReview?.reviewer_organization_id === batch.farmer_organization_id) origin = { ...origin, status: 'self_declared' };
  const batchEudr = latestReview(reviews,'batch',batch.id,'eudr');
  let eudr = batchEudr ? assessReview(batchEudr,now) : base(plots.some(p => p.eudr_cutoff_checked || p.deforestation_risk_status === 'clear') ? 'self_declared' : 'unknown', plots.length ? 'supplier_declaration' : null);
  if (eudr.status === 'reviewed' && [batch.current_holder_id, batch.farmer_organization_id].includes(batchEudr?.reviewer_organization_id)) eudr = { ...eudr, status: 'self_declared' };
  // A documented whole-batch review is required; plot flags and GPS alone never imply legal EUDR compliance.
  if (eudr.status === 'reviewed' && (!plots.length || plots.length !== new Set(batch.plot_ids).size || !plots.every(hasGeolocation))) eudr = { ...eudr, status: 'unknown' };
  return { organic, origin, eudr };
}
export function legacyOrganicStatus(trust: TrustSummary): string {
  return trust.organic.status === 'reviewed' ? 'attested' : trust.organic.status === 'not_claimed' ? 'none' : 'self_declared';
}

export async function loadBatchTrust(batchIds: string[], runQuery: (sql: string, params?: any[]) => Promise<{ rows: any[] }> = query, bounded = false): Promise<Map<string, TrustSummary>> {
  if (!batchIds.length) return new Map();
  const batches = await runQuery(`SELECT b.*, f.farmer_organization_id,
    au.organization_id AS attestation_user_org,a.batch_id AS attestation_batch_id,a.certifier_organization_id AS attestation_certifier_id,a.attested_at,
    c.status AS certificate_status,c.farm_id AS certificate_farm_id,c.farmer_organization_id AS certificate_farmer_id,
    c.certifier_organization_id AS certificate_certifier_id,c.crop_scope AS certificate_crop_scope,
    c.valid_from AS certificate_valid_from,c.valid_to AS certificate_valid_to,c.accreditation_reference AS certificate_reference,
    o.name AS certifier_name,o.type AS certifier_type,o.verification_status AS certifier_workspace_status FROM harvest_batches b LEFT JOIN farms f ON f.id=b.farm_id
    LEFT JOIN batch_attestations a ON a.id=b.attestation_id LEFT JOIN users au ON au.id=a.certifier_user_id LEFT JOIN organic_certificates c ON c.id=a.certificate_id
    LEFT JOIN organizations o ON o.id=c.certifier_organization_id WHERE b.id=ANY($1::uuid[])`, [batchIds]);
  const farmIds = batches.rows.map(b => b.farm_id).filter(Boolean);
  const [plots,reviews] = await Promise.all([
    runQuery('SELECT * FROM farm_plots WHERE farm_id=ANY($1::uuid[])' + (bounded ? ' LIMIT 5001' : ''),[farmIds]),
    runQuery(`SELECT r.*,o.name AS reviewer_name FROM trust_claim_reviews r JOIN organizations o ON o.id=r.reviewer_organization_id JOIN users u ON u.id=r.reviewer_user_id AND u.organization_id=r.reviewer_organization_id
      WHERE (r.entity_type='batch' AND r.entity_id=ANY($1::uuid[])) OR (r.entity_type='farm' AND r.entity_id=ANY($2::uuid[]))` + (bounded ? ' LIMIT 5001' : ''),[batchIds,farmIds])
  ]);
  return new Map(batches.rows.map(b => [b.id,assessBatchTrust(b,plots.rows.filter(p => p.farm_id===b.farm_id),reviews.rows)]));
}
