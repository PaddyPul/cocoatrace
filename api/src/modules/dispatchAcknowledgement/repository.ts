import { AppError, ConflictError, NotFoundError } from '../../errors';
import type { AuthenticatedActor } from '../../services/authSessionService';
import { inDatabaseTransaction } from '../../services/databaseTransaction';
import { recordAudit } from '../../services/auditWriter';
import { assertMutationAssurance } from '../mfa/assurance';
import { lockAccessDecisions } from '../mfa/reviewers';
import { exceptionHash } from './policy';
import { lockRecallBoundary } from '../recall/safety';
export async function dispatchAcknowledgement(
  actor: AuthenticatedActor,
  id: string,
  input?: { exceptionHash: string; confirmed: true },
) {
  return inDatabaseTransaction(async (client) => {
    await lockAccessDecisions(client);
    if (input) await assertMutationAssurance(client, actor);
    const live = (
      await client.query(
        `SELECT r.permissions FROM users u JOIN organizations o ON o.id=u.organization_id
      JOIN sessions s ON s.user_id=u.id JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
      WHERE u.id=$1 AND o.id=$2 AND s.id=$3 AND u.active AND u.access_suspended_at IS NULL
      AND o.access_suspended_at IS NULL AND o.verification_status='verified' AND s.revoked_at IS NULL AND s.expires_at>NOW()
      FOR SHARE OF o,u,s,r,ur`,
        [actor.id, actor.organizationId, actor.sessionId],
      )
    ).rows;
    const permissions = live.flatMap((row) => row.permissions as string[]);
    const has = (permission: string) =>
      permissions.includes(permission) || permissions.includes('*');
    if (!has('shipment.read'))
      throw new AppError('Account authorization changed', 403, 'FORBIDDEN');
    // Match shipment writers: access lifecycle -> recall boundary -> contract -> shipment.
    // No inventory or payment rows are acquired.
    await lockRecallBoundary(client);
    const contract = (
      await client.query(
        `SELECT c.id FROM sales_contracts c JOIN shipments s ON s.contract_id=c.id
      WHERE s.id=$1 AND (c.buyer_organization_id=$2 OR c.seller_organization_id=$2) FOR UPDATE OF c`,
        [id, actor.organizationId],
      )
    ).rows[0];
    if (!contract) throw new NotFoundError('Shipment');
    const row = (
      await client.query(
        `SELECT s.*,c.buyer_organization_id,c.seller_organization_id,c.status AS contract_status FROM shipments s
      JOIN sales_contracts c ON c.id=s.contract_id WHERE s.id=$1 FOR UPDATE OF s`,
        [id],
      )
    ).rows[0];
    const active = Boolean(row.dispatch_exception);
    const hash = active ? exceptionHash(row) : null;
    const yourRole = row.buyer_organization_id === actor.organizationId ? 'buyer' : 'seller';
    const canAcknowledge =
      active &&
      yourRole === 'buyer' &&
      has('shipment.update') &&
      row.contract_status !== 'cancelled';
    if (input) {
      if (!canAcknowledge)
        throw new AppError(
          'Only an authorized buyer can acknowledge this exception',
          403,
          'FORBIDDEN',
        );
      if (input.exceptionHash !== hash)
        throw new ConflictError(
          'The dispatch exception changed. Review the current reason before acknowledging.',
        );
      const inserted = await client.query(
        `INSERT INTO dispatch_acknowledgements(shipment_id,exception_hash,organization_id,actor_user_id)
        VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING acknowledged_at`,
        [id, hash, actor.organizationId, actor.id],
      );
      if (inserted.rows[0])
        await recordAudit(client, actor, 'dispatch.exception.acknowledged', 'shipment', id, {
          exceptionHash: hash,
        });
    }
    const receipt = hash
      ? (
          await client.query(
            'SELECT acknowledged_at FROM dispatch_acknowledgements WHERE shipment_id=$1 AND exception_hash=$2 AND organization_id=$3',
            [id, hash, row.buyer_organization_id],
          )
        ).rows[0]
      : null;
    return {
      schemaVersion: 1,
      exception: {
        active,
        hash,
        reason: active ? row.dispatch_exception_reason : null,
        recordedAt: active ? row.dispatch_exception_recorded_at : null,
      },
      acknowledgedAt: receipt?.acknowledged_at ?? null,
      yourRole,
      canAcknowledge,
    };
  });
}
