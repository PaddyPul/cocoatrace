import { AppError, ValidationError } from '../../errors';
import { Actor, hasExplicitPermission } from '../../services/resourcePolicy';
import { Execute, flag, literal, pageResult, parsePage, text } from './paging';
const scope =
  "(sr.buyer_organization_id=$1::uuid OR ($2::boolean AND sr.status='open' AND sr.visibility='matched'))";
const fields =
  'sr.id,sr.buyer_organization_id,sr.title,sr.commodity,sr.quantity_kg,sr.origin_countries,sr.quality_requirements,sr.assurance_requirements,sr.delivery_location,sr.incoterm,sr.required_by,sr.offer_deadline,sr.visibility,sr.status,sr.created_at,sr.updated_at,o.name AS buyer_name';
const argumentsFor = (actor: Actor) => [
  actor.organizationId,
  hasExplicitPermission(actor, 'listing.create', 'offer.respond'),
];
export async function sourcingPage(
  execute: Execute,
  actor: Actor,
  parameters: Record<string, unknown> = {},
) {
  const id = text(parameters.id, 'request ID');
  if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    throw new ValidationError('Invalid request ID');
  const mine = flag(parameters.mine, 'mine');
  const input = parsePage(
    parameters,
    ['sourcing-requests', actor.organizationId, [...actor.permissions].sort(), id, mine],
    ['id', 'mine'],
  );
  const rows = (
    await execute(
      `WITH candidates AS MATERIALIZED (
    SELECT sr.id FROM sourcing_requests sr WHERE ${scope}
    AND ($7::uuid IS NULL OR sr.id=$7::uuid) AND (NOT $8::boolean OR sr.buyer_organization_id=$1::uuid)
    AND ($3::uuid IS NULL OR sr.id<$3::uuid)
    AND ($4::text='' OR concat_ws(' ',sr.title,sr.commodity) ILIKE $5::text ESCAPE '\\')
    ORDER BY sr.id DESC LIMIT $6::int)
    SELECT ${fields} FROM candidates c JOIN sourcing_requests sr ON sr.id=c.id
    JOIN organizations o ON o.id=sr.buyer_organization_id ORDER BY sr.id DESC`,
      [
        ...argumentsFor(actor),
        input.cursor?.id || null,
        input.search,
        literal(input.search),
        input.limit + 1,
        id || null,
        mine,
      ],
    )
  ).rows;
  return pageResult(rows, input);
}
export async function sourcingSummary(execute: Execute, actor: Actor) {
  const args = argumentsFor(actor);
  const counts = (
    await execute(
      `SELECT COUNT(*) FILTER(WHERE sr.buyer_organization_id=$1::uuid)::int AS own_count,
    COUNT(*) FILTER(WHERE sr.buyer_organization_id<>$1::uuid AND sr.status='open' AND sr.visibility='matched')::int AS open_count
    FROM sourcing_requests sr WHERE ${scope}`,
      args,
    )
  ).rows[0];
  const latest = async (own: boolean, open = false) =>
    (
      await execute(
        `SELECT ${fields} FROM sourcing_requests sr
    JOIN organizations o ON o.id=sr.buyer_organization_id WHERE ${scope}
    AND ${own ? `sr.buyer_organization_id=$1::uuid${open ? " AND sr.status='open'" : ''}` : "sr.buyer_organization_id<>$1::uuid AND sr.status='open' AND sr.visibility='matched'"}
    ORDER BY sr.created_at DESC,sr.id DESC LIMIT 1`,
        args,
      )
    ).rows[0] || null;
  return {
    ...counts,
    latest_own: await latest(true),
    latest_own_open: await latest(true, true),
    latest_open: await latest(false),
  };
}
export async function legacySourcing(execute: Execute, actor: Actor) {
  const ids = (
    await execute(
      `SELECT sr.id FROM sourcing_requests sr WHERE ${scope} ORDER BY sr.id DESC LIMIT 1001`,
      argumentsFor(actor),
    )
  ).rows;
  if (ids.length > 1000)
    throw new AppError(
      'Sourcing history exceeds the complete list limit. Use paged search.',
      422,
      'CATALOG_READ_LIMIT',
    );
  if (!ids.length) return [];
  return (
    await execute(
      `SELECT ${fields} FROM sourcing_requests sr JOIN organizations o ON o.id=sr.buyer_organization_id
    WHERE sr.id=ANY($1::uuid[]) AND (sr.buyer_organization_id=$2::uuid OR ($3::boolean AND sr.status='open' AND sr.visibility='matched'))
    ORDER BY sr.created_at DESC,sr.id DESC`,
      [ids.map((row) => row.id), ...argumentsFor(actor)],
    )
  ).rows;
}
