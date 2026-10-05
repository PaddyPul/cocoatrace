import type { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE platform_fee_invoices
    ADD COLUMN payer_organization_id UUID REFERENCES organizations(id),
    ADD COLUMN policy_version TEXT NOT NULL DEFAULT 'legacy-recorded',
    ADD COLUMN tax_status TEXT NOT NULL DEFAULT 'not_configured',
    ADD COLUMN due_at TIMESTAMPTZ,
    ADD COLUMN verified_by_user_id UUID REFERENCES users(id),
    ADD COLUMN platform_receipt_reference TEXT,
    ADD COLUMN write_off_reason TEXT,
    ADD COLUMN written_off_at TIMESTAMPTZ;
  UPDATE platform_fee_invoices f SET payer_organization_id=CASE f.fee_payer WHEN 'seller' THEN c.seller_organization_id WHEN 'buyer' THEN c.buyer_organization_id ELSE NULL END,
    due_at=CASE WHEN f.status IN('invoiced','paid') THEN COALESCE(f.invoiced_at,c.completed_at) ELSE NULL END
    FROM sales_contracts c WHERE c.id=f.contract_id;
  CREATE UNIQUE INDEX fee_receipt_reference_unique ON platform_fee_invoices(lower(trim(platform_receipt_reference))) WHERE platform_receipt_reference IS NOT NULL;
  CREATE TABLE platform_fee_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fee_id UUID NOT NULL REFERENCES platform_fee_invoices(id) ON DELETE RESTRICT,
    submitted_by_user_id UUID NOT NULL REFERENCES users(id),
    submitted_by_organization_id UUID NOT NULL REFERENCES organizations(id),
    reference TEXT NOT NULL CHECK(length(trim(reference)) BETWEEN 3 AND 200),
    status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN('submitted','verified','rejected')),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_by_user_id UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    CHECK((status='submitted' AND reviewed_at IS NULL) OR (status<>'submitted' AND reviewed_at IS NOT NULL AND reviewed_by_user_id IS NOT NULL)),
    CHECK(status<>'rejected' OR length(trim(rejection_reason)) BETWEEN 10 AND 2000)
  );
  CREATE UNIQUE INDEX fee_single_pending_submission ON platform_fee_submissions(fee_id) WHERE status='submitted';
  CREATE INDEX fee_submission_history ON platform_fee_submissions(fee_id,submitted_at);
  `);
}
export async function down(): Promise<void> {
  throw new Error('Fee collection history must be retained; use a forward correction');
}
