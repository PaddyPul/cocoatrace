import { query, getClient } from '../../db';
import type { PoolClient } from 'pg';
export { getClient };
export interface InvitationDetails {
  email: string;
  expires_at: Date;
  accepted_at: Date | null;
  organization_name: string;
  organization_type: string;
  role: string;
}
export async function findOrganization(parameters: [organizationId: string]) {
  return query<{ id: string; name: string; type: string }>(
    'SELECT id, name, type FROM organizations WHERE id=$1',
    parameters,
  );
}
export async function findRole(parameters: [roleName: string]) {
  return query<{ id: string; name: string }>(
    'SELECT id, name FROM roles WHERE name=$1',
    parameters,
  );
}
export async function findExistingUser(parameters: [email: string]) {
  return query<{ id: string }>('SELECT id FROM users WHERE email=$1', parameters);
}
export async function findDetails(parameters: [tokenHash: string]) {
  return query<InvitationDetails>(
    `SELECT i.email,i.expires_at,i.accepted_at,o.name AS organization_name,o.type AS organization_type,r.name AS role
     FROM user_invitations i JOIN organizations o ON o.id=i.organization_id JOIN roles r ON r.id=i.role_id
     WHERE i.token_hash=$1 AND i.revoked_at IS NULL AND o.access_suspended_at IS NULL`,
    parameters,
  );
}
export async function findCandidate(client: PoolClient, parameters: [tokenHash: string]) {
  return client.query<{ organization_id: string }>(
    'SELECT organization_id FROM user_invitations WHERE token_hash=$1',
    parameters,
  );
}
export async function lockOrganization(client: PoolClient, parameters: [organizationId: string]) {
  return client.query<{ access_suspended_at: Date | null }>(
    'SELECT access_suspended_at FROM organizations WHERE id=$1 FOR SHARE',
    parameters,
  );
}
export async function lockInvitation(client: PoolClient, parameters: [tokenHash: string]) {
  return client.query<{ id: string; organization_id: string; email: string; role_id: string }>(
    `SELECT * FROM user_invitations WHERE token_hash=$1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>NOW() FOR UPDATE`,
    parameters,
  );
}
export async function insertUser(
  client: PoolClient,
  parameters: [organizationId: string, email: string, passwordHash: string, name: string],
) {
  return client.query<{ id: string; email: string; name: string }>(
    'INSERT INTO users (organization_id,email,password_hash,name) VALUES ($1,$2,$3,$4) RETURNING id,email,name',
    parameters,
  );
}
export async function assignRole(client: PoolClient, parameters: [userId: string, roleId: string]) {
  return client.query<never>('INSERT INTO user_roles (user_id,role_id) VALUES ($1,$2)', parameters);
}
export async function markAccepted(client: PoolClient, parameters: [invitationId: string]) {
  return client.query<never>(
    'UPDATE user_invitations SET accepted_at=NOW() WHERE id=$1',
    parameters,
  );
}
export async function revoke(
  parameters: [invitationId: string, isPlatformAdmin: boolean, organizationId: string],
) {
  return query<{ id: string }>(
    `UPDATE user_invitations
        SET revoked_at=COALESCE(revoked_at,NOW())
      WHERE id=$1
        AND accepted_at IS NULL
        AND revoked_at IS NULL
        AND ($2::boolean OR organization_id=$3)
      RETURNING id`,
    parameters,
  );
}
export async function rotate(
  parameters: [
    tokenHash: string,
    invitationId: string,
    isPlatformAdmin: boolean,
    organizationId: string,
  ],
) {
  return query<{
    id: string;
    email: string;
    expires_at: Date;
    organization_id: string;
    organization_name: string;
  }>(
    `UPDATE user_invitations i
        SET token_hash=$1, expires_at=NOW()+INTERVAL '7 days', email_delivery_status='pending'
      WHERE i.id=$2
        AND i.accepted_at IS NULL AND i.revoked_at IS NULL
        AND ($3::boolean OR i.organization_id=$4)
      RETURNING i.id,i.email,i.expires_at,i.organization_id,
        (SELECT o.name FROM organizations o WHERE o.id=i.organization_id) AS organization_name`,
    parameters,
  );
}

export async function begin(client: PoolClient): Promise<void> {
  await client.query('BEGIN');
}

export async function commit(client: PoolClient): Promise<void> {
  await client.query('COMMIT');
}

export async function rollback(client: PoolClient): Promise<void> {
  await client.query('ROLLBACK');
}
