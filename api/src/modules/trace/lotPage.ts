import { createHash } from 'node:crypto';
import { ValidationError } from '../../errors';
import { activeBatchRecallSql } from '../recall/safety';

export const LOT_PAGE_LIMIT = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export interface LotPageInput {
  limit: number;
  search: string;
  after?: string;
  scope: string;
}
interface LotRow {
  id: string;
  lot_code: string;
  lot_type: string;
  product_name: string;
  quantity_kg: string;
  batch_id: string | null;
  status: string;
  produced_at: string | Date;
  owner_organization_id: string;
  owner_name: string;
  source_mode: string | null;
  source_label: string | null;
  downstream_lot_count: number;
  distribution_count: number;
}
type Execute = (sql: string, params: unknown[]) => Promise<{ rows: LotRow[] }>;

export function parseLotPage(
  query: Record<string, unknown>,
  organizationId: string,
  seeAll: boolean,
): LotPageInput {
  for (const key of Object.keys(query))
    if (!['limit', 'search', 'cursor'].includes(key))
      throw new ValidationError('Unknown lot page parameter');
  const { limit = '50', search = '', cursor } = query;
  if (typeof limit !== 'string' || !/^[1-9]\d{0,2}$/.test(limit) || Number(limit) > LOT_PAGE_LIMIT)
    throw new ValidationError('Lot page limit must be between 1 and 100');
  if (
    typeof search !== 'string' ||
    search.length > 80 ||
    [...search].some((character) => character.charCodeAt(0) < 32)
  )
    throw new ValidationError(
      'Lot search must be at most 80 characters without control characters',
    );
  const normalized = search.trim().toLowerCase();
  const scope = createHash('sha256')
    .update(JSON.stringify([organizationId, seeAll, normalized]))
    .digest('hex');
  let after: string | undefined;
  if (cursor !== undefined) {
    if (typeof cursor !== 'string' || cursor.length > 256 || !/^[A-Za-z0-9_-]+$/.test(cursor))
      throw new ValidationError('Invalid lot cursor');
    try {
      const decoded: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
      if (!decoded || typeof decoded !== 'object') throw new Error();
      const value = decoded as Record<string, unknown>;
      if (
        value.v !== 1 ||
        value.scope !== scope ||
        typeof value.after !== 'string' ||
        !UUID.test(value.after) ||
        Object.keys(value).length !== 3
      )
        throw new Error();
      after = value.after;
    } catch {
      throw new ValidationError('Invalid lot cursor; restart the search');
    }
  }
  return { limit: Number(limit), search: normalized, after, scope };
}

export async function readLotPage(
  execute: Execute,
  organizationId: string,
  seeAll: boolean,
  input: LotPageInput,
) {
  // Authorization is repeated in SQL on every page. Cursors convey position, never permission.
  // Materialize the bounded page before calculating its recall state and correlated counts.
  const result = await execute(
    `WITH page AS MATERIALIZED (
    SELECT ml.* FROM material_lots ml
    WHERE ($2::boolean OR ml.owner_organization_id=$1
      OR EXISTS (SELECT 1 FROM batch_holdings h WHERE h.batch_id=ml.batch_id AND h.holder_organization_id=$1)
      OR EXISTS (SELECT 1 FROM batch_holdings h JOIN sales_contracts c ON c.holding_id=h.id WHERE h.batch_id=ml.batch_id AND (c.seller_organization_id=$1 OR c.buyer_organization_id=$1))
      OR EXISTS (SELECT 1 FROM lot_distributions d WHERE d.lot_id=ml.id AND d.recipient_organization_id=$1))
      AND ($3::uuid IS NULL OR ml.id>$3::uuid)
      AND ($4='' OR ml.lot_code ILIKE $5 ESCAPE '\\' OR ml.product_name ILIKE $5 ESCAPE '\\' OR ml.id::text=$4)
    ORDER BY ml.id LIMIT $6
  ) SELECT ml.id,ml.lot_code,ml.lot_type,ml.product_name,ml.quantity_kg,ml.batch_id,
    CASE WHEN ${activeBatchRecallSql('ml.batch_id')} OR EXISTS (
      SELECT 1 FROM recall_safety_holds h JOIN recall_notices r ON r.id=h.recall_id
      WHERE h.entity_type='lot' AND h.entity_id=ml.id AND r.status='active'
    ) THEN 'held' ELSE ml.status END AS status,
    ml.produced_at,ml.owner_organization_id,o.name AS owner_name,b.source_mode,
    COALESCE(f.name,b.source_name,b.source_region,b.source_country) AS source_label,
    (SELECT COUNT(*)::int FROM lot_genealogy_edges e WHERE e.source_lot_id=ml.id) AS downstream_lot_count,
    (SELECT COUNT(*)::int FROM lot_distributions d WHERE d.lot_id=ml.id) AS distribution_count
    FROM page ml JOIN organizations o ON o.id=ml.owner_organization_id
    LEFT JOIN harvest_batches b ON b.id=ml.batch_id LEFT JOIN farms f ON f.id=b.farm_id ORDER BY ml.id`,
    [
      organizationId,
      seeAll,
      input.after || null,
      input.search,
      `%${input.search.replace(/[\\%_]/g, '\\$&')}%`,
      input.limit + 1,
    ],
  );
  const visible = result.rows.slice(0, input.limit);
  const hasMore = result.rows.length > input.limit;
  return {
    items: visible.map((row) => ({
      id: row.id,
      lotCode: row.lot_code,
      lotType: row.lot_type,
      productName: row.product_name,
      quantityKg: Number(row.quantity_kg),
      batchId: row.batch_id,
      status: row.status,
      producedAt: row.produced_at,
      ownerOrganizationId: row.owner_organization_id,
      ownerName: row.owner_name,
      sourceMode: row.source_mode,
      sourceLabel: row.source_label,
      downstreamLotCount: row.downstream_lot_count,
      distributionCount: row.distribution_count,
    })),
    nextCursor: hasMore
      ? Buffer.from(
          JSON.stringify({ v: 1, scope: input.scope, after: visible[visible.length - 1].id }),
        ).toString('base64url')
      : null,
    hasMore,
  };
}
