import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE harvest_batches ALTER COLUMN farm_id DROP NOT NULL');
  await knex.schema.alterTable('harvest_batches', (table) => {
    table.text('source_mode').notNullable().defaultTo('farm_traceable');
    table.text('source_name');
    table.string('source_country', 2);
    table.text('source_region');
  });
  await knex.raw("ALTER TABLE harvest_batches ADD CONSTRAINT harvest_batches_source_mode_check CHECK (source_mode IN ('farm_traceable','direct_inventory'))");
  await knex.raw("ALTER TABLE harvest_batches ADD CONSTRAINT harvest_batches_source_integrity_check CHECK ((source_mode='farm_traceable' AND farm_id IS NOT NULL) OR (source_mode='direct_inventory' AND farm_id IS NULL AND source_country IS NOT NULL))");
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE harvest_batches DROP CONSTRAINT IF EXISTS harvest_batches_source_integrity_check');
  await knex.raw('ALTER TABLE harvest_batches DROP CONSTRAINT IF EXISTS harvest_batches_source_mode_check');
  await knex.schema.alterTable('harvest_batches', (table) => {
    table.dropColumns('source_mode', 'source_name', 'source_country', 'source_region');
  });
  await knex.raw('ALTER TABLE harvest_batches ALTER COLUMN farm_id SET NOT NULL');
}
