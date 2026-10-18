import type { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE operations_job_status DROP CONSTRAINT operations_job_status_job_name_check;
    ALTER TABLE operations_job_status ADD CONSTRAINT operations_job_status_job_name_check CHECK(job_name IN ('evidence_scan','evidence_cleanup','payment_reminders','recall_email','fee_statement_email'));
    CREATE TABLE fee_statement_email_outbox (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fee_id UUID NOT NULL REFERENCES platform_fee_invoices(id),
    recipient_user_id UUID NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','sent','suppressed','failed','failed_terminal')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    lease_token UUID, lease_expires_at TIMESTAMPTZ,
    last_error TEXT, sent_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(fee_id,recipient_user_id),
    CHECK ((lease_token IS NULL)=(lease_expires_at IS NULL)));
    CREATE INDEX fee_statement_email_due ON fee_statement_email_outbox(next_attempt_at,id) WHERE status IN ('queued','failed');
    CREATE INDEX fee_statement_email_leases ON fee_statement_email_outbox(lease_expires_at NULLS FIRST,id) WHERE status='sending';
    CREATE INDEX fee_statement_email_terminal ON fee_statement_email_outbox(id) WHERE status='failed_terminal';`);
}
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP TABLE fee_statement_email_outbox;
    DELETE FROM operations_job_status WHERE job_name='fee_statement_email';
    ALTER TABLE operations_job_status DROP CONSTRAINT operations_job_status_job_name_check;
    ALTER TABLE operations_job_status ADD CONSTRAINT operations_job_status_job_name_check CHECK(job_name IN ('evidence_scan','evidence_cleanup','payment_reminders','recall_email'));`);
}
