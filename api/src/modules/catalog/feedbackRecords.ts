import { AppError, ValidationError } from '../../errors';
import { Actor } from '../../services/resourcePolicy';
import { Execute, literal, pageResult, parsePage } from './paging';
const from =
  'FROM pilot_feedback f JOIN users u ON u.id=f.user_id JOIN organizations o ON o.id=f.organization_id';
const scope = '($1::boolean OR f.organization_id=$2::uuid)';
const fields =
  'f.id,f.page,f.task,f.rating,f.comment,f.created_at,u.name AS user_name,o.name AS organization_name';
const args = (actor: Actor) => [actor.permissions.includes('*'), actor.organizationId];
function rating(value: unknown): number | null {
  if (value === undefined || value === '') return null;
  if (typeof value !== 'string' || !/^[1-5]$/.test(value))
    throw new ValidationError('Feedback rating must be between 1 and 5');
  return Number(value);
}
export async function feedbackSummary(
  execute: Execute,
  actor: Actor,
  parameters: Record<string, unknown> = {},
) {
  if (Object.keys(parameters).length)
    throw new ValidationError('Unknown feedback summary parameter');
  return (
    await execute(
      `SELECT COUNT(*)::int AS count,
    COUNT(*) FILTER(WHERE f.rating=1)::int AS rating_1_count,
    COUNT(*) FILTER(WHERE f.rating=2)::int AS rating_2_count,
    COUNT(*) FILTER(WHERE f.rating=3)::int AS rating_3_count,
    COUNT(*) FILTER(WHERE f.rating=4)::int AS rating_4_count,
    COUNT(*) FILTER(WHERE f.rating=5)::int AS rating_5_count
    FROM pilot_feedback f WHERE ${scope}`,
      args(actor),
    )
  ).rows[0];
}
export async function feedbackPage(
  execute: Execute,
  actor: Actor,
  parameters: Record<string, unknown> = {},
) {
  const filter = rating(parameters.rating);
  const input = parsePage(
    parameters,
    ['feedback', actor.organizationId, [...actor.permissions].sort(), filter],
    ['rating'],
  );
  const rows = (
    await execute(
      `WITH candidates AS MATERIALIZED (
    SELECT f.id ${from} WHERE ${scope}
    AND ($3::int IS NULL OR f.rating=$3::int) AND ($4::uuid IS NULL OR f.id<$4::uuid)
    AND ($5::text='' OR concat_ws(' ',f.page,f.task,f.comment,u.name,o.name) ILIKE $6::text ESCAPE '\\')
    ORDER BY f.id DESC LIMIT $7::int)
    SELECT ${fields} ${from} JOIN candidates c ON c.id=f.id ORDER BY f.id DESC`,
      [
        ...args(actor),
        filter,
        input.cursor?.id || null,
        input.search,
        literal(input.search),
        input.limit + 1,
      ],
    )
  ).rows;
  const count = (
    await execute(
      `SELECT COUNT(*)::int AS count FROM pilot_feedback f WHERE ${scope} AND ($3::int IS NULL OR f.rating=$3::int)`,
      [...args(actor), filter],
    )
  ).rows[0].count;
  return { ...pageResult(rows, input), count };
}
export async function legacyFeedback(
  execute: Execute,
  actor: Actor,
  parameters: Record<string, unknown> = {},
) {
  if (Object.keys(parameters).length)
    throw new ValidationError('Use paged feedback search for filters');
  const ids = (
    await execute(
      `SELECT f.id FROM pilot_feedback f WHERE ${scope} ORDER BY f.id DESC LIMIT 1001`,
      args(actor),
    )
  ).rows;
  if (ids.length > 1000)
    throw new AppError(
      'Feedback history exceeds the complete list limit. Use paged search.',
      422,
      'CATALOG_READ_LIMIT',
    );
  if (!ids.length) return [];
  return (
    await execute(
      `SELECT ${fields} ${from} WHERE ${scope} AND f.id=ANY($3::uuid[]) ORDER BY f.created_at DESC,f.id DESC`,
      [...args(actor), ids.map((row) => row.id)],
    )
  ).rows;
}
