import { AppError, NotFoundError, ValidationError } from '../../errors';
import type { TradeActor } from '../trading/transaction';
import { Execute, literal, PageInput, pageResult, parsePage, withCatalogRead } from './paging';

export type ResponseActor = TradeActor & { permissions: string[] };
export const responseCollections = ['participants', 'holdings', 'recoveries', 'evidence'] as const;
type Collection = (typeof responseCollections)[number];
const definitions = {
  participants: {
    key: 'p.organization_id',
    from: 'FROM recall_participants p JOIN organizations org ON org.id=p.organization_id',
    where: 'p.recall_id=$1::uuid AND ($2::boolean OR p.organization_id=$3::uuid)',
    search: "concat_ws(' ',p.organization_id,org.name,p.contact_status)",
    select: `p.*,p.organization_id AS id,org.name AS organization_name,
      (SELECT COUNT(*)::int FROM users member WHERE member.organization_id=p.organization_id AND member.active) AS eligible_contact_count,
      (SELECT MIN(queue.sent_at) FROM recall_email_outbox queue JOIN users member ON member.id=queue.recipient_user_id WHERE queue.recall_id=p.recall_id AND member.organization_id=p.organization_id AND queue.status='sent') AS first_submitted_at,
      ARRAY(SELECT DISTINCT queue.status FROM recall_email_outbox queue JOIN users member ON member.id=queue.recipient_user_id WHERE queue.recall_id=p.recall_id AND member.organization_id=p.organization_id) AS email_statuses`,
  },
  holdings: {
    key: 'h.id',
    from: "FROM recall_safety_holds hold JOIN batch_holdings h ON h.id=hold.entity_id AND hold.entity_type='holding'",
    where:
      "hold.recall_id=$1::uuid AND h.status<>'transferred' AND h.quantity_kg>0 AND ($2::boolean OR h.holder_organization_id=$3::uuid)",
    search: "concat_ws(' ',h.id,h.batch_id,h.warehouse_location)",
    select: `h.id,h.batch_id,h.quantity_kg,h.holder_organization_id,
      (SELECT row_to_json(recovery) FROM recall_recovery_records recovery WHERE recovery.recall_id=$1::uuid AND recovery.holding_id=h.id) AS recovery`,
  },
  recoveries: {
    key: 'recovery.holding_id',
    from: 'FROM recall_recovery_records recovery JOIN batch_holdings h ON h.id=recovery.holding_id',
    where: 'recovery.recall_id=$1::uuid AND ($2::boolean OR h.holder_organization_id=$3::uuid)',
    search: "concat_ws(' ',recovery.holding_id,recovery.note)",
    select: 'recovery.*,recovery.holding_id AS id',
  },
  evidence: {
    key: 'e.id',
    from: 'FROM evidence_items e',
    where:
      "e.linked_entity_type='recall' AND e.linked_entity_id=$1::uuid AND e.validation_status='validated' AND e.malware_scan_status='clean' AND $4::boolean",
    search: "concat_ws(' ',e.id,e.file_name)",
    select: 'e.id,e.file_name',
  },
} as const;

export function responseInputs(
  parameters: Record<string, unknown>,
  actor: ResponseActor,
  id: string,
  canManage: boolean,
) {
  const allowed = [
    'limit',
    'selectedHoldingId',
    ...responseCollections.flatMap((name) => [`${name}Cursor`, `${name}Search`]),
  ];
  if (Object.keys(parameters).some((name) => !allowed.includes(name)))
    throw new ValidationError('Unknown response page parameter');
  if (
    parameters.selectedHoldingId !== undefined &&
    (typeof parameters.selectedHoldingId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        parameters.selectedHoldingId,
      ))
  )
    throw new ValidationError('Invalid selected holding identifier');
  return Object.fromEntries(
    responseCollections.map((name) => [
      name,
      parsePage(
        {
          limit: parameters.limit,
          ...(parameters[`${name}Cursor`] !== undefined
            ? { cursor: parameters[`${name}Cursor`] }
            : {}),
          ...(parameters[`${name}Search`] !== undefined
            ? { search: parameters[`${name}Search`] }
            : {}),
        },
        [
          'recall-response',
          id,
          actor.id,
          actor.organizationId,
          canManage,
          actor.permissions.slice().sort(),
          name,
        ],
        [],
      ),
    ]),
  ) as Record<Collection, PageInput>;
}

