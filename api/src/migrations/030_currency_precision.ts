import type { Knex } from 'knex';
/** Existing financial rows retain two-decimal semantics, including legacy JPY. */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE sales_contracts ADD COLUMN currency_minor_units INTEGER NOT NULL DEFAULT 2 CHECK(currency_minor_units IN(0,2));
    ALTER TABLE payment_requests ADD COLUMN currency_minor_units INTEGER NOT NULL DEFAULT 2 CHECK(currency_minor_units IN(0,2)),
      ADD CONSTRAINT payment_minor_units_amounts CHECK(amount_total=round(amount_total,currency_minor_units) AND amount_confirmed=round(amount_confirmed,currency_minor_units) AND dispatch_required_amount=round(dispatch_required_amount,currency_minor_units));
    ALTER TABLE payment_installments ADD COLUMN currency_minor_units INTEGER NOT NULL DEFAULT 2 CHECK(currency_minor_units IN(0,2)),
      ADD CONSTRAINT installment_minor_units_amount CHECK(amount_due=round(amount_due,currency_minor_units));
    ALTER TABLE platform_fee_invoices ADD COLUMN currency_minor_units INTEGER NOT NULL DEFAULT 2 CHECK(currency_minor_units IN(0,2)),
      ADD CONSTRAINT fee_minor_units_amount CHECK(amount_total=round(amount_total,currency_minor_units));
  `);
}
export async function down(): Promise<void> {
  throw new Error('Financial precision snapshots must be retained; use a forward correction');
}
