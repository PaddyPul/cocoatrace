import type { Knex } from 'knex';

// Forward-only constraints: refuse ambiguous legacy data rather than rewriting it.
const checks = [
  { table: 'batch_holdings', name: 'trade_holding_quantity_valid', expression: "quantity_kg <> 'NaN'::numeric AND quantity_kg > 0" },
  { table: 'batch_holdings', name: 'trade_holding_status_valid', expression: "status IN ('available','committed','transferred','consumed','distributed','held','recalled')" },
  { table: 'listings', name: 'trade_listing_quantity_valid', expression: "available_quantity_kg <> 'NaN'::numeric AND available_quantity_kg >= 0 AND (NOT active OR available_quantity_kg > 0)" },
  { table: 'listings', name: 'trade_listing_price_valid', expression: "price_per_kg <> 'NaN'::numeric AND price_per_kg > 0" },
  { table: 'trade_offers', name: 'trade_offer_quantity_valid', expression: "quantity_kg <> 'NaN'::numeric AND quantity_kg > 0" },
  { table: 'trade_offers', name: 'trade_offer_price_valid', expression: "offered_price_per_kg <> 'NaN'::numeric AND offered_price_per_kg > 0" },
  { table: 'trade_offers', name: 'trade_offer_status_valid', expression: "status IN ('pending','accepted','rejected','expired','cancelled')" },
  { table: 'sales_contracts', name: 'trade_contract_quantity_valid', expression: "quantity_kg <> 'NaN'::numeric AND quantity_kg > 0" },
  { table: 'sales_contracts', name: 'trade_contract_price_valid', expression: "price_per_kg <> 'NaN'::numeric AND price_per_kg > 0" },
  { table: 'sales_contracts', name: 'trade_contract_status_valid', expression: "status IN ('accepted','fulfilment_in_progress','in_transit','payment_risk_exception','delivered','delivered_payment_risk','settled','cancelled')" },
  { table: 'custody_transfers', name: 'trade_transfer_quantity_valid', expression: "quantity_kg <> 'NaN'::numeric AND quantity_kg > 0" },
  { table: 'custody_transfers', name: 'trade_transfer_status_valid', expression: "status IN ('requested','accepted','rejected','cancelled')" },
] as const;

export async function up(knex: Knex): Promise<void> {
  // Knex runs this migration in one transaction. Block writes during preflight so
  // no row can change between the checks and constraint validation.
  await knex.raw('LOCK TABLE batch_holdings,listings,trade_offers,sales_contracts,custody_transfers IN ACCESS EXCLUSIVE MODE');
  for (const check of checks) {
    const result = await knex.raw(`SELECT id FROM ${check.table} WHERE NOT (${check.expression}) LIMIT 5`);
    if (result.rows.length) throw new Error(`Trade integrity migration refused: ${check.name} fails in ${check.table} for IDs ${result.rows.map((row: { id: string }) => row.id).join(', ')}. Reconcile these records explicitly; no customer records were changed.`);
  }
  const duplicates = await knex.raw('SELECT offer_id FROM sales_contracts GROUP BY offer_id HAVING COUNT(*) > 1 LIMIT 5');
  if (duplicates.rows.length) throw new Error(`Trade integrity migration refused: multiple sales contracts reference offer IDs ${duplicates.rows.map((row: { offer_id: string }) => row.offer_id).join(', ')}. Reconcile duplicate agreements explicitly; no customer records were changed.`);
  for (const check of checks) await knex.raw(`ALTER TABLE ${check.table} ADD CONSTRAINT ${check.name} CHECK (${check.expression})`);
  await knex.raw('ALTER TABLE sales_contracts ADD CONSTRAINT trade_contract_one_per_offer UNIQUE (offer_id)');
}

export async function down(): Promise<void> {
  throw new Error('Trade integrity constraints cannot be rolled back automatically: this removes production safeguards. Use a reviewed forward migration; no records were changed.');
}
