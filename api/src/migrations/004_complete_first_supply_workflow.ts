import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    UPDATE roles SET permissions = array_append(permissions, 'farm.read')
      WHERE name='exporter' AND NOT ('farm.read'=ANY(permissions));
    UPDATE roles SET permissions = array_append(permissions, 'farm.create')
      WHERE name='exporter' AND NOT ('farm.create'=ANY(permissions));
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    UPDATE roles SET permissions = array_remove(permissions, 'farm.create') WHERE name='exporter';
    UPDATE roles SET permissions = array_remove(permissions, 'farm.read') WHERE name='exporter';
  `);
}
