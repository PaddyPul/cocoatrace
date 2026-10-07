import { Request, Response } from 'express';
import { AppError, ForbiddenError, ValidationError } from '../../errors';
import {
  Actor,
  canAccessEvidenceEntity,
  EVIDENCE_ENTITY_TYPES,
  EvidenceEntityType,
  hasExplicitPermission,
} from '../../services/resourcePolicy';
import { Execute, literal, pageResult, parsePage, text, withCatalogRead } from './paging';

// Metadata only: never expose storage paths, signed URLs or uploader identity.
const columns = `id,type,file_name,file_size_bytes,mime_type,detected_mime_type,
  sha256_hash,validation_status,malware_scan_status,malware_scanner_engine,malware_scanned_at,
  review_status,linked_entity_type,linked_entity_id,claim_description,created_at`;

async function scope(execute: Execute, actor: Actor, parameters: Record<string, unknown>) {
  const entityType = text(parameters.entityType, 'entity type', 32);
  const entityId = text(parameters.entityId, 'entity identifier', 36);
  if (
    Boolean(entityType) !== Boolean(entityId) ||
    (entityType &&
      (!(EVIDENCE_ENTITY_TYPES as readonly string[]).includes(entityType) ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entityId)))
  )
    throw new ValidationError('A supported entityType and entityId are required together');
  const all = hasExplicitPermission(actor, 'evidence.read.all');
  if (
    entityType &&
    !(await canAccessEvidenceEntity(
      actor,
      entityType as EvidenceEntityType,
      entityId,
      'evidence.read.all',
      execute,
    ))
  )
    throw new ForbiddenError('You do not have access to this evidence record');
  return { entityType, entityId, all };
}
const visible = `(($3::text<>'' AND linked_entity_type=$3::text AND linked_entity_id=$4::uuid)
  OR ($3::text='' AND ($2::boolean OR uploader_organization_id=$1::uuid)))`;

export async function evidencePage(
  execute: Execute,
  actor: Actor,
  parameters: Record<string, unknown>,
) {
  const { entityType, entityId, all } = await scope(execute, actor, parameters);
  const input = parsePage(
    parameters,
    ['evidence', actor.organizationId, all, entityType, entityId],
    ['entityType', 'entityId'],
  );
  const rows = (
    await execute(
      `SELECT ${columns} FROM evidence_items WHERE ${visible}
    AND ($5::uuid IS NULL OR id>$5::uuid)
    AND ($6::text='' OR concat_ws(' ',id,file_name,type,linked_entity_type,linked_entity_id,review_status) ILIKE $7::text ESCAPE '\\')
    ORDER BY id LIMIT $8::int`,
      [
        actor.organizationId,
        all,
        entityType,
        entityId || null,
        input.cursor?.id || null,
        input.search,
        literal(input.search),
        input.limit + 1,
      ],
    )
  ).rows;
  return pageResult(rows, input);
}
export async function legacyEvidenceList(
  execute: Execute,
  actor: Actor,
  parameters: Record<string, unknown>,
) {
  const { entityType, entityId, all } = await scope(execute, actor, parameters);
  const rows = (
    await execute(
      `SELECT ${columns} FROM evidence_items WHERE ${visible} ORDER BY created_at DESC,id LIMIT 1001`,
      [actor.organizationId, all, entityType, entityId || null],
    )
  ).rows;
  if (rows.length > 1000)
    throw new AppError(
      'Evidence list exceeds the legacy limit. Use the paged evidence view.',
      422,
      'CATALOG_READ_LIMIT',
    );
  return rows;
}
export async function listEvidencePage(req: Request, res: Response) {
  res.json(await withCatalogRead((execute) => evidencePage(execute, req.user!, req.query)));
}
