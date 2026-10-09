import { activeBatchRecallSql } from '../recall/safety';
import { loadBatchTrust, legacyOrganicStatus } from '../trust/assessment';
import { AppError } from '../../errors';
import {
  Execute,
  PageInput,
  literal,
  normalizeCommodity,
  normalizedCommoditySql,
  pageResult,
} from './paging';

export const holdingFrom = `FROM batch_holdings h JOIN harvest_batches b ON b.id=h.batch_id LEFT JOIN farms f ON f.id=b.farm_id`;
export const holdingSelect = `SELECT h.*,${activeBatchRecallSql('h.batch_id')} AS "activeRecall",b.crop,b.harvest_date,b.organic_claim_status,b.grade,b.source_mode,b.source_name,b.source_country,b.source_region,f.name AS farm_name`;
export const listingFrom = `FROM listings l JOIN organizations o ON o.id=l.seller_organization_id JOIN batch_holdings h ON h.id=l.holding_id JOIN harvest_batches b ON b.id=h.batch_id LEFT JOIN farms f ON f.id=b.farm_id`;
export const listingVisible = `l.active=TRUE AND l.available_quantity_kg>0 AND NOT ${activeBatchRecallSql('b.id')} AND h.status='available' AND h.holder_organization_id=l.seller_organization_id`;
const listingProjection = (held: string) =>
  `SELECT l.*,o.name AS seller_name,h.batch_id,b.crop,b.organic_claim_status,b.grade,b.harvest_date,b.source_mode,b.source_name,b.source_country,b.source_region,${held} AS "activeRecall",f.name AS farm_name,f.region AS farm_region,f.country AS farm_country`;
export const listingSelect = listingProjection(activeBatchRecallSql('b.id'));

// This predicate mirrors assessBatchTrust's certificate branch, never legacy attested flags.
export const reviewedOrganicSql = `EXISTS (SELECT 1 FROM batch_attestations a
  JOIN organic_certificates c ON c.id=a.certificate_id JOIN users au ON au.id=a.certifier_user_id
  JOIN organizations co ON co.id=c.certifier_organization_id JOIN farms cf ON cf.id=b.farm_id
  WHERE a.id=b.attestation_id AND a.batch_id=b.id AND c.farm_id=b.farm_id
  AND c.farmer_organization_id=cf.farmer_organization_id AND a.certifier_organization_id=c.certifier_organization_id
  AND c.certifier_organization_id<>cf.farmer_organization_id AND au.organization_id=a.certifier_organization_id
  AND co.type='certifier' AND co.verification_status='verified' AND c.status='active'
  AND COALESCE(b.source_mode,'farm_traceable')<>'direct_inventory'
  AND c.valid_from<=b.harvest_date AND b.harvest_date<=c.valid_to
  AND c.valid_from<=(NOW() AT TIME ZONE 'UTC')::date AND (NOW() AT TIME ZONE 'UTC')::date<=c.valid_to AND a.attested_at<=NOW()
  AND EXISTS (SELECT 1 FROM unnest(c.crop_scope) AS scope(crop) WHERE lower(trim(scope.crop))=lower(trim(b.crop))))`;

