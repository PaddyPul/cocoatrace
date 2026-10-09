import type { Knex } from 'knex';

// These ordinary indexes are installed before pilot traffic. Large production
// tables need a separately reviewed concurrent-index deployment window.
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE INDEX audit_events_org_chronology ON audit_events(actor_organization_id,occurred_at DESC,id DESC);
    CREATE INDEX audit_events_chronology ON audit_events(occurred_at DESC,id DESC);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP INDEX IF EXISTS audit_events_org_chronology;
    DROP INDEX IF EXISTS audit_events_chronology;
  `);
}