export async function responseCollection(
  execute: Execute,
  name: Collection,
  params: unknown[],
  input: PageInput,
  hydrate = true,
) {
  const d = definitions[name];
  const candidates = `SELECT ${d.key} AS id ${d.from} WHERE ${d.where} AND ($2::boolean OR NOT $2::boolean) AND $3::uuid IS NOT NULL AND ($4::boolean OR NOT $4::boolean)
    AND ($5::uuid IS NULL OR ${d.key}>$5::uuid)
    AND ($6::text='' OR ${d.search} ILIKE $7::text ESCAPE '\\')
    ORDER BY ${d.key} LIMIT $8::int`;
  const args = [
    ...params,
    input.cursor?.id || null,
    input.search,
    literal(input.search),
    input.limit + 1,
  ];
  if (!hydrate) return (await execute(candidates, args)).rows;
  const result = await execute(
    `WITH candidates AS MATERIALIZED (${candidates})
    SELECT ${d.select} ${d.from} JOIN candidates candidate ON candidate.id=${d.key}
    WHERE ${d.where} AND ($2::boolean OR NOT $2::boolean) AND $3::uuid IS NOT NULL AND ($4::boolean OR NOT $4::boolean) ORDER BY ${d.key}`,
    args,
  );
  return result.rows;
}

export async function readRecallResponse(
  execute: Execute,
  actor: ResponseActor,
  id: string,
  parameters: Record<string, unknown> = {},
) {
  const notice = (
    await execute(
      `SELECT notice.* FROM recall_notices notice WHERE notice.id=$1::uuid AND
    ($2::boolean OR notice.initiated_by_organization_id=$3::uuid OR EXISTS(SELECT 1 FROM recall_participants p WHERE p.recall_id=notice.id AND p.organization_id=$3::uuid))`,
      [
        id,
        actor.permissions.some((p) => p === '*' || p === 'recall.manage.all'),
        actor.organizationId,
      ],
    )
  ).rows[0];
  if (!notice) throw new NotFoundError('Recall');
  const canManage =
    actor.permissions.some((p) => p === '*' || p === 'recall.manage.all') ||
    (notice.initiated_by_organization_id === actor.organizationId &&
      actor.permissions.includes('recall.manage'));
  const params = [
    id,
    canManage,
    actor.organizationId,
    actor.permissions.some((p) => ['*', 'evidence.read', 'evidence.read.all'].includes(p)),
  ];
  const paged = Object.keys(parameters).length > 0;
  const inputs = responseInputs(parameters, actor, id, canManage);
  if (!paged) {
    // Reject overflow using IDs only, before participant/outbox or recovery projections.
    for (const name of responseCollections) {
      inputs[name].limit = 1000;
      const candidates = await responseCollection(execute, name, params, inputs[name], false);
      if (candidates.length > 1000)
        throw new AppError(
          'Recall response exceeds the legacy limit. Use paged response collections.',
          422,
          'CATALOG_READ_LIMIT',
        );
    }
  }
  const result: Record<string, unknown> = {
    notice,
    canManage,
    myOrganizationId: actor.organizationId,
  };
  const paging: Record<string, unknown> = {};
  for (const name of responseCollections) {
    const rows = await responseCollection(execute, name, params, inputs[name]);
    const page = pageResult(rows, inputs[name]);
    result[name] = page.items;
    if (paged) {
      const d = definitions[name];
      const total = (
        await execute(
          `SELECT COUNT(*)::int AS count ${d.from} WHERE ${d.where} AND ($2::boolean OR NOT $2::boolean) AND $3::uuid IS NOT NULL AND ($4::boolean OR NOT $4::boolean)`,
          params,
        )
      ).rows[0];
      paging[name] = { nextCursor: page.nextCursor, hasMore: page.hasMore, count: total.count };
    }
  }
  if (parameters.selectedHoldingId !== undefined) {
    const d = definitions.holdings;
    result.selectedHolding =
      (
        await execute(
          `SELECT ${d.select} ${d.from}
      WHERE ${d.where} AND h.id=$5::uuid AND ($4::boolean OR NOT $4::boolean) LIMIT 1`,
          [...params, parameters.selectedHoldingId],
        )
      ).rows[0] || null;
  }
  return { ...result, ...(paged ? { paging } : {}) };
}
export const recallResponseRead = (
  actor: ResponseActor,
  id: string,
  parameters: Record<string, unknown> = {},
) => withCatalogRead((execute) => readRecallResponse(execute, actor, id, parameters));
