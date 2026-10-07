import { Request, Response } from 'express';
import { AppError, ValidationError } from '../../errors';
import { activeBatchRecallSql } from '../recall/safety';
import { Execute, literal, pageResult, parsePage, text, withCatalogRead } from './paging';

const transferSelect = `SELECT ct.*,o.name AS from_org_name,dest.name AS to_org_name,h.warehouse_location,b.crop,
  ${activeBatchRecallSql('h.batch_id')} AS "activeRecall"`;
const transferFrom = `FROM custody_transfers ct JOIN organizations o ON o.id=ct.from_organization_id
  JOIN organizations dest ON dest.id=ct.to_organization_id JOIN batch_holdings h ON h.id=ct.holding_id
  JOIN harvest_batches b ON b.id=h.batch_id`;
export function transferFilters(parameters: Record<string, unknown>) {
  const direction = text(parameters.direction, 'transfer direction', 8) || 'incoming';
  const status = text(parameters.status, 'transfer status', 9) || 'requested';
  if (!['incoming', 'outgoing', 'all'].includes(direction))
    throw new ValidationError('Invalid transfer direction');
  if (!['requested', 'accepted', 'all'].includes(status))
    throw new ValidationError('Invalid transfer status');
  return { direction, status };
}
export async function transferPage(
  execute: Execute,
  organizationId: string,
  parameters: Record<string, unknown>,
) {
  const filters = transferFilters(parameters);
  const input = parsePage(
    parameters,
    ['transfers', organizationId, filters],
    ['direction', 'status'],
  );
  const result = await execute(
    `${transferSelect} ${transferFrom}
    WHERE (ct.to_organization_id=$1::uuid OR ct.from_organization_id=$1::uuid)
    AND ($2::uuid IS NULL OR ct.id>$2::uuid)
    AND ($3::text='all' OR ($3::text='incoming' AND ct.to_organization_id=$1::uuid) OR ($3::text='outgoing' AND ct.from_organization_id=$1::uuid))
    AND ($4::text='all' OR ct.status=$4::text)
    AND ($5::text='' OR concat_ws(' ',ct.id,ct.holding_id,o.name,dest.name,h.warehouse_location,b.crop) ILIKE $6::text ESCAPE '\\')
    ORDER BY ct.id ASC LIMIT $7::int`,
    [
      organizationId,
      input.cursor?.id || null,
      filters.direction,
      filters.status,
      input.search,
      literal(input.search),
      input.limit + 1,
    ],
  );
  return pageResult(result.rows, input);
}
export async function listTransferPage(req: Request, res: Response) {
  res.json(
    await withCatalogRead((execute) => transferPage(execute, req.user!.organizationId, req.query)),
  );
}
export async function legacyTransferList(execute: Execute, organizationId: string) {
  const result = await execute(
    `${transferSelect} ${transferFrom}
    WHERE ct.to_organization_id=$1::uuid OR ct.from_organization_id=$1::uuid
    ORDER BY ct.requested_at DESC,ct.id DESC LIMIT 1001`,
    [organizationId],
  );
  if (result.rows.length > 1000)
    throw new AppError(
      'Transfer history exceeds the legacy limit. Use the paged transfer view.',
      422,
      'CATALOG_READ_LIMIT',
    );
  return result.rows;
}
