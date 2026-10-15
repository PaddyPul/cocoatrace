import { Request, Response } from 'express';
import QRCode from 'qrcode';
import { query } from '../../db';
import { safeExternalHttpsUrl } from '../../security/externalUrls';
import { readPublicNotices } from '../../modules/catalog/publicNotices';
import { readPublicJourney } from '../../modules/catalog/publicJourney';
import { readPublicEvidence } from '../../modules/catalog/publicEvidence';
import { withCatalogRead } from '../../modules/catalog/paging';
import { loadBatchTrust, legacyOrganicStatus } from '../../modules/trust/assessment';
import { publicProductUrl } from './publicUrl';

export async function getPublicProduct(req: Request, res: Response): Promise<void> {
  const profileRes = await query(
    `SELECT pp.*, b.crop, b.harvest_date, b.quantity_kg, b.moisture_percent, b.grade, b.source_mode, b.source_name, b.source_country, b.source_region,
            b.organic_claim_status, b.provenance_hash, b.attestation_id,
            f.name AS farm_name, f.country, f.region, f.district, f.community,
            f.official_traceability_id, f.verification_status AS farm_verification_status,
            farmer.name AS farmer_name, holder.name AS current_holder_name
     FROM product_profiles pp
     JOIN harvest_batches b ON b.id = pp.batch_id
     LEFT JOIN farms f ON f.id = b.farm_id
     LEFT JOIN organizations farmer ON farmer.id = f.farmer_organization_id
     JOIN organizations holder ON holder.id = b.current_holder_id
     WHERE pp.slug = $1 AND pp.visibility = 'published'`,
    [req.params.slug],
  );
  const product = profileRes.rows[0];
  if (!product) {
    res.status(404).json({ error: 'Product profile not found' });
    return;
  }

  const [plotRes, certRes, evidenceRes, journeyRes, recallRes] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS plot_count,
              COALESCE(SUM(area_hectares), 0)::float AS total_area_hectares,
              BOOL_AND(gps_lat IS NOT NULL AND gps_lng IS NOT NULL) AS geolocation_complete,
              BOOL_AND(eudr_cutoff_checked) AS eudr_cutoff_checked,
              BOOL_AND(deforestation_risk_status = 'clear') AS deforestation_risk_clear
       FROM farm_plots p JOIN harvest_batches b ON b.farm_id=p.farm_id WHERE b.id=$1 AND p.id=ANY(b.plot_ids)`,
      [product.batch_id],
    ),
    query(
      `SELECT c.standard, c.valid_from, c.valid_to, c.status, c.accreditation_reference,
              o.name AS certifier_name, a.attested_at, a.notes
       FROM batch_attestations a
       JOIN organic_certificates c ON c.id = a.certificate_id
       JOIN organizations o ON o.id = c.certifier_organization_id
       WHERE a.id=(SELECT attestation_id FROM harvest_batches WHERE id=$1)`,
      [product.batch_id],
    ),
    readPublicEvidence(req.params.slug, {}, { id: product.id, batchId: product.batch_id }).then(
      (page) => ({
        rows: page.items,
        paging: { count: page.count, hasMore: page.hasMore, nextCursor: page.nextCursor },
      }),
    ),
    readPublicJourney(req.params.slug, {}, { id: product.id, batchId: product.batch_id }),
    readPublicNotices(
      req.params.slug,
      { status: 'active' },
      { id: product.id, batchId: product.batch_id },
    ),
  ]);

  const trust = (
    await withCatalogRead((execute) => loadBatchTrust([product.batch_id], execute, true))
  ).get(product.batch_id)!;
  const certificate = certRes.rows[0] ? { ...certRes.rows[0], trust: trust.organic } : null;
  // Stop if publication or its linked material changed while the independent reads ran.
  const published = await query(
    "SELECT id FROM product_profiles WHERE id=$1 AND batch_id=$2 AND slug=$3 AND visibility='published'",
    [product.id, product.batch_id, req.params.slug],
  );
  if (!published.rows[0]) {
    res.status(404).json({ error: 'Product profile not found' });
    return;
  }
  res.set('Cache-Control', 'no-store');
  res.json({
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
      profileUrl: publicProductUrl(product.slug),
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
  });
}

export async function getProductQr(req: Request, res: Response): Promise<void> {
  const result = await query(
    "SELECT slug FROM product_profiles WHERE slug=$1 AND visibility='published'",
    [req.params.slug],
  );
  if (!result.rows[0]) {
    res.status(404).json({ error: 'Product profile not found' });
    return;
  }
  const svg = await QRCode.toString(publicProductUrl(result.rows[0].slug), {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 512,
    color: { dark: '#17251b', light: '#ffffff' },
  });
  res.type('image/svg+xml').set('Cache-Control', 'public, max-age=86400').send(svg);
}

export async function recordScan(req: Request, res: Response): Promise<void> {
  const result = await query(
    `INSERT INTO product_profile_scans (product_profile_id)
     SELECT id FROM product_profiles WHERE slug=$1 AND visibility='published'
     RETURNING id`,
    [req.params.slug],
  );
  if (!result.rows[0]) {
    res.status(404).json({ error: 'Product profile not found' });
    return;
  }
  res.status(204).send();
}
