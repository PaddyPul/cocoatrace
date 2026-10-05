import type { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE TABLE contract_cancellation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES sales_contracts(id) ON DELETE RESTRICT,
    requested_by_user_id UUID NOT NULL REFERENCES users(id),
    requested_by_organization_id UUID NOT NULL REFERENCES organizations(id),
    reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 10 AND 2000),
    status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','approved','rejected')),
    reviewed_by_user_id UUID REFERENCES users(id),
    reviewed_by_organization_id UUID REFERENCES organizations(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK ((status='requested' AND reviewed_at IS NULL) OR
           (status<>'requested' AND reviewed_at IS NOT NULL AND reviewed_by_user_id IS NOT NULL AND reviewed_by_organization_id IS NOT NULL)),
    CHECK (reviewed_by_organization_id IS NULL OR reviewed_by_organization_id<>requested_by_organization_id)
  );
  CREATE UNIQUE INDEX contract_cancellation_pending ON contract_cancellation_requests(contract_id) WHERE status='requested';
  CREATE INDEX contract_cancellation_history ON contract_cancellation_requests(contract_id,created_at);`);
}
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DO $$ BEGIN
    IF EXISTS(SELECT 1 FROM contract_cancellation_requests) THEN
      RAISE EXCEPTION 'Cancellation history exists; keep the schema and use a forward correction';
    END IF;
    DROP TABLE contract_cancellation_requests;
  END $$;`);
}
