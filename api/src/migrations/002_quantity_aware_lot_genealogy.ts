import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS material_lots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lot_code TEXT NOT NULL UNIQUE,
      lot_type TEXT NOT NULL CHECK (lot_type IN ('source','production','packaging')),
      batch_id UUID UNIQUE REFERENCES harvest_batches(id),
      product_name TEXT NOT NULL,
      quantity_kg NUMERIC(14,3) NOT NULL CHECK (quantity_kg > 0),
      owner_organization_id UUID NOT NULL REFERENCES organizations(id),
      status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','consumed','distributed','held','recalled')),
      produced_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK ((lot_type = 'source' AND batch_id IS NOT NULL) OR lot_type <> 'source')
    );

    CREATE TABLE IF NOT EXISTS transformation_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_code TEXT NOT NULL UNIQUE,
      event_type TEXT NOT NULL CHECK (event_type IN ('blend','process','package','repack')),
      facility_organization_id UUID NOT NULL REFERENCES organizations(id),
      occurred_at TIMESTAMPTZ NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS lot_genealogy_edges (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      transformation_event_id UUID NOT NULL REFERENCES transformation_events(id) ON DELETE CASCADE,
      source_lot_id UUID NOT NULL REFERENCES material_lots(id),
      destination_lot_id UUID NOT NULL REFERENCES material_lots(id),
      allocated_input_kg NUMERIC(14,3) NOT NULL CHECK (allocated_input_kg > 0),
      allocation_method TEXT NOT NULL DEFAULT 'declared' CHECK (allocation_method IN ('declared','proportional')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(transformation_event_id, source_lot_id, destination_lot_id),
      CHECK (source_lot_id <> destination_lot_id)
    );

    CREATE TABLE IF NOT EXISTS lot_distributions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lot_id UUID NOT NULL REFERENCES material_lots(id),
      shipment_id UUID REFERENCES shipments(id),
      recipient_organization_id UUID NOT NULL REFERENCES organizations(id),
      quantity_kg NUMERIC(14,3) NOT NULL CHECK (quantity_kg > 0),
      distribution_reference TEXT NOT NULL UNIQUE,
      dispatched_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS recall_affected_lots (
      recall_id UUID NOT NULL REFERENCES recall_notices(id) ON DELETE CASCADE,
      lot_id UUID NOT NULL REFERENCES material_lots(id),
      source_equivalent_kg NUMERIC(14,3) NOT NULL CHECK (source_equivalent_kg >= 0),
      recall_quantity_kg NUMERIC(14,3) NOT NULL CHECK (recall_quantity_kg > 0),
      relationship_depth INTEGER NOT NULL DEFAULT 0 CHECK (relationship_depth >= 0),
      CHECK (source_equivalent_kg <= recall_quantity_kg),
      PRIMARY KEY (recall_id, lot_id)
    );

    CREATE INDEX IF NOT EXISTS idx_material_lots_batch ON material_lots(batch_id);
    CREATE INDEX IF NOT EXISTS idx_genealogy_source ON lot_genealogy_edges(source_lot_id);
    CREATE INDEX IF NOT EXISTS idx_genealogy_destination ON lot_genealogy_edges(destination_lot_id);
    CREATE INDEX IF NOT EXISTS idx_lot_distributions_lot ON lot_distributions(lot_id);
    CREATE INDEX IF NOT EXISTS idx_recall_lots_lot ON recall_affected_lots(lot_id);
  `);
}

export async function down(knex: Knex): Promise<void> {
  for (const table of ['recall_affected_lots', 'lot_distributions', 'lot_genealogy_edges', 'transformation_events', 'material_lots']) {
    await knex.schema.dropTableIfExists(table);
  }
}
