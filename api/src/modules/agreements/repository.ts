import { AppError, ConflictError, NotFoundError } from '../../errors';
import type { AuthenticatedActor } from '../../services/authSessionService';
import { inDatabaseTransaction } from '../../services/databaseTransaction';
import { recordAudit } from '../../services/auditWriter';
import { assertMutationAssurance } from '../mfa/assurance';
import { lockAccessDecisions } from '../mfa/reviewers';
import { commercialSnapshot, snapshotHash } from './policy';

export async function agreementAcceptance(
  actor: AuthenticatedActor,
  id: string,
  input?: { snapshotHash: string; confirmed: true },
) {
  return inDatabaseTransaction(async (client) => {
    // Access lifecycle lock -> organization/user/session -> contract. No inventory locks are
    // acquired: this acknowledgement never mutates stock, payment or fulfilment state.
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
    if (!permissions.includes('contract.read') && !permissions.includes('*'))
      throw new AppError('Account authorization changed', 403, 'FORBIDDEN');
    const row = (
      await client.query(
        `SELECT c.*,l.origin_location,l.destination_location FROM sales_contracts c
      JOIN listings l ON l.id=c.listing_id WHERE c.id=$1 AND (c.buyer_organization_id=$2 OR c.seller_organization_id=$2) FOR UPDATE OF c`,
        [id, actor.organizationId],
      )
    ).rows[0];
    if (!row) throw new NotFoundError('Contract');
    const yourRole = row.buyer_organization_id === actor.organizationId ? 'buyer' : 'seller';
    const permission = yourRole === 'buyer' ? 'offer.create' : 'offer.respond';
    const canAccept =
      row.status !== 'cancelled' && (permissions.includes(permission) || permissions.includes('*'));
    if (input && !canAccept)
      throw new AppError('Your role cannot acknowledge this agreement', 403, 'FORBIDDEN');
    const snapshot = commercialSnapshot(row);
    const hash = snapshotHash(snapshot);
    let version = (
      await client.query(
        'SELECT version,snapshot_hash FROM agreement_versions WHERE contract_id=$1 ORDER BY version DESC LIMIT 1',
        [id],
      )
    ).rows[0];
    if (!version || version.snapshot_hash !== hash) {
      version = { version: (version?.version ?? 0) + 1, snapshot_hash: hash };
      await client.query(
        'INSERT INTO agreement_versions(contract_id,version,schema_version,snapshot_hash,snapshot) VALUES($1,$2,1,$3,$4)',
        [id, version.version, hash, JSON.stringify(snapshot)],
      );
    }
    if (input) {
      if (input.snapshotHash !== hash)
        throw new ConflictError(
          'The commercial record changed. Review the current version before acknowledging.',
        );
      const inserted = await client.query(
        `INSERT INTO agreement_acceptances(contract_id,version,organization_id,actor_user_id)
        VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING accepted_at`,
        [id, version.version, actor.organizationId, actor.id],
      );
      if (inserted.rows[0])
        await recordAudit(client, actor, 'agreement.acknowledged', 'sales_contract', id, {
          version: version.version,
          snapshotHash: hash,
        });
    }
    const receipts = (
      await client.query(
        'SELECT organization_id,accepted_at FROM agreement_acceptances WHERE contract_id=$1 AND version=$2',
        [id, version.version],
      )
    ).rows;
    const accepted = (org: string) =>
      receipts.find((receipt) => receipt.organization_id === org)?.accepted_at ?? null;
    return {
      schemaVersion: 1,
      version: version.version,
      snapshotHash: hash,
      snapshot,
      yourRole,
      canAccept,
      acceptances: {
        buyer: accepted(row.buyer_organization_id),
        seller: accepted(row.seller_organization_id),
      },
    };
  });
}
