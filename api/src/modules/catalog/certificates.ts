import { Request, Response } from 'express';
import { AppError, ValidationError } from '../../errors';
import { Actor, hasExplicitPermission } from '../../services/resourcePolicy';
import { Execute, literal, pageResult, parsePage, text, withCatalogRead } from './paging';
const from = `FROM organic_certificates c JOIN organizations o ON o.id=c.certifier_organization_id`;
const visible = `($2::boolean OR c.certifier_organization_id=$1::uuid OR c.farmer_organization_id=$1::uuid OR EXISTS (
 SELECT 1 FROM harvest_batches b JOIN batch_holdings h ON h.batch_id=b.id JOIN sales_contracts sc ON sc.holding_id=h.id
 WHERE b.farm_id=c.farm_id AND (sc.seller_organization_id=$1::uuid OR sc.buyer_organization_id=$1::uuid)))`;
const select = 'SELECT c.*,o.name AS certifier_name';
function filters(parameters: Record<string, unknown>) {
  const farm = text(parameters.farmId, 'farm identifier', 36);
  if (farm && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(farm))
    throw new ValidationError('Invalid farm identifier');
  const status = text(parameters.status, 'certificate status', 12) || 'all';
  if (!['all', 'active', 'suspended', 'revoked', 'expired'].includes(status))
    throw new ValidationError('Invalid certificate status');
  return { farm, status };
}
export async function certificatePage(
  execute: Execute,
  actor: Actor,
  parameters: Record<string, unknown>,
) {
  const filter = filters(parameters),
    all = hasExplicitPermission(actor, 'certificate.read.all');
  const input = parsePage(
    parameters,
    ['certificates', actor.organizationId, all, filter],
    ['farmId', 'status'],
  );
  const result = await execute(
    `${select} ${from} WHERE ${visible}
 AND ($3::uuid IS NULL OR c.farm_id=$3::uuid) AND ($4::text='all' OR c.status=$4::text)
 AND ($5::uuid IS NULL OR c.id>$5::uuid)
 AND ($6::text='' OR concat_ws(' ',c.id,c.farm_id,c.standard,c.status,c.issuing_authority,c.accreditation_reference,o.name,array_to_string(c.crop_scope,' ')) ILIKE $7::text ESCAPE '\\')
 ORDER BY c.id LIMIT $8::int`,
    [
      actor.organizationId,
      all,
      filter.farm || null,
      filter.status,
      input.cursor?.id || null,
      input.search,
      literal(input.search),
      input.limit + 1,
    ],
  );
  return pageResult(result.rows, input);
}
export async function certificateSummary(
  execute: Execute,
  actor: Actor,
  parameters: Record<string, unknown> = {},
) {
  if (Object.keys(parameters).some((key) => key !== 'farmId'))
    throw new ValidationError('Unknown certificate totals parameter');
  const { farm } = filters(parameters);
  return (
    await execute(
      `SELECT COUNT(*)::int AS count,
 COUNT(*) FILTER(WHERE c.status='active')::int AS active_count,
 COUNT(*) FILTER(WHERE c.status='suspended')::int AS suspended_count,
 COUNT(*) FILTER(WHERE c.status='revoked')::int AS revoked_count,
 COUNT(*) FILTER(WHERE c.status='expired')::int AS expired_count ${from} WHERE ${visible} AND ($3::uuid IS NULL OR c.farm_id=$3::uuid)`,
      [actor.organizationId, hasExplicitPermission(actor, 'certificate.read.all'), farm || null],
    )
  ).rows[0];
}
export async function legacyCertificates(
  execute: Execute,
  actor: Actor,
  parameters: Record<string, unknown>,
) {
  if (Object.keys(parameters).some((key) => key !== 'farmId'))
    throw new ValidationError('Unknown certificate parameter');
  const { farm } = filters(parameters);
  const result = await execute(
    `${select} ${from} WHERE ${visible} AND ($3::uuid IS NULL OR c.farm_id=$3::uuid) ORDER BY c.valid_to DESC,c.id DESC LIMIT 1001`,
    [actor.organizationId, hasExplicitPermission(actor, 'certificate.read.all'), farm || null],
  );
  if (result.rows.length > 1000)
    throw new AppError(
      'Certificate history exceeds the legacy limit. Use the paged certificate register.',
      422,
      'CATALOG_READ_LIMIT',
    );
  return result.rows;
}
export async function listCertificatePage(req: Request, res: Response) {
  res.json(await withCatalogRead((execute) => certificatePage(execute, req.user!, req.query)));
}
export async function summarizeCertificates(req: Request, res: Response) {
  res.json(await withCatalogRead((execute) => certificateSummary(execute, req.user!, req.query)));
}

// Called only after the enclosing farm relationship has been checked.
export async function farmCertificateCollection(
  execute: Execute,
  actor: Actor,
  farmId: string,
  mode: unknown,
) {
  if (mode !== undefined && mode !== 'paged')
    throw new ValidationError('Invalid certificate collection mode');
  if (!hasExplicitPermission(actor, 'certificate.read'))
    return { certificates: null, certificate_collection: 'unavailable' };
  if (mode === 'paged') return { certificates: null, certificate_collection: 'paged' };
  return {
    certificates: await legacyCertificates(execute, actor, { farmId }),
    certificate_collection: 'legacy',
  };
}
