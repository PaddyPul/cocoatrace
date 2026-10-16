import type { Knex } from 'knex';
export async function up(knex:Knex):Promise<void> {
  await knex.raw(`CREATE TABLE sourcing_request_closeouts (
    request_id UUID PRIMARY KEY REFERENCES sourcing_requests(id),
    buyer_organization_id UUID NOT NULL REFERENCES organizations(id),
    actor_user_id UUID NOT NULL REFERENCES users(id),
    status TEXT NOT NULL CHECK(status IN ('awarded','closed')),
    reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 10 AND 2000),
    contract_id UUID REFERENCES sales_contracts(id),
    association_basis TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK((status='awarded' AND contract_id IS NOT NULL AND association_basis='buyer_manual') OR (status='closed' AND contract_id IS NULL AND association_basis IS NULL))
  );
  CREATE FUNCTION prevent_sourcing_closeout_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Sourcing closeout is immutable'; END $$;
  CREATE TRIGGER sourcing_closeout_immutable BEFORE UPDATE OR DELETE ON sourcing_request_closeouts FOR EACH ROW EXECUTE FUNCTION prevent_sourcing_closeout_mutation();`);
}
export async function down(knex:Knex):Promise<void> {
  await knex.raw('DROP TABLE sourcing_request_closeouts; DROP FUNCTION prevent_sourcing_closeout_mutation()');
}
