import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { z } from 'zod';

interface BootstrapClient {
  query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

const credentials = z
  .object({
    email: z.string().trim().toLowerCase().email(),
    password: z
      .string()
      .min(20)
      .max(72)
      .refine(
        (value) => Buffer.byteLength(value, 'utf8') <= 72 && !/password123|change.?me/i.test(value),
        'Use a unique password of 20–72 bytes',
      ),
  })
  .strict();

/** First installation only. No seed accounts, role replacement or password reset. */
export async function bootstrapAdmin(client: BootstrapClient, input: unknown): Promise<void> {
  const parsed = credentials.safeParse(input);
  if (!parsed.success) throw new Error('Provide a valid email and unique 20–72 byte password');
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await client.query('BEGIN');
  try {
    // Serialize bootstrap attempts and block concurrent identity insertion until commit.
    await client.query('LOCK TABLE organizations, users, roles, user_roles IN EXCLUSIVE MODE');
    const occupied = await client.query(
      'SELECT EXISTS(SELECT 1 FROM users) OR EXISTS(SELECT 1 FROM organizations) AS occupied',
    );
    if (occupied.rows[0]?.occupied !== false) {
      throw new Error('Bootstrap requires an empty installation; existing identities preserved');
    }
    const role = await client.query(
      `INSERT INTO roles(name,permissions) VALUES('admin',ARRAY['*'])
       ON CONFLICT(name) DO NOTHING RETURNING id`,
    );
    if (!role.rows[0]?.id) throw new Error('Existing admin role requires operator review');
    const organization = await client.query(
      `INSERT INTO organizations(name,type,jurisdiction,verification_status)
       VALUES('BetterTrade Demo Administration','admin','GH','verified') RETURNING id`,
    );
    const organizationId = organization.rows[0]?.id;
    if (typeof organizationId !== 'string') throw new Error('Organization was not created');
    const user = await client.query(
      `INSERT INTO users(organization_id,email,password_hash,name)
       VALUES($1,$2,$3,'BetterTrade Administrator') RETURNING id`,
      [organizationId, parsed.data.email, passwordHash],
    );
    const userId = user.rows[0]?.id;
    if (typeof userId !== 'string') throw new Error('Administrator was not created');
    await client.query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [
      userId,
      role.rows[0].id,
    ]);
    await client.query(
      `INSERT INTO user_onboarding(user_id,status,current_step,pilot_mode,completed_at)
       VALUES($1,'completed',4,FALSE,NOW())`,
      [userId],
    );
    await client.query(
      `INSERT INTO audit_events(actor_user_id,actor_organization_id,action,entity_type,entity_id,new_state_hash)
       VALUES($1,$2,'installation.admin_bootstrapped','user',$1,$3)`,
      [
        userId,
        organizationId,
        createHash('sha256').update(JSON.stringify({ userId, organizationId })).digest('hex'),
      ],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
