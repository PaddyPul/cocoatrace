import type { AuthenticatedActor } from '../../services/authSessionService';
import { inDatabaseTransaction } from '../../services/databaseTransaction';
import { writeTiming } from './write';
import { AppError, ConflictError, NotFoundError } from '../../errors';
import { lockAccessDecisions } from '../mfa/reviewers';
import { assertMutationAssurance } from '../mfa/assurance';
import { canArrange } from '../transport/responsibilities';
import { lockRecallBoundary } from '../recall/safety';
import { arrivalOverdue, timingBody } from './policy';
import type { z } from 'zod';
export async function transportTiming(
  actor: AuthenticatedActor,
  id: string,
  input?: z.infer<typeof timingBody>,
) {
  return inDatabaseTransaction(async (client) => {
    await lockAccessDecisions(client);
    if (input) await assertMutationAssurance(client, actor);
    const grants = (
      await client.query(
        `SELECT r.permissions FROM users u JOIN organizations o ON o.id=u.organization_id JOIN sessions s ON s.user_id=u.id JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE u.id=$1 AND o.id=$2 AND s.id=$3 AND u.active AND u.access_suspended_at IS NULL AND o.access_suspended_at IS NULL AND o.verification_status='verified' AND s.revoked_at IS NULL AND s.expires_at>NOW() FOR SHARE OF o,u,s,r,ur`,
        [actor.id, actor.organizationId, actor.sessionId],
      )
    ).rows.flatMap((row) => row.permissions as string[]);
    if (!grants.includes('*') && !grants.includes('shipment.read'))
      throw new AppError('Transport permission unavailable', 403, 'FORBIDDEN');
    await lockRecallBoundary(client);
    const contract = (
      await client.query(
        `SELECT c.* FROM sales_contracts c JOIN shipments sh ON sh.contract_id=c.id WHERE sh.id=$1 AND (c.buyer_organization_id=$2 OR c.seller_organization_id=$2) FOR UPDATE OF c`,
        [id, actor.organizationId],
      )
    ).rows[0];
    if (!contract) throw new NotFoundError('Transport record');
    const shipment = (
      await client.query(
        'SELECT *,eta_arrival::text AS eta_date FROM shipments WHERE id=$1 FOR UPDATE',
        [id],
      )
    ).rows[0];
    const canEdit =
      contract.status !== 'cancelled' &&
      !['arrived', 'customs_cleared', 'unloaded', 'delivered'].includes(
        shipment.current_milestone,
      ) &&
      canArrange({ ...contract, ...shipment }, actor.organizationId) &&
      (grants.includes('*') || grants.includes('shipment.update'));
    if (input) {
      if (!canEdit)
        throw new AppError(
          'Only the assigned party can update timing before arrival',
          403,
          'TRANSPORT_ACTION_FORBIDDEN',
        );
      if (input.expectedRevision !== shipment.timing_revision)
        throw new ConflictError('Timing changed. Review the current timing before saving.');
      await writeTiming(client, actor, id, input.etaArrival, input.reason, input.expectedRevision);
      if (input.etaArrival !== shipment.eta_date) shipment.timing_revision++;
      shipment.eta_date = input.etaArrival;
    }
    const history = (
      await client.query(
        'SELECT revision,eta_arrival::text AS "etaArrival",reason,recorded_at AS "recordedAt" FROM shipment_timing_history WHERE shipment_id=$1 ORDER BY revision DESC LIMIT 101',
        [id],
      )
    ).rows;
    return {
      shipmentId: id,
      revision: shipment.timing_revision,
      etaArrival: shipment.eta_date,
      overdue: arrivalOverdue(shipment.eta_date, shipment.current_milestone, contract.status),
      canEdit,
      history: history.slice(0, 100),
      historyHasMore: history.length > 100,
    };
  });
}
export { loadTransportTimingNotices } from './notices';
