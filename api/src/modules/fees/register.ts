import { ValidationError } from '../../errors';
import {
  literal,
  pageResult,
  parsePage,
  text,
  withCatalogRead,
  type Execute,
} from '../catalog/paging';
import { feeProjection, isFinanceAdmin, type FeeActor } from './ledger';

export function feeFilters(parameters: Record<string, unknown>) {
  const status = text(parameters.status, 'fee status', 20) || 'all';
  if (
    !['all', 'estimated', 'invoiced', 'paid', 'written_off', 'cancelled', 'waived'].includes(status)
  )
    throw new ValidationError('Invalid fee status');
  const review = text(parameters.review, 'fee review filter', 10) || 'all';
  if (!['all', 'pending'].includes(review)) throw new ValidationError('Invalid fee review filter');
  const date = (value: unknown) => {
    const result = text(value, 'fee date', 10);
    if (
      result &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(result) ||
        !Number.isFinite(Date.parse(result)) ||
        new Date(result).toISOString().slice(0, 10) !== result)
    )
      throw new ValidationError('Fee dates must be valid YYYY-MM-DD values');
    return result;
  };
  const from = date(parameters.from),
    to = date(parameters.to);
  if (from && to && from > to) throw new ValidationError('Fee date range is reversed');
  return { status, review, from, to };
}
export async function feeRegister(
  execute: Execute,
  actor: FeeActor,
  parameters: Record<string, unknown>,
) {
  const filters = feeFilters(parameters);
  const admin = isFinanceAdmin(actor);
  const input = parsePage(
    parameters,
    ['fee-register', actor.organizationId, admin, filters],
    ['status', 'review', 'from', 'to'],
    ['newest'],
  );
  const pending =
    "EXISTS(SELECT 1 FROM platform_fee_submissions fs WHERE fs.fee_id=f.id AND fs.status='submitted')";
  const result = await execute(
    `${feeProjection}
    WHERE ($2::boolean OR f.payer_organization_id=$1::uuid)
      AND ($3::text='all' OR f.status=$3::text)
      AND ($4::text='all' OR ${pending})
      AND ($5::text='' OR f.created_at >= NULLIF($5,'')::date::timestamp AT TIME ZONE 'UTC')
      AND ($6::text='' OR f.created_at < (NULLIF($6,'')::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'UTC')
      AND ($7::text='' OR concat_ws(' ',f.id,f.contract_id,s.name,b.name,f.currency) ILIKE $8::text ESCAPE '\\')
      AND ($9::numeric IS NULL OR (EXTRACT(EPOCH FROM f.created_at),f.id)<($9::numeric,$10::uuid))
    ORDER BY f.created_at DESC,f.id DESC LIMIT $11::int`,
    [
      actor.organizationId,
      admin,
      filters.status,
      filters.review,
      filters.from,
      filters.to,
      input.search,
      literal(input.search),
      input.cursor?.key || null,
      input.cursor?.id || null,
      input.limit + 1,
    ],
  );
  return pageResult(result.rows, input, 'created_key');
}
export function readFeeRegister(actor: FeeActor, parameters: Record<string, unknown>) {
  return withCatalogRead((execute) => feeRegister(execute, actor, parameters));
}
