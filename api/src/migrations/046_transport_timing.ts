import type { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE shipments ADD COLUMN timing_revision INTEGER NOT NULL DEFAULT 0 CHECK(timing_revision>=0);
    CREATE TABLE shipment_timing_history (
      shipment_id UUID NOT NULL REFERENCES shipments(id),
      revision INTEGER NOT NULL CHECK(revision>0),
      eta_arrival DATE NOT NULL,
      reason TEXT NOT NULL CHECK(length(reason) BETWEEN 3 AND 1000),
      actor_user_id UUID NOT NULL,
      organization_id UUID NOT NULL REFERENCES organizations(id),
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(shipment_id,revision)
    );
    CREATE FUNCTION protect_shipment_timing_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Transport timing history is immutable'; END $$;
    CREATE TRIGGER immutable_shipment_timing_history BEFORE UPDATE OR DELETE ON shipment_timing_history FOR EACH ROW EXECUTE FUNCTION protect_shipment_timing_history();`);
}
export async function down(): Promise<void> { throw new Error('Forward-only migration'); }
