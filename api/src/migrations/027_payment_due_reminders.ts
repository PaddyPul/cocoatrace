import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Only reconstruct deadlines from persisted trigger timestamps. Do not invent
  // agreement/document/delivery dates, move existing deadlines, or reopen trades.
  await knex.raw(`
    CREATE TABLE payment_reminder_email_outbox (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      reminder_id UUID NOT NULL REFERENCES payment_reminders(id) ON DELETE RESTRICT,
      recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','sent','suppressed','failed','failed_terminal')),
      attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),
      next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      lease_token UUID, lease_expires_at TIMESTAMPTZ,
      last_error TEXT, sent_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(reminder_id,recipient_user_id)
    );
    CREATE INDEX payment_reminder_email_pending ON payment_reminder_email_outbox(status,next_attempt_at);

  `);
  await backfillMissingPaymentDeadlines(knex);
}

export async function backfillMissingPaymentDeadlines(knex: Pick<Knex, 'raw'>): Promise<void> {
  // Never synthesize historical trigger timestamps or alter closed/paid records.
  await knex.raw(`
    WITH known_deadlines AS (
      SELECT i.id, CASE i.due_trigger
        WHEN 'terms_agreed' THEN c.payment_terms_confirmed_at
        WHEN 'documents_presented' THEN p.documents_presented_at
        WHEN 'delivery' THEN delivered.recorded_at + make_interval(days=>c.credit_days)
      END AS due_at
      FROM payment_installments i
      JOIN payment_requests p ON p.id=i.payment_request_id
      JOIN sales_contracts c ON c.id=p.contract_id
      LEFT JOIN LATERAL (
        SELECT COALESCE(sh.delivered_at,
          (SELECT MIN(m.recorded_at) FROM shipment_milestones m
            WHERE m.shipment_id=sh.id AND m.milestone='delivered')) AS recorded_at
        FROM shipments sh WHERE sh.contract_id=c.id
        ORDER BY sh.created_at DESC,sh.id DESC LIMIT 1
      ) delivered ON TRUE
      WHERE i.status='due' AND i.due_at IS NULL
        AND c.payment_terms_status='agreed' AND c.status NOT IN ('settled','cancelled')
    )
    UPDATE payment_installments i SET due_at=d.due_at,updated_at=NOW()
      FROM known_deadlines d WHERE i.id=d.id AND d.due_at IS NOT NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE payment_reminder_email_outbox');
  // Corrected historical deadlines are operational data and remain intact.
}
