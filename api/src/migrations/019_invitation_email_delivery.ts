import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE user_invitations
      ADD COLUMN email_delivery_status TEXT NOT NULL DEFAULT 'unknown'
        CHECK (email_delivery_status IN ('unknown','pending','sent','suppressed','failed')),
      ADD COLUMN email_attempted_at TIMESTAMPTZ;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE user_invitations
    DROP COLUMN email_delivery_status, DROP COLUMN email_attempted_at`);
}
