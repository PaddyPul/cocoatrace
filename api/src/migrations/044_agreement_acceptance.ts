import type { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE TABLE agreement_versions (
    contract_id UUID NOT NULL REFERENCES sales_contracts(id) ON DELETE RESTRICT,
    version INTEGER NOT NULL CHECK(version>0), schema_version INTEGER NOT NULL CHECK(schema_version=1),
    snapshot_hash TEXT NOT NULL CHECK(snapshot_hash ~ '^[a-f0-9]{64}$'), snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(contract_id,version));
    CREATE TABLE agreement_acceptances (
    contract_id UUID NOT NULL, version INTEGER NOT NULL, organization_id UUID NOT NULL REFERENCES organizations(id),
    actor_user_id UUID NOT NULL REFERENCES users(id), accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(contract_id,version,organization_id),
    FOREIGN KEY(contract_id,version) REFERENCES agreement_versions(contract_id,version) ON DELETE RESTRICT);
    CREATE FUNCTION preserve_agreement_record() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      RAISE EXCEPTION 'Agreement history is immutable'; END $$;
    CREATE TRIGGER agreement_versions_immutable BEFORE UPDATE OR DELETE ON agreement_versions FOR EACH ROW EXECUTE FUNCTION preserve_agreement_record();
    CREATE TRIGGER agreement_acceptances_immutable BEFORE UPDATE OR DELETE ON agreement_acceptances FOR EACH ROW EXECUTE FUNCTION preserve_agreement_record();`);
}
export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE agreement_acceptances; DROP TABLE agreement_versions; DROP FUNCTION preserve_agreement_record()');
}
