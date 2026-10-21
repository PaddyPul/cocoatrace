import type { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE TABLE invitation_email_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invitation_id UUID NOT NULL REFERENCES user_invitations(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    recipient_digest TEXT NOT NULL CHECK(recipient_digest ~ '^[a-f0-9]{64}$'),
    actor_user_id UUID NOT NULL REFERENCES users(id),
    key_id TEXT, token_ciphertext TEXT,
    status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','sent','suppressed','failed','failed_terminal')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    lease_token UUID, lease_expires_at TIMESTAMPTZ,
    last_error TEXT, sent_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(invitation_id,token_hash),
    CHECK ((lease_token IS NULL)=(lease_expires_at IS NULL)),
    CHECK ((key_id IS NULL)=(token_ciphertext IS NULL)),
    CHECK (status NOT IN ('queued','sending','failed') OR token_ciphertext IS NOT NULL));
    CREATE INDEX invitation_email_due ON invitation_email_outbox(next_attempt_at,id) WHERE status IN ('queued','failed');
    CREATE INDEX invitation_email_leases ON invitation_email_outbox(lease_expires_at NULLS FIRST,id) WHERE status='sending';
    CREATE INDEX invitation_email_terminal ON invitation_email_outbox(id) WHERE status='failed_terminal';
    ALTER TABLE operations_job_status DROP CONSTRAINT operations_job_status_job_name_check;
    ALTER TABLE operations_job_status ADD CONSTRAINT operations_job_status_job_name_check CHECK(job_name IN ('evidence_scan','evidence_cleanup','payment_reminders','recall_email','fee_statement_email','invitation_email'));`);
}
export async function down(knex: Knex): Promise<void> {
  // Preserve unsubmitted credentials and delivery evidence; prefer a forward repair.
  await knex.raw(`DO $$ BEGIN
    IF EXISTS(SELECT 1 FROM invitation_email_outbox) THEN
      RAISE EXCEPTION 'Invitation delivery history exists; preserve it and use a forward repair';
    END IF;
  END $$;
  DROP TABLE invitation_email_outbox;
  DELETE FROM operations_job_status WHERE job_name='invitation_email';
  ALTER TABLE operations_job_status DROP CONSTRAINT operations_job_status_job_name_check;
  ALTER TABLE operations_job_status ADD CONSTRAINT operations_job_status_job_name_check CHECK(job_name IN ('evidence_scan','evidence_cleanup','payment_reminders','recall_email','fee_statement_email'));`);
}
