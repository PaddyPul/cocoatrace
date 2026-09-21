import type { Knex } from 'knex';
import fs from 'fs';
import path from 'path';

export async function up(knex: Knex): Promise<void> {
  const sql = fs.readFileSync(
    path.join(__dirname, '../../../db/schema.sql'), 'utf8'
  );
  await knex.raw(sql);
}

export async function down(knex: Knex): Promise<void> {
    const tables = [
      'user_invitations', 'pilot_feedback', 'user_onboarding',
    'product_profile_scans', 'recall_affected_lots', 'recall_affected_batches', 'recall_notices',
    'product_profiles', 'audit_events', 'evidence_items', 'payment_requests', 'shipment_milestones',
    'lot_distributions', 'lot_genealogy_edges', 'transformation_events', 'material_lots',
    'shipments', 'sales_contracts', 'trade_offers', 'listings',
    'custody_transfers', 'batch_holdings', 'batch_attestations', 'harvest_batches',
    'organic_certificates', 'farm_plots', 'farms', 'sessions', 'user_roles',
    'roles', 'users', 'organizations',
  ];
  for (const table of tables) {
    await knex.schema.dropTableIfExists(table);
  }
}
