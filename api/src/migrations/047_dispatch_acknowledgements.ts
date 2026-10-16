import type { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE TABLE dispatch_acknowledgements (
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE RESTRICT,
    exception_hash TEXT NOT NULL CHECK(exception_hash ~ '^[a-f0-9]{64}$'),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    actor_user_id UUID NOT NULL REFERENCES users(id), acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(shipment_id,exception_hash,organization_id));
    CREATE FUNCTION preserve_dispatch_acknowledgement() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      RAISE EXCEPTION 'Dispatch acknowledgement history is immutable'; END $$;
    CREATE TRIGGER dispatch_acknowledgements_immutable BEFORE UPDATE OR DELETE ON dispatch_acknowledgements
    FOR EACH ROW EXECUTE FUNCTION preserve_dispatch_acknowledgement();`);
}
export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE dispatch_acknowledgements; DROP FUNCTION preserve_dispatch_acknowledgement()');
}
