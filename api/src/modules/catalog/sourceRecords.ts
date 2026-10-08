import { Request, Response } from 'express';
import { AppError, ValidationError } from '../../errors';
import { Actor, hasExplicitPermission } from '../../services/resourcePolicy';
import { loadBatchTrust, legacyOrganicStatus } from '../trust/assessment';
import { Execute, flag, literal, pageResult, parsePage, text, withCatalogRead } from './paging';

// Keep the list boundary: ownership, cooperative and certifier relationships.
const farmFrom = `FROM farms f JOIN organizations o ON o.id=f.farmer_organization_id`;
const farmVisible = `($2::boolean OR f.farmer_organization_id=$1::uuid OR f.cooperative_organization_id=$1::uuid
  OR EXISTS(SELECT 1 FROM organic_certificates c WHERE c.farm_id=f.id AND c.certifier_organization_id=$1::uuid))`;
export const batchFrom = `FROM harvest_batches b LEFT JOIN farms f ON f.id=b.farm_id JOIN organizations o ON o.id=b.current_holder_id`;
export const batchVisible = `($2::boolean OR b.current_holder_id=$1::uuid OR f.farmer_organization_id=$1::uuid OR f.cooperative_organization_id=$1::uuid
  OR EXISTS(SELECT 1 FROM batch_holdings h WHERE h.batch_id=b.id AND h.holder_organization_id=$1::uuid)
  OR EXISTS(SELECT 1 FROM batch_attestations a WHERE a.batch_id=b.id AND a.certifier_organization_id=$1::uuid)
  OR EXISTS(SELECT 1 FROM batch_holdings h JOIN sales_contracts c ON c.holding_id=h.id WHERE h.batch_id=b.id AND (c.seller_organization_id=$1::uuid OR c.buyer_organization_id=$1::uuid)))`;
