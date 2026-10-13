import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE TABLE operations_job_status (
    job_name TEXT PRIMARY KEY CHECK(job_name IN ('evidence_scan','evidence_cleanup','payment_reminders','recall_email')),
    status TEXT NOT NULL CHECK(status IN ('running','succeeded','failed')),
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    error_code TEXT CHECK(error_code ~ '^[A-Z0-9_]{1,80}$'),
    runs BIGINT NOT NULL DEFAULT 0 CHECK(runs>=0),
    consecutive_failures INTEGER NOT NULL DEFAULT 0 CHECK(consecutive_failures>=0)
  );
  CREATE INDEX evidence_cleanup_dead_operator ON evidence_object_cleanup(updated_at,id) WHERE state='dead';
  CREATE INDEX payment_reminder_terminal_operator ON payment_reminder_email_outbox(id) WHERE status='failed_terminal';
  CREATE INDEX recall_email_terminal_operator ON recall_email_outbox(id) WHERE status='failed_terminal';`);
}
export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX recall_email_terminal_operator; DROP INDEX payment_reminder_terminal_operator; DROP INDEX evidence_cleanup_dead_operator; DROP TABLE operations_job_status');
}
