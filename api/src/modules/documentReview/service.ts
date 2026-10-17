import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { JwtPayload } from '../../middleware/auth';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../errors';
import { inDatabaseTransaction } from '../../services/databaseTransaction';
import { recordAudit } from '../../services/auditWriter';
import { assertOperator } from '../operations/recovery';
import { assertMutationAssurance } from '../mfa/assurance';
import { canAccessEvidenceEntity, type EvidenceEntityType } from '../../services/resourcePolicy';
import { requireDocumentRole } from '../../services/evidenceUploadService';
import {
  evidenceAvailabilityProjection,
  preflightEvidence,
} from '../../services/evidenceAvailability';

type Row = Record<string, unknown>;
const tables: Record<string, string> = {
  batch: 'harvest_batches',
  farm: 'farms',
  certificate: 'organic_certificates',
  contract: 'sales_contracts',
  shipment: 'shipments',
  recall: 'recall_notices',
  product_profile: 'product_profiles',
};
const projection = `id,type,file_name,sha256_hash,linked_entity_type,linked_entity_id,uploader_organization_id,review_status,review_revision,validation_status,malware_scan_status,superseded_by_evidence_id,replaces_evidence_id,created_at`;
export function fingerprint(row: Row): string {
  return createHash('sha256')
    .update(
      JSON.stringify(
        [
          'id',
          'sha256_hash',
          'linked_entity_type',
          'linked_entity_id',
          'uploader_organization_id',
          'review_status',
          'review_revision',
          'validation_status',
          'malware_scan_status',
          'superseded_by_evidence_id',
          'replaces_evidence_id',
        ].map((k) => row[k] ?? null),
      ),
    )
    .digest('hex');
}
function publicRow(row: Row): Row {
  return Object.fromEntries([
    ...projection.split(',').map((k) => [k, row[k]]),
    ['fingerprint', fingerprint(row)],
  ]);
}
async function source(client: PoolClient, row: Row): Promise<void> {
  const table = tables[String(row.linked_entity_type)];
  if (
    !table ||
    !(await client.query(`SELECT id FROM ${table} WHERE id=$1 FOR SHARE`, [row.linked_entity_id]))
      .rows.length
  )
    throw new NotFoundError('Evidence source');
}
async function load(client: PoolClient, id: string): Promise<Row> {
  const row = (
    await client.query(
      `SELECT e.*,${evidenceAvailabilityProjection('e')} FROM evidence_items e WHERE e.id=$1 FOR UPDATE`,
      [id],
    )
  ).rows[0] as Row | undefined;
  if (!row) throw new NotFoundError('Evidence');
  await source(client, row);
  return row;
}
async function liveUploader(client: PoolClient, actor: JwtPayload): Promise<void> {
  await assertMutationAssurance(client, actor);
  const allowed = await client.query(
    `SELECT s.id FROM sessions s JOIN users u ON u.id=s.user_id JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE s.id=$1 AND u.id=$2 AND u.organization_id=$3 AND s.revoked_at IS NULL AND s.expires_at>NOW() AND ('*'=ANY(r.permissions) OR 'evidence.upload'=ANY(r.permissions)) FOR SHARE OF s,ur,r`,
    [actor.sessionId, actor.id, actor.organizationId],
  );
  if (!allowed.rows.length) throw new ForbiddenError('Current upload authority required');
}
export async function reviewPage(
  actor: JwtPayload,
  input: { limit: number; cursor?: string; status: string; id?: string },
) {
  return inDatabaseTransaction(async (client) => {
    await assertOperator(client, actor);
    const rows = (
      await client.query(
        `SELECT ${projection} FROM evidence_items e WHERE (review_status=$1 OR ($1='pending' AND review_status='submitted')) AND superseded_by_evidence_id IS NULL AND uploader_organization_id<>$2 AND ($3::uuid IS NULL OR id<$3) AND ($5::uuid IS NULL OR id=$5) ORDER BY id DESC LIMIT $4`,
        [
          input.status,
          actor.organizationId,
          input.cursor ?? null,
          input.limit + 1,
          input.id ?? null,
        ],
      )
    ).rows as Row[];
    // Existence is rechecked for every selected row; orphaned polymorphic links never become reviewable.
    const items: Row[] = [];
    for (const row of rows.slice(0, input.limit)) {
      try {
        await source(client, row);
        items.push(publicRow(row));
      } catch (error) {
        if (!(error instanceof NotFoundError)) throw error;
      }
    }
    return {
      items,
      hasMore: rows.length > input.limit,
      nextCursor: rows.length > input.limit ? String(rows[input.limit - 1].id) : null,
    };
  });
}
export async function reviewDetail(actor: JwtPayload, id: string) {
  return inDatabaseTransaction(async (client) => {
    const row = await load(client, id);
    if (actor.permissions.includes('*')) await assertOperator(client, actor);
    else if (
      row.uploader_organization_id !== actor.organizationId ||
      !(await canAccessEvidenceEntity(
        actor,
        row.linked_entity_type as EvidenceEntityType,
        String(row.linked_entity_id),
        null,
        client.query.bind(client),
      ))
    )
      throw new NotFoundError('Evidence');
    const history = (
      await client.query(
        `SELECT id,decision,reason,actor_user_id,actor_organization_id,source_hash,created_at FROM evidence_review_decisions WHERE evidence_id=$1 ORDER BY revision DESC LIMIT 101`,
        [id],
      )
    ).rows;
    if (history.length > 100)
      throw new ConflictError(
        'Review history exceeds the supported complete history limit. Contact the operator.',
      );
    const replacements = (
      await client.query(
        `SELECT id,file_name,review_status FROM evidence_items WHERE id=ANY($1::uuid[])`,
        [[row.superseded_by_evidence_id, row.replaces_evidence_id].filter(Boolean)],
      )
    ).rows;
    return { evidence: publicRow(row), history, replacements, fingerprint: fingerprint(row) };
  });
}
export async function decide(
  actor: JwtPayload,
  id: string,
  input: { decision: 'approved' | 'rejected'; reason: string; expectedFingerprint: string },
) {
  // Authorize metadata before probing the private provider; provider I/O never holds a transaction open.
  await inDatabaseTransaction(async (client) => {
    await assertOperator(client, actor);
    const row = await load(client, id);
    if (row.uploader_organization_id === actor.organizationId)
      throw new ForbiddenError('Independent reviewer required');
  });
  const availability =
    input.decision === 'approved'
      ? await preflightEvidence(
          async (execute) =>
            (
              await execute(
                `SELECT ${evidenceAvailabilityProjection('e')} FROM evidence_items e WHERE e.id=$1`,
                [id],
              )
            ).rows,
        )
      : undefined;
  return inDatabaseTransaction(async (client) => {
    await assertOperator(client, actor);
    const row = await load(client, id);
    if (row.uploader_organization_id === actor.organizationId)
      throw new ForbiddenError('Independent reviewer required');
    const prior = (
      await client.query(
        `SELECT decision,reason,revision FROM evidence_review_decisions WHERE evidence_id=$1 AND expected_fingerprint=$2 AND actor_user_id=$3`,
        [id, input.expectedFingerprint, actor.id],
      )
    ).rows[0];
    if (
      prior &&
      prior.decision === input.decision &&
      prior.reason === input.reason &&
      Number(prior.revision) === Number(row.review_revision) &&
      row.review_status === input.decision &&
      !row.superseded_by_evidence_id
    )
      return { evidence: publicRow(row), decision: prior, changed: false };
    if (fingerprint(row) !== input.expectedFingerprint || row.superseded_by_evidence_id)
      throw new ConflictError('Evidence changed. Review the current document again.');
    if (
      input.decision === 'approved' &&
      (row.validation_status !== 'validated' ||
        row.malware_scan_status !== 'clean' ||
        !availability?.available(row))
    )
      throw new ConflictError('Current clean available evidence required');
    const decision = (
      await client.query(
        `INSERT INTO evidence_review_decisions(evidence_id,decision,reason,actor_user_id,actor_organization_id,source_hash,linked_entity_type,linked_entity_id,expected_fingerprint,revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,decision,reason,source_hash,created_at`,
        [
          id,
          input.decision,
          input.reason,
          actor.id,
          actor.organizationId,
          row.sha256_hash,
          row.linked_entity_type,
          row.linked_entity_id,
          input.expectedFingerprint,
          Number(row.review_revision) + 1,
        ],
      )
    ).rows[0];
    const updated = (
      await client.query(
        `UPDATE evidence_items SET review_status=$2,review_revision=review_revision+1 WHERE id=$1 RETURNING *`,
        [id, input.decision],
      )
    ).rows[0];
    await recordAudit(client, actor, 'evidence.review.decided', 'evidence', id, {
      decision: input.decision,
      decisionId: decision.id,
      sourceHash: row.sha256_hash,
    });
    return { evidence: publicRow(updated), decision, changed: true };
  });
}
export async function replace(
  actor: JwtPayload,
  id: string,
  input: { replacementEvidenceId: string; expectedFingerprint: string },
) {
  if (id === input.replacementEvidenceId) throw new ValidationError('Choose a new upload');
  return inDatabaseTransaction(async (client) => {
    await liveUploader(client, actor);
    const ids = [id, input.replacementEvidenceId].sort();
    const loaded = new Map<string, Row>();
    for (const key of ids) loaded.set(key, await load(client, key));
    const old = loaded.get(id)!;
    const next = loaded.get(input.replacementEvidenceId)!;
    if (
      old.uploader_organization_id !== actor.organizationId ||
      next.uploader_organization_id !== actor.organizationId ||
      !(await canAccessEvidenceEntity(
        actor,
        old.linked_entity_type as EvidenceEntityType,
        String(old.linked_entity_id),
        null,
        client.query.bind(client),
      ))
    )
      throw new ForbiddenError('Only the current uploader organization can replace evidence');
    await requireDocumentRole(
      actor,
      {
        type: String(old.type),
        linkedEntityType: old.linked_entity_type as EvidenceEntityType,
        linkedEntityId: String(old.linked_entity_id),
      },
      client.query.bind(client),
    );
    if (old.superseded_by_evidence_id === next.id && next.replaces_evidence_id === old.id)
      return { evidence: publicRow(next), changed: false };
    if (
      fingerprint(old) !== input.expectedFingerprint ||
      old.superseded_by_evidence_id ||
      next.replaces_evidence_id ||
      next.superseded_by_evidence_id ||
      old.replaces_evidence_id === next.id ||
      !['pending', 'submitted'].includes(String(next.review_status)) ||
      Number(next.review_revision) !== 0 ||
      next.linked_entity_id !== old.linked_entity_id ||
      next.linked_entity_type !== old.linked_entity_type ||
      next.type !== old.type ||
      new Date(String(next.created_at)) < new Date(String(old.created_at))
    )
      throw new ConflictError(
        'Replacement must be a new pending upload for the same source and document type',
      );
    await client.query(
      'UPDATE evidence_items SET superseded_by_evidence_id=$2,review_revision=review_revision+1 WHERE id=$1',
      [id, next.id],
    );
    const updated = (
      await client.query(
        "UPDATE evidence_items SET replaces_evidence_id=$2,review_status='pending',review_revision=review_revision+1 WHERE id=$1 RETURNING *",
        [next.id, id],
      )
    ).rows[0];
    await recordAudit(client, actor, 'evidence.version.replaced', 'evidence', id, {
      replacementEvidenceId: next.id,
      oldHash: old.sha256_hash,
      newHash: next.sha256_hash,
    });
    return { evidence: publicRow(updated), changed: true };
  });
}
