import { query } from '../../db';
export type LoginAccount = {
  id: string;
  email: string;
  name: string;
  organization_id: string;
  password_hash: string;
  active: boolean;
  access_suspended_at: Date | null;
  org_suspended: Date | null;
  verification_status: string;
};
export async function findLoginAccount(email: string): Promise<LoginAccount | undefined> {
  return (
    await query<LoginAccount>(
      `SELECT u.id,u.email,u.name,u.organization_id,u.password_hash,u.active,u.access_suspended_at,o.access_suspended_at AS org_suspended,o.verification_status
       FROM users u JOIN organizations o ON o.id=u.organization_id WHERE u.email=$1`,
      [email],
    )
  ).rows[0];
}
