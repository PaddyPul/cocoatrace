import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE payment_issues (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      payment_request_id UUID NOT NULL REFERENCES payment_requests(id) ON DELETE RESTRICT,
      installment_id UUID REFERENCES payment_installments(id) ON DELETE RESTRICT,
      issue_type TEXT NOT NULL CHECK (issue_type IN ('payment_dispute','reference_correction','receipt_reversal')),
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolution_proposed','resolved')),
      opened_by_user_id UUID NOT NULL REFERENCES users(id),
      opened_by_organization_id UUID NOT NULL REFERENCES organizations(id),
      reason TEXT NOT NULL,
      proposed_reference TEXT,
      resolution_note TEXT,
      resolution_proposed_by_user_id UUID REFERENCES users(id),
      resolution_proposed_by_organization_id UUID REFERENCES organizations(id),
      resolved_by_user_id UUID REFERENCES users(id),
      resolved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX payment_issues_one_active ON payment_issues(payment_request_id) WHERE status <> 'resolved';
    CREATE INDEX payment_issues_installment_idx ON payment_issues(installment_id);
    CREATE TABLE payment_reminders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      payment_request_id UUID NOT NULL REFERENCES payment_requests(id) ON DELETE RESTRICT,
      installment_id UUID NOT NULL REFERENCES payment_installments(id) ON DELETE RESTRICT,
      recipient_organization_id UUID NOT NULL REFERENCES organizations(id),
      created_by_user_id UUID REFERENCES users(id),
      reminder_date DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (installment_id, reminder_date)
    );
    CREATE INDEX payment_reminders_payment_idx ON payment_reminders(payment_request_id, created_at DESC);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE payment_reminders; DROP TABLE payment_issues;');
}
