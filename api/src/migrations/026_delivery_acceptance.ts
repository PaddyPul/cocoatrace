import type { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE delivery_acceptances (
      contract_id UUID PRIMARY KEY REFERENCES sales_contracts(id) ON DELETE RESTRICT,
      received_quantity_kg NUMERIC(18,3) NOT NULL CHECK (received_quantity_kg>0),
      accepted_by_user_id UUID NOT NULL REFERENCES users(id),
      accepted_by_organization_id UUID NOT NULL REFERENCES organizations(id),
      note TEXT NOT NULL, accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE delivery_discrepancies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      contract_id UUID NOT NULL REFERENCES sales_contracts(id) ON DELETE RESTRICT,
      kind TEXT NOT NULL CHECK (kind IN ('shortage','damage','rejection')),
      received_quantity_kg NUMERIC(18,3) NOT NULL CHECK (received_quantity_kg>=0),
      reason TEXT NOT NULL, evidence_ids UUID[] NOT NULL CHECK (cardinality(evidence_ids)>0),
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolution_proposed','resolved')),
      reported_by_user_id UUID NOT NULL REFERENCES users(id),
      reported_by_organization_id UUID NOT NULL REFERENCES organizations(id),
      resolution_note TEXT, resolution_proposed_by_organization_id UUID REFERENCES organizations(id),
      resolution_proposed_by_user_id UUID REFERENCES users(id),
      resolved_by_user_id UUID REFERENCES users(id), resolved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX delivery_one_active_discrepancy ON delivery_discrepancies(contract_id) WHERE status<>'resolved';
    CREATE INDEX delivery_discrepancy_history ON delivery_discrepancies(contract_id,created_at DESC);
  `);
}
export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE delivery_discrepancies; DROP TABLE delivery_acceptances;');
}
