import type { Knex } from 'knex';

// Index-only deployment; no queue records, recipients or retry state are changed.
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE INDEX payment_reminder_backlog_due ON payment_reminder_email_outbox(next_attempt_at,id) WHERE status IN ('queued','failed');
    CREATE INDEX recall_backlog_due ON recall_email_outbox(next_attempt_at,id) WHERE status IN ('queued','failed');
    CREATE INDEX payment_reminder_backlog_leases ON payment_reminder_email_outbox(lease_expires_at NULLS FIRST,id) WHERE status='sending';
    CREATE INDEX recall_backlog_leases ON recall_email_outbox(lease_expires_at NULLS FIRST,id) WHERE status='sending';
  `);
}
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX recall_backlog_leases; DROP INDEX payment_reminder_backlog_leases; DROP INDEX recall_backlog_due; DROP INDEX payment_reminder_backlog_due`);
}
