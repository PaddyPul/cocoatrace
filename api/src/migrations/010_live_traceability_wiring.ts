import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    INSERT INTO material_lots (
      lot_code, lot_type, batch_id, product_name, quantity_kg,
      owner_organization_id, status, produced_at
    )
    SELECT
      'SRC-' || UPPER(SUBSTRING(REPLACE(b.id::text, '-', '') FROM 1 FOR 12)),
      'source', b.id, b.crop, b.quantity_kg,
      b.current_holder_id, 'available', b.harvest_date::timestamptz
    FROM harvest_batches b
    WHERE NOT EXISTS (SELECT 1 FROM material_lots ml WHERE ml.batch_id=b.id)
    ON CONFLICT (batch_id) DO NOTHING;

    INSERT INTO lot_distributions (
      lot_id, shipment_id, recipient_organization_id, quantity_kg,
      distribution_reference, dispatched_at
    )
    SELECT
      ml.id, sh.id, c.buyer_organization_id, c.quantity_kg,
      'SHIP-' || sh.id::text,
      COALESCE(
        (SELECT sm.recorded_at FROM shipment_milestones sm
          WHERE sm.shipment_id=sh.id AND sm.milestone IN ('loaded','departed')
          ORDER BY sm.recorded_at LIMIT 1),
        sh.delivered_at,
        sh.created_at
      )
    FROM shipments sh
    JOIN sales_contracts c ON c.id=sh.contract_id
    JOIN batch_holdings h ON h.id=c.holding_id
    JOIN material_lots ml ON ml.batch_id=h.batch_id
    WHERE sh.current_milestone='delivered' OR sh.delivered_at IS NOT NULL
    ON CONFLICT (distribution_reference) DO UPDATE SET
      recipient_organization_id=EXCLUDED.recipient_organization_id,
      quantity_kg=EXCLUDED.quantity_kg;
  `);
}

export async function down(_knex: Knex): Promise<void> {
  // Backfilled lots may already be referenced by traces or recalls. Keep them on rollback.
}