async function decorate(execute: Execute, rows: Record<string, unknown>[]) {
  const trust = await loadBatchTrust(
    [...new Set(rows.map((row) => String(row.batch_id)))],
    execute,
    true,
  );
  return rows.map((row) => ({
    ...row,
    trust: trust.get(String(row.batch_id)),
    organic_claim_status: legacyOrganicStatus(trust.get(String(row.batch_id))!),
  }));
}
export async function holdingPage(
  execute: Execute,
  organizationId: string,
  input: PageInput,
  available: boolean,
) {
  const result = await execute(
    `${holdingSelect} ${holdingFrom}
    WHERE h.holder_organization_id=$1 AND ($2::uuid IS NULL OR h.id>$2)
    AND (NOT $3::boolean OR (h.status='available' AND h.quantity_kg>0 AND NOT ${activeBatchRecallSql('b.id')}))
    AND ($4='' OR concat_ws(' ',h.id,b.crop,f.name,b.source_name,h.warehouse_location,h.status) ILIKE $5 ESCAPE '\\')
    ORDER BY h.id LIMIT $6`,
    [
      organizationId,
      input.cursor?.id || null,
      available,
      input.search,
      literal(input.search),
      input.limit + 1,
    ],
  );
  const page = pageResult(result.rows, input);
  return { ...page, items: await decorate(execute, page.items) };
}
export interface ListingFilters {
  mine: boolean;
  commodity: string;
  origin: string;
  minimum: string;
  organic: boolean;
  id: string;
  currency: string;
}
export async function listingPage(
  execute: Execute,
  organizationId: string,
  input: PageInput,
  filters: ListingFilters,
) {
  const key =
    input.sort === 'price'
      ? 'price_per_kg'
      : input.sort === 'quantity'
        ? 'available_quantity_kg'
        : '';
  const direction = input.sort === 'quantity' ? 'DESC' : 'ASC';
  const relation = direction === 'DESC' ? '<' : '>';
  const boundary = key
    ? `(l.${key},l.id) ${relation} ($2::numeric,$3::uuid)`
    : `(l.id>$3::uuid AND $2::numeric IS NULL)`;
  const result = await execute(
    `WITH candidates AS MATERIALIZED (
      SELECT l.id,h.batch_id ${listingFrom}
      WHERE l.active=TRUE AND l.available_quantity_kg>0 AND h.status='available' AND h.holder_organization_id=l.seller_organization_id
      AND (NOT $4::boolean OR l.seller_organization_id=$1::uuid) AND ($13::uuid IS NULL OR l.id=$13::uuid) AND ($14::text='' OR l.currency=$14::text)
      AND ($3::uuid IS NULL OR ${boundary})
      AND ($5::text='' OR concat_ws(' ',l.id,o.name,f.name,b.source_name,f.region,b.source_region,b.crop,b.grade) ILIKE $6::text ESCAPE '\\')
      AND ($7::text='' OR ${normalizedCommoditySql('b.crop')}=$7::text)
      AND ($8::text='' OR concat_ws(' ',f.region,b.source_region,l.origin_location) ILIKE $9::text ESCAPE '\\')
      AND l.available_quantity_kg >= $10::numeric
    ), assessed AS MATERIALIZED (
      SELECT b.id AS batch_id,${activeBatchRecallSql('b.id')} AS held,
        CASE WHEN $11::boolean THEN ${reviewedOrganicSql} ELSE FALSE END AS reviewed
      FROM harvest_batches b JOIN (SELECT DISTINCT batch_id FROM candidates) batch_keys ON batch_keys.batch_id=b.id
    )
    ${listingProjection('assessment.held')} ${listingFrom}
    JOIN candidates candidate ON candidate.id=l.id JOIN assessed assessment ON assessment.batch_id=b.id
    WHERE NOT assessment.held AND (NOT $11::boolean OR assessment.reviewed)
    ORDER BY ${key ? `l.${key} ${direction},` : ''}l.id ${direction} LIMIT $12::int`,
    [
      organizationId,
      input.cursor?.key || null,
      input.cursor?.id || null,
      filters.mine,
      input.search,
      literal(input.search),
      normalizeCommodity(filters.commodity),
      filters.origin,
      literal(filters.origin),
      filters.minimum,
      filters.organic,
      input.limit + 1,
      filters.id || null,
      filters.currency,
    ],
  );
  const page = pageResult(result.rows, input, key);
  return { ...page, items: await decorate(execute, page.items) };
}
export async function holdingSummary(execute: Execute, organizationId: string) {
  const totals = await execute(
    `WITH stock AS MATERIALIZED (
      SELECT h.batch_id,COUNT(*)::int AS count,
        COUNT(*) FILTER (WHERE h.status='available')::int AS available_count,
        COALESCE(SUM(h.quantity_kg) FILTER (WHERE h.status='available'),0) AS available_kg
      FROM batch_holdings h JOIN harvest_batches b ON b.id=h.batch_id
      WHERE h.holder_organization_id=$1 GROUP BY h.batch_id
    ), assessed AS MATERIALIZED (
      SELECT stock.*,${activeBatchRecallSql('stock.batch_id')} AS held FROM stock
    )
    SELECT COALESCE(SUM(count),0)::int AS count,
      COALESCE(SUM(available_count) FILTER (WHERE NOT held),0)::int AS available_count,
      COALESCE(SUM(available_kg) FILTER (WHERE NOT held),0)::text AS available_kg
    FROM assessed`,
    [organizationId],
  );
  const commodities = await execute(
    `SELECT DISTINCT ${normalizedCommoditySql('b.crop')} AS commodity ${holdingFrom} WHERE h.holder_organization_id=$1 ORDER BY commodity LIMIT 101`,
    [organizationId],
  );
  if (commodities.rows.length > 100)
    throw new AppError('Inventory commodity summary exceeds its limit.', 422, 'CATALOG_READ_LIMIT');
  return { ...totals.rows[0], commodities: commodities.rows.map((row) => row.commodity) };
}
export async function listingSummary(execute: Execute, organizationId: string) {
  return (
    await execute(
      `SELECT COUNT(*)::int AS count,COALESCE(SUM(l.available_quantity_kg),0)::text AS quantity_kg,
    COUNT(*) FILTER (WHERE l.seller_organization_id=$1)::int AS own_count ${listingFrom} WHERE ${listingVisible}`,
      [organizationId],
    )
  ).rows[0];
}

export async function legacyHoldingList(execute: Execute, organizationId: string) {
  const candidates = await execute(
    `SELECT h.id ${holdingFrom} WHERE h.holder_organization_id=$1
     ORDER BY h.created_at DESC,h.id DESC LIMIT 1001`,
    [organizationId],
  );
  if (candidates.rows.length > 1000)
    throw new AppError(
      'Inventory list exceeds the legacy limit. Use the paged inventory view.',
      422,
      'CATALOG_READ_LIMIT',
    );
  if (!candidates.rows.length) return [];
  return (
    await execute(
      `${holdingSelect} ${holdingFrom} WHERE h.holder_organization_id=$1 AND h.id=ANY($2::uuid[])
     ORDER BY h.created_at DESC,h.id DESC`,
      [organizationId, candidates.rows.map((row) => row.id)],
    )
  ).rows;
}
