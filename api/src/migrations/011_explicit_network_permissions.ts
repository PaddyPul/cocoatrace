import type { Knex } from 'knex';

const regulatorPermissions = [
  'analytics.read.network',
  'audit.export.all',
  'audit.read.all',
  'batch.read.all',
  'certificate.read.all',
  'evidence.read.all',
  'farm.read.all',
  'product_profile.read.all',
  'provenance.export.network',
  'provenance.read.network',
  'traceability.read.network',
];

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `UPDATE roles SET permissions=(
       SELECT ARRAY(SELECT DISTINCT permission FROM unnest(permissions || ?::text[]) permission ORDER BY permission)
     ) WHERE name='regulator'`,
    [regulatorPermissions],
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(
    `UPDATE roles SET permissions=(
       SELECT ARRAY(SELECT permission FROM unnest(permissions) permission WHERE NOT (permission = ANY(?::text[])))
     ) WHERE name='regulator'`,
    [regulatorPermissions],
  );
}
