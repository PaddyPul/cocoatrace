import type { PoolClient } from 'pg';
import type { AuthenticatedActor } from '../../services/authSessionService';
import { AppError, ConflictError, ValidationError } from '../../errors';
import { recordAudit } from '../../services/auditWriter';
import { timingBody } from './policy';
import { assertMutationAssurance } from '../mfa/assurance';
import { lockAccessDecisions } from '../mfa/reviewers';
export async function lockTimingActor(client: PoolClient, actor: AuthenticatedActor) {
  await lockAccessDecisions(client);
  await assertMutationAssurance(client, actor);
  const grants = (
    await client.query(
      `SELECT r.permissions FROM users u JOIN organizations o ON o.id=u.organization_id JOIN sessions s ON s.user_id=u.id JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE u.id=$1 AND o.id=$2 AND s.id=$3 AND u.active AND u.access_suspended_at IS NULL AND o.access_suspended_at IS NULL AND o.verification_status='verified' AND s.revoked_at IS NULL AND s.expires_at>NOW() FOR SHARE OF o,u,s,r,ur`,
      [actor.id, actor.organizationId, actor.sessionId],
    )
  ).rows.flatMap((row) => row.permissions as string[]);
  if (!grants.includes('*') && !grants.includes('shipment.update'))
    throw new AppError('Transport permission changed', 403, 'FORBIDDEN');
}

/** Caller holds current authority and contract locks. All ETA writes share this history boundary. */
export async function writeTiming(
  client: PoolClient,
  actor: AuthenticatedActor,
  id: string,
  etaArrival: string,
  reason?: string,
  expectedRevision?: number,
) {
  const shipment = (
    await client.query(
      'SELECT timing_revision,current_milestone,eta_arrival::text AS eta FROM shipments WHERE id=$1 FOR UPDATE',
      [id],
    )
  ).rows[0];
  if (!shipment) throw new AppError('Transport record unavailable', 404, 'NOT_FOUND');
  if (['arrived', 'customs_cleared', 'unloaded', 'delivered'].includes(shipment.current_milestone))
    throw new AppError('Arrival already recorded', 409, 'TRANSPORT_TIMING_CLOSED');
  if (etaArrival === shipment.eta && expectedRevision === undefined) return;
  const parsed = timingBody.safeParse({
    etaArrival,
    reason: reason ?? (shipment.eta === null ? 'Initial transport arrangement' : undefined),
    expectedRevision:
      expectedRevision ?? (shipment.eta === null ? shipment.timing_revision : undefined),
  });
  if (!parsed.success)
    throw new ValidationError(
      'Review a real arrival date, current timing revision and change reason before saving.',
    );
  const input = parsed.data;
  if (input.expectedRevision !== shipment.timing_revision)
    throw new ConflictError('Timing changed. Review the current timing before saving.');
  if (input.etaArrival === shipment.eta) return;
  const revision = shipment.timing_revision + 1;
  await client.query(
    'INSERT INTO shipment_timing_history(shipment_id,revision,eta_arrival,reason,actor_user_id,organization_id) VALUES($1,$2,$3,$4,$5,$6)',
    [id, revision, input.etaArrival, input.reason, actor.id, actor.organizationId],
  );
  await client.query('UPDATE shipments SET eta_arrival=$2,timing_revision=$3 WHERE id=$1', [
    id,
    input.etaArrival,
    revision,
  ]);
  await recordAudit(client, actor, 'transport.timing.update', 'shipment', id, {
    revision,
    etaArrival: input.etaArrival,
    reason: input.reason,
  });
}
