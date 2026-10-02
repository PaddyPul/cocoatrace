import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE sales_contracts ADD COLUMN payment_evidence_required BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE payment_installments ADD COLUMN payment_evidence_id UUID REFERENCES evidence_items(id);
    CREATE UNIQUE INDEX payment_installment_proof_unique ON payment_installments(payment_evidence_id) WHERE payment_evidence_id IS NOT NULL;`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX payment_installment_proof_unique;
    ALTER TABLE payment_installments DROP COLUMN payment_evidence_id;
    ALTER TABLE sales_contracts DROP COLUMN payment_evidence_required;`);
}
