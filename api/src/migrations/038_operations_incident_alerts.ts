import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE TABLE operations_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_key TEXT NOT NULL CHECK(signal_key ~ '^[a-z_]+:[a-z_]+:[A-Z_]+$'),
    state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','resolved')),
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    CHECK((state='open' AND resolved_at IS NULL) OR (state='resolved' AND resolved_at IS NOT NULL))
  );
  CREATE UNIQUE INDEX operations_incident_open_key ON operations_incidents(signal_key) WHERE state='open';
  CREATE TABLE operations_alert_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES operations_incidents(id),
    recipient_user_id UUID NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','sent','suppressed','failed','failed_terminal')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 8),
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    lease_token UUID, lease_expires_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ, last_error_code TEXT CHECK(last_error_code ~ '^[A-Z_]+$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(incident_id,recipient_user_id)
  );
  CREATE INDEX operations_alert_due ON operations_alert_outbox(next_attempt_at,id) WHERE status IN ('queued','failed');
  CREATE INDEX operations_alert_expired ON operations_alert_outbox(lease_expires_at NULLS FIRST,id) WHERE status='sending';
  CREATE INDEX operations_alert_terminal ON operations_alert_outbox(id) WHERE status='failed_terminal';
  CREATE INDEX operations_alert_invalid ON operations_alert_outbox(id) WHERE status IN ('queued','failed') AND (attempts>=8 OR sent_at IS NOT NULL);
  CREATE INDEX operations_alert_retry ON operations_alert_outbox(id) WHERE status='failed';
  CREATE INDEX operations_alert_suppressed ON operations_alert_outbox(incident_id) WHERE status='suppressed' AND last_error_code='EMAIL_SUPPRESSED';
  CREATE INDEX operations_alert_pending ON operations_alert_outbox(id) WHERE status IN ('queued','failed','sending');
  CREATE TABLE operations_alert_status (
    id SMALLINT PRIMARY KEY CHECK(id=1), config_fingerprint TEXT NOT NULL DEFAULT repeat('0',64) CHECK(config_fingerprint ~ '^[a-f0-9]{64}$'), last_poll_at TIMESTAMPTZ NOT NULL,
    last_success_at TIMESTAMPTZ, error_code TEXT CHECK(error_code ~ '^[A-Z_]+$'),
    consecutive_failures INTEGER NOT NULL DEFAULT 0 CHECK(consecutive_failures>=0)
  );`);
}
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DO $$ BEGIN IF EXISTS(SELECT 1 FROM operations_alert_outbox WHERE status IN ('queued','failed','sending','failed_terminal')) THEN RAISE EXCEPTION 'Operations alerts still require investigation; preserve the outbox before rollback'; END IF; END $$;
    DROP TABLE operations_alert_status; DROP TABLE operations_alert_outbox; DROP TABLE operations_incidents;`);
}
