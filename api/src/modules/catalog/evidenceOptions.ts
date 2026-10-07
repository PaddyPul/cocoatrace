import { Request, Response } from 'express';
import { ForbiddenError, ValidationError } from '../../errors';
import { Actor, hasExplicitPermission } from '../../services/resourcePolicy';
import { batchPage, farmPage, sourceOptionById } from './sourceRecords';
import { Execute, literal, pageResult, parsePage, text, withCatalogRead } from './paging';

type Kind = 'farm' | 'batch' | 'contract' | 'shipment';
const permissions = {
  farm: 'farm.read',
  batch: 'batch.read',
  contract: 'contract.read',
  shipment: 'shipment.read',
};
function kindOf(value: unknown): Kind {
  const kind = text(value, 'record kind', 16);
  if (!Object.hasOwn(permissions, kind))
    throw new ValidationError('Choose a supported evidence record kind');
  return kind as Kind;
}
function option(kind: Kind, row: Record<string, unknown>) {
  const id = String(row.id);
  return {
    id,
    label:
      kind === 'farm'
        ? String(row.name)
        : kind === 'batch'
          ? `${row.crop || 'Material'} · ${id.slice(0, 8)}`
          : `${id.slice(0, 8)} · ${kind === 'contract' ? row.status : row.current_milestone || 'Planning'}`,
  };
}
async function tradeOptions(
  execute: Execute,
  actor: Actor,
  kind: 'contract' | 'shipment',
  parameters: Record<string, unknown>,
  id = '',
) {
  const input = parsePage(parameters, ['evidence-options', kind, actor.organizationId], []);
  const contract = kind === 'contract';
  const alias = contract ? 'c' : 'sh';
  const from = contract
    ? 'FROM sales_contracts c'
    : 'FROM shipments sh JOIN sales_contracts c ON c.id=sh.contract_id';
  const search = contract
    ? 'c.id,c.status,c.incoterm,seller.name,buyer.name'
    : 'sh.id,sh.contract_id,sh.current_milestone,sh.service_provider_name,sh.booking_reference,sh.origin_port,sh.destination_port,seller.name,buyer.name';
  const rows = (
    await execute(
      `SELECT ${alias}.id,${contract ? 'c.status' : 'sh.current_milestone'} ${from}
    JOIN organizations seller ON seller.id=c.seller_organization_id JOIN organizations buyer ON buyer.id=c.buyer_organization_id
    WHERE (c.seller_organization_id=$1::uuid OR c.buyer_organization_id=$1::uuid)
    AND ($2::uuid IS NULL OR ${alias}.id>$2::uuid)
    AND ($3::uuid IS NULL OR ${alias}.id=$3::uuid)
    AND ($4::text='' OR concat_ws(' ',${search}) ILIKE $5::text ESCAPE '\\')
    ORDER BY ${alias}.id LIMIT $6::int`,
      [
        actor.organizationId,
        input.cursor?.id || null,
        id || null,
        input.search,
        literal(input.search),
        input.limit + 1,
      ],
    )
  ).rows;
  return pageResult(rows, input);
}
export async function evidenceOptions(
  execute: Execute,
  actor: Actor,
  parameters: Record<string, unknown>,
) {
  const { kind: requested, id: requestedId, ...paging } = parameters;
  const kind = kindOf(requested);
  if (!hasExplicitPermission(actor, permissions[kind]))
    throw new ForbiddenError('Your account cannot read this record kind');
  const id = text(requestedId, 'record identifier', 36);
  if (requestedId !== undefined) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
      Object.keys(paging).length
    )
      throw new ValidationError('An exact record lookup requires kind and a valid id only');
    const row =
      kind === 'farm' || kind === 'batch'
        ? await sourceOptionById(execute, actor, kind, id)
        : (await tradeOptions(execute, actor, kind, {}, id)).items[0];
    return { items: row ? [option(kind, row)] : [], hasMore: false, nextCursor: null };
  }
  const page =
    kind === 'farm'
      ? await farmPage(execute, actor, paging)
      : kind === 'batch'
        ? await batchPage(execute, actor, paging)
        : await tradeOptions(execute, actor, kind, paging);
  return { ...page, items: page.items.map((row) => option(kind, row)) };
}
export async function listEvidenceOptions(req: Request, res: Response) {
  res.json(await withCatalogRead((execute) => evidenceOptions(execute, req.user!, req.query)));
}
