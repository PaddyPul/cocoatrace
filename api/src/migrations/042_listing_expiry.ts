import type { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  // Existing publications retain their terms; only newly published supply has a default deadline.
  await knex.raw(`ALTER TABLE listings ADD COLUMN expires_at TIMESTAMPTZ NULL;
    ALTER TABLE listings ALTER COLUMN expires_at SET DEFAULT (NOW()+INTERVAL '30 days');
    ALTER TABLE listings ADD COLUMN renewed_at TIMESTAMPTZ NULL;
    CREATE INDEX listings_expiry ON listings(expires_at) WHERE active=TRUE`);
}
export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS listings_expiry; ALTER TABLE listings DROP COLUMN renewed_at, DROP COLUMN expires_at');
}
