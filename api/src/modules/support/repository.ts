import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { AppError, ConflictError, NotFoundError } from '../../errors';
import type { AuthenticatedActor } from '../../services/authSessionService';
import { recordAudit } from '../../services/auditWriter';
import { inDatabaseTransaction } from '../../services/databaseTransaction';
import { assertMutationAssurance } from '../mfa/assurance';
import { lockAccessDecisions } from '../mfa/reviewers';
import { literal, pageResult, parsePage, withCatalogRead } from '../catalog/paging';
import { bodyHash, type SupportInput, type SupportStatus } from './policy';
const fields = 'id,reference,subject,description,context,entity_id,status,created_at,updated_at';
async function lockActor(client: PoolClient, actor: AuthenticatedActor, admin = false) {
  await lockAccessDecisions(client);
  await assertMutationAssurance(client, actor);
  const live = await client.query(
    `SELECT u.id FROM users u JOIN organizations o ON o.id=u.organization_id JOIN sessions s ON s.user_id=u.id
    WHERE u.id=$1 AND u.organization_id=$2 AND s.id=$3 AND u.active AND u.access_suspended_at IS NULL
    AND o.access_suspended_at IS NULL AND o.verification_status='verified' AND s.revoked_at IS NULL AND s.expires_at>NOW()
    AND (NOT $4::boolean OR EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND '*'=ANY(r.permissions)))
    FOR SHARE OF u,o,s`,
    [actor.id, actor.organizationId, actor.sessionId, admin],
  );
  if (!live.rows[0]) throw new AppError('Account authorization changed', 403, 'FORBIDDEN');
  if (admin) {
    const fresh = await client.query(
      `SELECT s.id FROM sessions s JOIN user_passkeys k ON k.id=s.mfa_credential_id
      WHERE s.id=$1 AND s.user_id=$2 AND k.user_id=s.user_id AND k.revoked_at IS NULL
      AND s.mfa_verified_at>NOW()-INTERVAL '5 minutes' AND s.mfa_verified_at<=NOW() FOR SHARE OF s,k`,
      [actor.sessionId, actor.id],
    );
    if (!fresh.rows[0])
      throw new AppError('Fresh passkey verification required', 403, 'MFA_STEP_UP_REQUIRED');
  }
}
export async function createSupport(actor: AuthenticatedActor, input: SupportInput) {
  return inDatabaseTransaction(async (client) => {
    await lockActor(client, actor);
    const hash = bodyHash(input);
    const id = randomUUID();
    const inserted = await client.query(
      `INSERT INTO support_requests(id,reference,requester_user_id,organization_id,idempotency_key,body_hash,subject,description,context,entity_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(requester_user_id,idempotency_key) DO NOTHING RETURNING ${fields}`,
      [
        id,
        'BT-SUP-' + id,
        actor.id,
        actor.organizationId,
        input.idempotencyKey,
        hash,
        input.subject,
        input.description,
        input.context,
        input.entityId ?? null,
      ],
    );
    if (!inserted.rows[0]) {
      const prior = (
        await client.query(
          `SELECT ${fields},body_hash FROM support_requests WHERE requester_user_id=$1 AND organization_id=$2 AND idempotency_key=$3`,
          [actor.id, actor.organizationId, input.idempotencyKey],
        )
      ).rows[0];
      if (!prior || prior.body_hash !== hash)
        throw new ConflictError('Idempotency key was already used for a different request');
      const { body_hash: _hash, ...record } = prior;
      return { record, replayed: true };
    }
    await recordAudit(client, actor, 'support.request.created', 'support_request', id, {
      reference: 'BT-SUP-' + id,
      context: input.context,
      entityId: input.entityId ?? null,
    });
    return { record: inserted.rows[0], replayed: false };
  });
}
export async function supportPage(
  actor: AuthenticatedActor,
  parameters: Record<string, unknown>,
  admin = false,
) {
  const input = parsePage(
    parameters,
    ['support', admin ? 'admin' : 'requester', actor.id, actor.organizationId],
    [],
  );
  return withCatalogRead(async (execute) => {
    const values = [actor.id, actor.organizationId, literal(input.search)];
    const where = `${admin ? 'TRUE' : '(requester_user_id=$1 AND organization_id=$2)'} AND (subject ILIKE $3 OR reference ILIKE $3)`;
    // Keep parameter numbering stable for the platform-wide scope too.
    const scoped = admin ? `($1::uuid IS NOT NULL AND $2::uuid IS NOT NULL) AND ${where}` : where;
    const count = await execute(
      `SELECT count(*)::text AS total FROM support_requests WHERE ${scoped}`,
      values,
    );
    const rows = await execute(
      `SELECT ${fields}${admin ? ',requester_user_id,organization_id,operator_note' : ''} FROM support_requests WHERE ${scoped}
      AND ($4::uuid IS NULL OR id<$4) ORDER BY id DESC LIMIT $5`,
      [...values, input.cursor?.id ?? null, input.limit + 1],
    );
    const total = Number(count.rows[0].total);
    if (!Number.isSafeInteger(total) || total < 0)
      throw new AppError('Support count exceeds the supported range', 422, 'SUPPORT_COUNT_LIMIT');
    return { ...pageResult(rows.rows, input), total };
  });
}
export async function supportDetail(actor: AuthenticatedActor, id: string) {
  return withCatalogRead(async (execute) => {
    const result = await execute(
      `SELECT ${fields} FROM support_requests WHERE id=$1 AND requester_user_id=$2 AND organization_id=$3`,
      [id, actor.id, actor.organizationId],
    );
    if (!result.rows[0]) throw new NotFoundError('Support request');
    return result.rows[0];
  });
}
export async function reviewSupport(
  actor: AuthenticatedActor,
  id: string,
  status: SupportStatus,
  expectedStatus: SupportStatus,
  reason: string,
) {
  return inDatabaseTransaction(async (client) => {
    await lockActor(client, actor, true);
    const prior = (
      await client.query('SELECT status FROM support_requests WHERE id=$1 FOR UPDATE', [id])
    ).rows[0];
    if (!prior) throw new NotFoundError('Support request');
    if (prior.status !== expectedStatus)
      throw new ConflictError('Support status changed; reload before reviewing');
    const record = (
      await client.query(
        `UPDATE support_requests SET status=$2,operator_note=$3,updated_at=NOW() WHERE id=$1 RETURNING ${fields},requester_user_id,organization_id,operator_note`,
        [id, status, reason],
      )
    ).rows[0];
    await recordAudit(client, actor, 'support.request.reviewed', 'support_request', id, {
      previousStatus: prior.status,
      status,
      reason,
    });
    return record;
  });
}
