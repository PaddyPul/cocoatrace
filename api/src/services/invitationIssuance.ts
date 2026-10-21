import { lockInvitationAuthority } from '../modules/invitationsWorkflow/authority';
import { enqueueInvitationDelivery } from '../modules/invitationDelivery/outbox';
import { getClient } from '../db';
import { ConflictError, ForbiddenError } from '../errors';
import { recordAudit } from './auditWriter';

export async function createPendingInvitation(input: {
  organizationId: string;
  email: string;
  roleId: string;
  tokenHash: string;
  token: string;
  actorId: string;
  actorOrganizationId?: string;
  actorSessionId?: string;
}) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const actorOrganizationId =
      input.actorOrganizationId ||
      (
        await client.query<{ organization_id: string }>(
          'SELECT organization_id FROM users WHERE id=$1',
          [input.actorId],
        )
      ).rows[0]?.organization_id;
    if (!actorOrganizationId) throw new ForbiddenError('Invitation actor unavailable');
    const actor = {
      id: input.actorId,
      organizationId: actorOrganizationId,
      sessionId: input.actorSessionId,
      permissions: [],
    };
    const { isPlatformAdmin } = await lockInvitationAuthority(client, actor);
    const target = (
      await client.query<{ type: string }>(
        `SELECT type FROM organizations WHERE id=$1
      AND access_suspended_at IS NULL AND verification_status='verified' FOR SHARE`,
        [input.organizationId],
      )
    ).rows[0];
    const role = (
      await client.query<{ name: string }>('SELECT name FROM roles WHERE id=$1 FOR SHARE', [
        input.roleId,
      ])
    ).rows[0];
    if (
      !target ||
      !role ||
      (!isPlatformAdmin &&
        (actorOrganizationId !== input.organizationId ||
          role.name !== (target.type === 'cooperative' ? 'farmer' : target.type)))
    )
      throw new ForbiddenError('Invitation scope or role changed');
    // Serialize double-clicks and concurrent requests for the same address.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended(LOWER($1),0))', [
      input.email,
    ]);
    const existing = await client.query(
      `SELECT 1 FROM users WHERE LOWER(email)=LOWER($1)
      UNION ALL SELECT 1 FROM user_invitations WHERE LOWER(email)=LOWER($1)
        AND accepted_at IS NULL AND revoked_at IS NULL LIMIT 1`,
      [input.email],
    );
    if (existing.rows[0])
      throw new ConflictError(
        'An account or invitation already exists. Use Resend for a pending or expired invitation.',
      );
    const result = await client.query(
      `INSERT INTO user_invitations
      (organization_id,email,role_id,token_hash,invited_by_user_id,expires_at,email_delivery_status)
      VALUES ($1,$2,$3,$4,$5,NOW()+INTERVAL '7 days','pending') RETURNING id,email,expires_at,created_at`,
      [input.organizationId, input.email, input.roleId, input.tokenHash, input.actorId],
    );
    await recordAudit(
      client,
      { id: input.actorId, organizationId: actorOrganizationId },
      'member.invite',
      'user_invitation',
      result.rows[0].id,
      { invitedOrganizationId: input.organizationId, roleId: input.roleId },
    );
    await enqueueInvitationDelivery(client, actor, result.rows[0].id, input.token);
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
