import type { Knex } from 'knex';

export async function up(knex:Knex):Promise<void>{
  await knex.raw("ALTER TABLE sales_contracts ALTER COLUMN payment_terms_status SET DEFAULT 'draft'");
}

export async function down(knex:Knex):Promise<void>{
  await knex.raw("ALTER TABLE sales_contracts ALTER COLUMN payment_terms_status SET DEFAULT 'proposed'");
}
