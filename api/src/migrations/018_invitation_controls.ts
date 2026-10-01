import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE user_invitations
      ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS idx_user_invitations_active
      ON user_invitations(organization_id, expires_at)
      WHERE accepted_at IS NULL AND revoked_at IS NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP INDEX IF EXISTS idx_user_invitations_active;
    ALTER TABLE user_invitations DROP COLUMN IF EXISTS revoked_at;
  `);
}
