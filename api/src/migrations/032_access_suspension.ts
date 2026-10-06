import type { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE organizations ADD COLUMN access_suspended_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN access_suspended_at TIMESTAMPTZ;`);
}
export async function down(): Promise<void> {
  throw new Error('Access suspension is a security boundary; use a forward correction');
}
