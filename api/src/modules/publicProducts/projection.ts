import { safeExternalHttpsUrl } from '../../security/externalUrls';
import { readPublicNotices } from '../catalog/publicNotices';
import { readPublicJourney } from '../catalog/publicJourney';
import { readPublicEvidence } from '../catalog/publicEvidence';
import { withCatalogRead } from '../catalog/paging';
import { loadBatchTrust, legacyOrganicStatus } from '../trust/assessment';
import * as repository from './repository';

export async function readPublishedProduct(slug: string) {
  const profileRes = await repository.findPublishedProduct([slug]);
  const product = profileRes.rows[0];
  if (!product) {
    return undefined;
  }

  const [plotRes, certRes, evidenceRes, journeyRes, recallRes] = await Promise.all([
    repository.readProductPlotSummary([product.batch_id]),
    repository.readProductCertificate([product.batch_id]),
    readPublicEvidence(slug, {}, { id: product.id, batchId: product.batch_id }).then((page) => ({
      rows: page.items,
      paging: { count: page.count, hasMore: page.hasMore, nextCursor: page.nextCursor },
    })),
    readPublicJourney(slug, {}, { id: product.id, batchId: product.batch_id }),
    readPublicNotices(slug, { status: 'active' }, { id: product.id, batchId: product.batch_id }),
  ]);

  const trust = (
    await withCatalogRead((execute) => loadBatchTrust([product.batch_id], execute, true))
  ).get(product.batch_id)!;
  const certificate = certRes.rows[0] ? { ...certRes.rows[0], trust: trust.organic } : null;
  // Stop if publication or its linked material changed while the independent reads ran.
  const published = await repository.recheckPublication([product.id, product.batch_id, slug]);
  if (!published.rows[0]) {
    return undefined;
  }
  return {
    trust,
    profile: {
      slug: product.slug,
      displayName: product.display_name,
      brandName: product.brand_name,
      description: product.description,
      gtin: product.gtin,
      lotCode: product.lot_code,
      heroImageUrl: safeExternalHttpsUrl(product.hero_image_url),
      publishedAt: product.published_at,
      qrSvgUrl: `/public/products/${product.slug}/qr.svg`,
    },
    product: {
      crop: product.crop,
      harvestDate: product.harvest_date,
      quantityKg: Number(product.quantity_kg),
      moisturePercent: product.moisture_percent == null ? null : Number(product.moisture_percent),
      grade: product.grade,
      organicClaimStatus: legacyOrganicStatus(trust),
      provenanceHash: product.provenance_hash,
      currentHolderName: product.current_holder_name,
    },
    origin: {
      farmName: product.farm_name,
      farmerName: product.farmer_name,
      country: product.country,
      region: product.region,
      district: product.district,
      community: product.community,
      officialTraceabilityId: product.official_traceability_id,
      verificationStatus: trust.origin.status === 'reviewed' ? 'verified' : trust.origin.status,
      ...plotRes.rows[0],
    },
    certificate,
    evidence: evidenceRes.rows,
    evidencePaging: evidenceRes.paging,
    journey: journeyRes.items,
    journeyPaging: {
      count: journeyRes.count,
      hasMore: journeyRes.hasMore,
      nextCursor: journeyRes.nextCursor,
    },
    noticesPaging: {
      count: recallRes.count,
      hasMore: recallRes.hasMore,
      nextCursor: recallRes.nextCursor,
    },
    safety: {
      ...recallRes.safety,
      activeRecalls: recallRes.items,
      resolvedRecalls: [],
    },
  };
}

export async function publishedQrSlug(slug: string): Promise<string | undefined> {
  return (await repository.findPublishedSlug([slug])).rows[0]?.slug;
}
export async function recordPublishedScan(slug: string): Promise<boolean> {
  return Boolean((await repository.insertPublishedScan([slug])).rows[0]);
}