const farmSelect = 'SELECT f.*,o.name AS farmer_org_name';
const batchSelect = 'SELECT b.*,f.name AS farm_name,o.name AS holder_name';
// Exact option lookup shares the list boundary, rather than the broader detail policy.
export async function sourceOptionById(
  execute: Execute,
  actor: Actor,
  resource: 'farm' | 'batch',
  id: string,
) {
  const farm = resource === 'farm';
  return (
    await execute(
      `SELECT ${farm ? 'f.id,f.name' : 'b.id,b.crop'} ${farm ? farmFrom : batchFrom}
      WHERE ${farm ? farmVisible : batchVisible} AND ${farm ? 'f' : 'b'}.id=$3::uuid`,
      [
        actor.organizationId,
        hasExplicitPermission(actor, farm ? 'farm.read.all' : 'batch.read.all'),
        id,
      ],
    )
  ).rows[0];
}
async function enrich(execute: Execute, rows: Record<string, unknown>[]) {
  const trust = await loadBatchTrust(
    rows.map((row) => String(row.id)),
    execute,
    true,
  );
  return rows.map((row) => ({
    ...row,
    recorded_organic_claim_status: row.organic_claim_status,
    organic_claim_status: legacyOrganicStatus(trust.get(String(row.id))!),
    trust: trust.get(String(row.id)),
  }));
}
export async function farmPage(
  execute: Execute,
  actor: Actor,
  parameters: Record<string, unknown>,
) {
  const all = hasExplicitPermission(actor, 'farm.read.all'),
    owned = flag(parameters.owned, 'owned');
  const input = parsePage(parameters, ['farms', actor.organizationId, all, owned], ['owned']);
  const result = await execute(
    `${farmSelect} ${farmFrom} WHERE ${farmVisible}
    AND (NOT $3::boolean OR f.farmer_organization_id=$1::uuid)
    AND ($4::uuid IS NULL OR f.id>$4::uuid)
    AND ($5::text='' OR concat_ws(' ',f.id,f.name,f.region,f.country,f.district,f.official_traceability_id,o.name) ILIKE $6::text ESCAPE '\\')
    ORDER BY f.id LIMIT $7::int`,
    [
      actor.organizationId,
      all,
      owned,
      input.cursor?.id || null,
      input.search,
      literal(input.search),
      input.limit + 1,
    ],
  );
  return pageResult(result.rows, input);
}
export async function batchPage(
  execute: Execute,
  actor: Actor,
  parameters: Record<string, unknown>,
) {
  const all = hasExplicitPermission(actor, 'batch.read.all'),
    mine = flag(parameters.mine, 'mine');
  const farm = text(parameters.farm, 'farm identifier', 36);
  if (farm && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(farm))
    throw new ValidationError('Invalid farm identifier');
  const input = parsePage(
    parameters,
    ['batches', actor.organizationId, all, mine, farm],
    ['mine', 'farm'],
  );
  const result = await execute(
    `${batchSelect} ${batchFrom} WHERE ${batchVisible}
    AND (NOT $3::boolean OR b.current_holder_id=$1::uuid)
    AND ($4::uuid IS NULL OR b.id>$4::uuid)
    AND ($5::text='' OR concat_ws(' ',b.id,b.crop,f.name,b.source_name,o.name,b.grade) ILIKE $6::text ESCAPE '\\')
    AND ($7::uuid IS NULL OR b.farm_id=$7::uuid)
    ORDER BY b.id LIMIT $8::int`,
    [
      actor.organizationId,
      all,
      mine,
      input.cursor?.id || null,
      input.search,
      literal(input.search),
      farm || null,
      input.limit + 1,
    ],
  );
  const page = pageResult(result.rows, input);
  return { ...page, items: await enrich(execute, page.items) };
}
export async function farmSummary(execute: Execute, actor: Actor) {
  return (
    await execute(
      `SELECT COUNT(*)::int AS count,COUNT(*) FILTER(WHERE f.farmer_organization_id=$1::uuid)::int AS owned_count ${farmFrom} WHERE ${farmVisible}`,
      [actor.organizationId, hasExplicitPermission(actor, 'farm.read.all')],
    )
  ).rows[0];
}
export async function legacySourceList(
  execute: Execute,
  actor: Actor,
  resource: 'farms' | 'batches',
) {
  const farm = resource === 'farms';
  const rows = (
    await execute(
      `${farm ? farmSelect : batchSelect} ${farm ? farmFrom : batchFrom} WHERE ${farm ? farmVisible : batchVisible}
    ORDER BY ${farm ? 'f.name,f.id' : 'b.harvest_date DESC,b.id'} LIMIT 1001`,
      [
        actor.organizationId,
        hasExplicitPermission(actor, farm ? 'farm.read.all' : 'batch.read.all'),
      ],
    )
  ).rows;
  if (rows.length > 1000)
    throw new AppError(
      'Source list exceeds the legacy limit. Use the paged source view.',
      422,
      'CATALOG_READ_LIMIT',
    );
  return farm ? rows : enrich(execute, rows);
}
export async function listFarmPage(req: Request, res: Response) {
  res.json(await withCatalogRead((execute) => farmPage(execute, req.user!, req.query)));
}
export async function listBatchPage(req: Request, res: Response) {
  res.json(await withCatalogRead((execute) => batchPage(execute, req.user!, req.query)));
}
export async function summarizeFarms(req: Request, res: Response) {
  res.json(await withCatalogRead((execute) => farmSummary(execute, req.user!)));
}
export async function summarizeBatches(req: Request, res: Response) {
  if (Object.keys(req.query).some((key) => key !== 'farm'))
    throw new ValidationError('Unknown batch summary parameter');
  const farm = text(req.query.farm, 'farm identifier', 36);
  if (farm && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(farm))
    throw new ValidationError('Invalid farm identifier');
  res.json(
    await withCatalogRead(
      async (execute) =>
        (
          await execute(
            `SELECT COUNT(*)::int AS count,COALESCE(SUM(b.quantity_kg),0)::text AS recorded_quantity_kg ${batchFrom} WHERE ${batchVisible} AND ($3::uuid IS NULL OR b.farm_id=$3::uuid)`,
            [
              req.user!.organizationId,
              hasExplicitPermission(req.user!, 'batch.read.all'),
              farm || null,
            ],
          )
        ).rows[0],
    ),
  );
}
