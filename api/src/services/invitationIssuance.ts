import { assertMutationAssurance } from '../modules/mfa/assurance';
import { getClient } from '../db';
import { ConflictError } from '../errors';

export async function createPendingInvitation(input: {
  organizationId: string; email: string; roleId: string; tokenHash: string; actorId: string; actorOrganizationId?:string; actorSessionId?:string;
}) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    if(input.actorOrganizationId)await assertMutationAssurance(client,{id:input.actorId,organizationId:input.actorOrganizationId,sessionId:input.actorSessionId});
    // Serialize double-clicks and concurrent requests for the same address.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended(LOWER($1),0))', [input.email]);
    const existing = await client.query(`SELECT 1 FROM users WHERE LOWER(email)=LOWER($1)
      UNION ALL SELECT 1 FROM user_invitations WHERE LOWER(email)=LOWER($1)
        AND accepted_at IS NULL AND revoked_at IS NULL LIMIT 1`, [input.email]);
    if (existing.rows[0]) throw new ConflictError('An account or invitation already exists. Use Resend for a pending or expired invitation.');
    const result = await client.query(`INSERT INTO user_invitations
      (organization_id,email,role_id,token_hash,invited_by_user_id,expires_at,email_delivery_status)
      VALUES ($1,$2,$3,$4,$5,NOW()+INTERVAL '7 days','pending') RETURNING id,email,expires_at,created_at`,
    [input.organizationId, input.email, input.roleId, input.tokenHash, input.actorId]);
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally { client.release(); }
}
