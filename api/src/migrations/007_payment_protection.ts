import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE sales_contracts ADD COLUMN IF NOT EXISTS payment_plan TEXT NOT NULL DEFAULT 'deposit_balance';
    ALTER TABLE sales_contracts ADD COLUMN IF NOT EXISTS deposit_percentage NUMERIC(5,2) NOT NULL DEFAULT 20;
    ALTER TABLE sales_contracts ADD COLUMN IF NOT EXISTS credit_days INTEGER NOT NULL DEFAULT 30;
    ALTER TABLE sales_contracts ADD COLUMN IF NOT EXISTS payment_terms_status TEXT NOT NULL DEFAULT 'proposed';
    ALTER TABLE sales_contracts ADD COLUMN IF NOT EXISTS payment_terms_note TEXT;
    ALTER TABLE sales_contracts ADD COLUMN IF NOT EXISTS payment_terms_confirmed_at TIMESTAMPTZ;
    ALTER TABLE sales_contracts ADD COLUMN IF NOT EXISTS payment_terms_confirmed_by_user_id UUID REFERENCES users(id);
    ALTER TABLE sales_contracts ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
    ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS dispatch_required_amount NUMERIC(14,2) NOT NULL DEFAULT 0;
    ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS amount_confirmed NUMERIC(14,2) NOT NULL DEFAULT 0;
    ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS documents_presented_at TIMESTAMPTZ;
    ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS security_status TEXT NOT NULL DEFAULT 'not_required';
    ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS security_provider TEXT;
    ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS security_reference TEXT;
    ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS security_submitted_at TIMESTAMPTZ;
    ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS security_verified_at TIMESTAMPTZ;
    ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS security_verified_by_user_id UUID REFERENCES users(id);
    ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS release_status TEXT NOT NULL DEFAULT 'locked';
    ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_requests_contract_unique ON payment_requests(contract_id);
    ALTER TABLE shipments ADD COLUMN IF NOT EXISTS dispatch_exception BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE shipments ADD COLUMN IF NOT EXISTS dispatch_exception_reason TEXT;
    ALTER TABLE shipments ADD COLUMN IF NOT EXISTS dispatch_exception_recorded_at TIMESTAMPTZ;
    ALTER TABLE shipments ADD COLUMN IF NOT EXISTS dispatch_exception_recorded_by_user_id UUID REFERENCES users(id);
    CREATE TABLE IF NOT EXISTS payment_installments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), payment_request_id UUID NOT NULL REFERENCES payment_requests(id) ON DELETE CASCADE,
      installment_type TEXT NOT NULL, sequence_number INTEGER NOT NULL, amount_due NUMERIC(14,2) NOT NULL CHECK(amount_due>=0),
      due_trigger TEXT NOT NULL, due_at TIMESTAMPTZ, status TEXT NOT NULL DEFAULT 'awaiting_trigger', payment_reference_external TEXT,
      submitted_by_user_id UUID REFERENCES users(id), submitted_at TIMESTAMPTZ, verified_by_user_id UUID REFERENCES users(id), verified_at TIMESTAMPTZ,
      rejected_at TIMESTAMPTZ, rejection_reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(payment_request_id,installment_type));
    ALTER TABLE payment_installments ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;
    CREATE TABLE IF NOT EXISTS platform_fee_invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), contract_id UUID NOT NULL UNIQUE REFERENCES sales_contracts(id), fee_payer TEXT NOT NULL DEFAULT 'seller',
      rate_bps INTEGER NOT NULL DEFAULT 100 CHECK(rate_bps>=0), amount_total NUMERIC(14,2) NOT NULL CHECK(amount_total>=0), currency CHAR(3) NOT NULL,
      status TEXT NOT NULL DEFAULT 'estimated', payment_reference_external TEXT, invoiced_at TIMESTAMPTZ, paid_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    UPDATE sales_contracts c SET payment_plan='documentary_collection',deposit_percentage=0,payment_terms_status='agreed',payment_terms_confirmed_at=COALESCE(payment_terms_confirmed_at,c.created_at)
      WHERE EXISTS(SELECT 1 FROM payment_requests p WHERE p.contract_id=c.id) AND NOT EXISTS(SELECT 1 FROM payment_installments i JOIN payment_requests p ON p.id=i.payment_request_id WHERE p.contract_id=c.id);
    UPDATE payment_requests SET dispatch_required_amount=0,security_status='not_required',release_status=CASE WHEN status='settled' THEN 'authorized' ELSE release_status END,
      amount_confirmed=CASE WHEN status='settled' THEN amount_total ELSE amount_confirmed END;
    INSERT INTO payment_installments(payment_request_id,installment_type,sequence_number,amount_due,due_trigger,status,payment_reference_external,submitted_at,verified_at)
      SELECT p.id,'full',1,p.amount_total,'documents_presented',CASE WHEN p.status='settled' THEN 'paid' WHEN p.status='requested' THEN 'due' ELSE 'awaiting_trigger' END,
      p.payment_reference_external,CASE WHEN p.payment_reference_external IS NOT NULL THEN COALESCE(p.settled_at,p.created_at) END,p.settled_at FROM payment_requests p
      WHERE NOT EXISTS(SELECT 1 FROM payment_installments i WHERE i.payment_request_id=p.id);
    INSERT INTO platform_fee_invoices(contract_id,rate_bps,amount_total,currency,status,invoiced_at)
      SELECT c.id,100,ROUND((c.quantity_kg*c.price_per_kg*100/10000.0)::numeric,2),c.currency,CASE WHEN c.status='settled' THEN 'invoiced' ELSE 'estimated' END,
      CASE WHEN c.status='settled' THEN NOW() END FROM sales_contracts c WHERE NOT EXISTS(SELECT 1 FROM platform_fee_invoices f WHERE f.contract_id=c.id);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP TABLE IF EXISTS platform_fee_invoices; DROP TABLE IF EXISTS payment_installments; DROP INDEX IF EXISTS idx_payment_requests_contract_unique;
    ALTER TABLE shipments DROP COLUMN IF EXISTS dispatch_exception_recorded_by_user_id; ALTER TABLE shipments DROP COLUMN IF EXISTS dispatch_exception_recorded_at;
    ALTER TABLE shipments DROP COLUMN IF EXISTS dispatch_exception_reason; ALTER TABLE shipments DROP COLUMN IF EXISTS dispatch_exception;
    ALTER TABLE payment_requests DROP COLUMN IF EXISTS updated_at; ALTER TABLE payment_requests DROP COLUMN IF EXISTS release_status;
    ALTER TABLE payment_requests DROP COLUMN IF EXISTS security_verified_by_user_id; ALTER TABLE payment_requests DROP COLUMN IF EXISTS security_verified_at;
    ALTER TABLE payment_requests DROP COLUMN IF EXISTS security_submitted_at; ALTER TABLE payment_requests DROP COLUMN IF EXISTS security_reference;
    ALTER TABLE payment_requests DROP COLUMN IF EXISTS security_provider; ALTER TABLE payment_requests DROP COLUMN IF EXISTS security_status;
    ALTER TABLE payment_requests DROP COLUMN IF EXISTS documents_presented_at; ALTER TABLE payment_requests DROP COLUMN IF EXISTS amount_confirmed;
    ALTER TABLE payment_requests DROP COLUMN IF EXISTS dispatch_required_amount; ALTER TABLE sales_contracts DROP COLUMN IF EXISTS completed_at;
    ALTER TABLE sales_contracts DROP COLUMN IF EXISTS payment_terms_confirmed_by_user_id; ALTER TABLE sales_contracts DROP COLUMN IF EXISTS payment_terms_confirmed_at;
    ALTER TABLE sales_contracts DROP COLUMN IF EXISTS payment_terms_note; ALTER TABLE sales_contracts DROP COLUMN IF EXISTS payment_terms_status;
    ALTER TABLE sales_contracts DROP COLUMN IF EXISTS credit_days; ALTER TABLE sales_contracts DROP COLUMN IF EXISTS deposit_percentage; ALTER TABLE sales_contracts DROP COLUMN IF EXISTS payment_plan;`);
}
