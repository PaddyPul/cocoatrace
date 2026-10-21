import type { PoolClient } from 'pg';
import { ForbiddenError } from '../../errors';
import { assertMutationAssurance } from '../mfa/assurance';
import { lockAccessDecisions } from '../mfa/reviewers';
import type { InvitationActor } from './useCases';

/** Revalidate writes under the same lifecycle lock used by membership changes.
 * Never use the permissions captured earlier by the HTTP middleware as authority.
 */
export async function lockInvitationAuthority(client: PoolClient, actor: InvitationActor) {
  await lockAccessDecisions(client);
  await assertMutationAssurance(client, actor);
  if (!actor.sessionId) throw new ForbiddenError('Authorization changed; sign in again');
  const session = await client.query(
    `SELECT id FROM sessions WHERE id=$1 AND user_id=$2
     AND revoked_at IS NULL AND expires_at>NOW() FOR SHARE`,
    [actor.sessionId, actor.id],
  );
  const roles = await client.query<{ permissions: string[] }>(
    `SELECT r.permissions FROM user_roles ur JOIN roles r ON r.id=ur.role_id
     WHERE ur.user_id=$1 FOR SHARE OF ur,r`,
    [actor.id],
  );
  const permissions = roles.rows.flatMap((role) => role.permissions);
  if (!session.rows[0] || !permissions.some((p) => p === '*' || p === 'member.invite'))
    throw new ForbiddenError('Authorization changed; sign in again');
  return { isPlatformAdmin: permissions.includes('*') };
}

/** Lock target before the invitation, matching acceptance's organization-first order. */
export async function lockInvitationTarget(
  client: PoolClient,
  invitationId: string,
  organizationId: string,
  isPlatformAdmin: boolean,
): Promise<boolean> {
  const target = await client.query<{ organization_id: string }>(
    `SELECT organization_id FROM user_invitations
     WHERE id=$1 AND ($2::boolean OR organization_id=$3)`,
    [invitationId, isPlatformAdmin, organizationId],
  );
  if (!target.rows[0]) return false;
  const organization = await client.query(
    `SELECT id FROM organizations WHERE id=$1
     AND access_suspended_at IS NULL AND verification_status='verified' FOR SHARE`,
    [target.rows[0].organization_id],
  );
  return !!organization.rows[0];
}
