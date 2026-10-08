import { Request, Response } from 'express';
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '../../errors';
import { Actor, hasExplicitPermission, hasFarmRelationship } from '../../services/resourcePolicy';
import { Execute, literal, pageResult, parsePage, withCatalogRead } from './paging';
async function authorize(execute: Execute, actor: Actor, farmId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(farmId))
    throw new ValidationError('Invalid farm identifier');
  if (!(await execute('SELECT id FROM farms WHERE id=$1::uuid', [farmId])).rows[0])
    throw new NotFoundError('Farm');
  if (
    !hasExplicitPermission(actor, 'farm.read.all') &&
    !(await hasFarmRelationship(actor, farmId, execute))
  )
    throw new ForbiddenError('Farm access denied');
}
export async function plotPage(
  execute: Execute,
  actor: Actor,
  farmId: string,
  parameters: Record<string, unknown>,
) {
  const input = parsePage(
    parameters,
    ['farm-plots', actor.organizationId, hasExplicitPermission(actor, 'farm.read.all'), farmId],
    [],
  );
  await authorize(execute, actor, farmId);
  return pageResult(
    (
      await execute(
        `SELECT * FROM farm_plots WHERE farm_id=$1::uuid AND ($2::uuid IS NULL OR id>$2::uuid)
 AND ($3::text='' OR concat_ws(' ',id,plot_code,array_to_string(crops,' ')) ILIKE $4::text ESCAPE '\\') ORDER BY id LIMIT $5::int`,
        [farmId, input.cursor?.id || null, input.search, literal(input.search), input.limit + 1],
      )
    ).rows,
    input,
  );
}
export async function plotSummary(
  execute: Execute,
  actor: Actor,
  farmId: string,
  parameters: Record<string, unknown>,
) {
  if (Object.keys(parameters).length) throw new ValidationError('Plot totals accept no parameters');
  await authorize(execute, actor, farmId);
  return (
    await execute('SELECT COUNT(*)::int AS count FROM farm_plots WHERE farm_id=$1::uuid', [farmId])
  ).rows[0];
}
export async function farmPlotCollection(execute: Execute, farmId: string, mode: unknown) {
  if (mode !== undefined && mode !== 'paged')
    throw new ValidationError('Invalid plot collection mode');
  if (mode === 'paged') return { plots: null, plot_collection: 'paged' };
  const rows = (
    await execute(
      'SELECT * FROM farm_plots WHERE farm_id=$1::uuid ORDER BY plot_code,id LIMIT 1001',
      [farmId],
    )
  ).rows;
  if (rows.length > 1000)
    throw new AppError(
      'Plot history exceeds the legacy limit. Use paged farm details.',
      422,
      'CATALOG_READ_LIMIT',
    );
  return { plots: rows, plot_collection: 'legacy' };
}
export async function listPlotPage(req: Request, res: Response) {
  res.json(
    await withCatalogRead((execute) =>
      plotPage(execute, req.user!, req.params.id as string, req.query),
    ),
  );
}
export async function summarizePlots(req: Request, res: Response) {
  res.json(
    await withCatalogRead((execute) =>
      plotSummary(execute, req.user!, req.params.id as string, req.query),
    ),
  );
}
