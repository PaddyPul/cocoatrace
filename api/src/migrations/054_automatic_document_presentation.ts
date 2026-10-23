import type { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE audit_events ALTER COLUMN actor_user_id DROP NOT NULL;
    ALTER TABLE audit_events ADD CONSTRAINT audit_events_system_presentation_actor CHECK
      (actor_user_id IS NOT NULL OR (action='payment.documents.present' AND entity_type='payment_request' AND COALESCE(metadata->>'source'='automatic_readiness',FALSE)));
    ALTER TABLE payment_requests ADD COLUMN documents_submission_error_code TEXT
      CHECK(documents_submission_error_code IN ('DOCUMENT_FILES_UNAVAILABLE','TRADE_REQUIREMENTS_INCOMPLETE','DOCUMENT_SUBMISSION_RETRY_PENDING'));
    ALTER TABLE payment_requests ADD COLUMN documents_submission_checked_at TIMESTAMPTZ;
    ALTER TABLE operations_job_status DROP CONSTRAINT operations_job_status_job_name_check;
    ALTER TABLE operations_job_status ADD CONSTRAINT operations_job_status_job_name_check
    CHECK(job_name IN ('evidence_scan','evidence_cleanup','payment_reminders','recall_email','fee_statement_email','invitation_email','document_presentation'));
    CREATE INDEX payment_requests_unpresented_documents ON payment_requests(id) WHERE documents_presented_at IS NULL;`);
}
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DO $$ BEGIN
      IF EXISTS(SELECT 1 FROM audit_events WHERE actor_user_id IS NULL) THEN
        RAISE EXCEPTION 'Automatic presentation audits exist; preserve history and use a forward correction';
      END IF;
    END $$;
    ALTER TABLE audit_events DROP CONSTRAINT audit_events_system_presentation_actor;
    ALTER TABLE audit_events ALTER COLUMN actor_user_id SET NOT NULL;
    ALTER TABLE payment_requests DROP COLUMN documents_submission_error_code;
    ALTER TABLE payment_requests DROP COLUMN documents_submission_checked_at;
    DROP INDEX payment_requests_unpresented_documents;
    DELETE FROM operations_job_status WHERE job_name='document_presentation';
    ALTER TABLE operations_job_status DROP CONSTRAINT operations_job_status_job_name_check;
    ALTER TABLE operations_job_status ADD CONSTRAINT operations_job_status_job_name_check
    CHECK(job_name IN ('evidence_scan','evidence_cleanup','payment_reminders','recall_email','fee_statement_email','invitation_email'));`);
}
