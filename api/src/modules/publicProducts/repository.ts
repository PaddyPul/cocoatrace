import { query } from '../../db';
import type { ProfileRow, PublishedProductRow, PlotSummaryRow, CertificateRow } from './types';

export function findProfileForBatch(values: [batchId: string]) {
  return query<ProfileRow>('SELECT * FROM product_profiles WHERE batch_id=$1', values);
}

export function findProfileBatch(values: [batchId: string]) {
  return query<{ id: string; current_holder_id: string }>(
    'SELECT id, current_holder_id FROM harvest_batches WHERE id=$1',
    values,
  );
}

export function saveProfile(
  values: [
    batchId: string,
    slug: string,
    displayName: string,
    brandName: string | null,
    description: string,
    gtin: string | null,
    lotCode: string,
    heroImageUrl: string | null,
  ],
) {
  return query<ProfileRow>(
    `INSERT INTO product_profiles (batch_id, slug, display_name, brand_name, description, gtin, lot_code, hero_image_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (batch_id) DO UPDATE SET slug=EXCLUDED.slug, display_name=EXCLUDED.display_name,
       brand_name=EXCLUDED.brand_name, description=EXCLUDED.description, gtin=EXCLUDED.gtin,
       lot_code=EXCLUDED.lot_code, hero_image_url=EXCLUDED.hero_image_url, updated_at=NOW()
     RETURNING *`,
    values,
  );
}

export function publishOwnedProfile(
  values: [profileId: string, all: boolean, organizationId: string],
) {
  return query<ProfileRow>(
    `UPDATE product_profiles pp SET visibility='published', published_at=COALESCE(published_at, NOW()), updated_at=NOW()
     FROM harvest_batches b
     WHERE pp.id=$1 AND b.id=pp.batch_id AND ($2::boolean OR b.current_holder_id=$3)
     RETURNING pp.*`,
    values,
  );
}

export function findPublishedProduct(values: [slug: string]) {
  return query<PublishedProductRow>(
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
    values,
  );
}

export function readProductPlotSummary(values: [batchId: string]) {
  return query<PlotSummaryRow>(
    `SELECT COUNT(*)::int AS plot_count,
              COALESCE(SUM(area_hectares), 0)::float AS total_area_hectares,
              BOOL_AND(gps_lat IS NOT NULL AND gps_lng IS NOT NULL) AS geolocation_complete,
              BOOL_AND(eudr_cutoff_checked) AS eudr_cutoff_checked,
              BOOL_AND(deforestation_risk_status = 'clear') AS deforestation_risk_clear
       FROM farm_plots p JOIN harvest_batches b ON b.farm_id=p.farm_id WHERE b.id=$1 AND p.id=ANY(b.plot_ids)`,
    values,
  );
}

export function readProductCertificate(values: [batchId: string]) {
  return query<CertificateRow>(
    `SELECT c.standard, c.valid_from, c.valid_to, c.status, c.accreditation_reference,
              o.name AS certifier_name, a.attested_at, a.notes
       FROM batch_attestations a
       JOIN organic_certificates c ON c.id = a.certificate_id
       JOIN organizations o ON o.id = c.certifier_organization_id
       WHERE a.id=(SELECT attestation_id FROM harvest_batches WHERE id=$1)`,
    values,
  );
}

export function recheckPublication(values: [profileId: string, batchId: string, slug: string]) {
  return query<{ id: string }>(
    "SELECT id FROM product_profiles WHERE id=$1 AND batch_id=$2 AND slug=$3 AND visibility='published'",
    values,
  );
}

export function findPublishedSlug(values: [slug: string]) {
  return query<{ slug: string }>(
    "SELECT slug FROM product_profiles WHERE slug=$1 AND visibility='published'",
    values,
  );
}

export function insertPublishedScan(values: [slug: string]) {
  return query<{ id: string }>(
    `INSERT INTO product_profile_scans (product_profile_id)
     SELECT id FROM product_profiles WHERE slug=$1 AND visibility='published'
     RETURNING id`,
    values,
  );
}
