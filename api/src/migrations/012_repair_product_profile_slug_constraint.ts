import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE product_profiles DROP CONSTRAINT IF EXISTS product_profiles_slug_check;
    ALTER TABLE product_profiles
      ADD CONSTRAINT product_profiles_slug_check
      CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
  `);
}

export async function down(): Promise<void> {
  // This corrects an invalid PostgreSQL regular expression. Reintroducing the
  // broken constraint would reject valid, already-stored profile slugs.
}
