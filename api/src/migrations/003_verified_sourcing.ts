import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS sourcing_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      buyer_organization_id UUID NOT NULL REFERENCES organizations(id),
      created_by_user_id UUID NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      commodity TEXT NOT NULL,
      quantity_kg NUMERIC(12,3) NOT NULL CHECK (quantity_kg > 0),
      origin_countries TEXT[] NOT NULL DEFAULT '{}',
      quality_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
      assurance_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
      delivery_location TEXT NOT NULL,
      incoterm TEXT NOT NULL DEFAULT 'CIF',
      required_by DATE,
      offer_deadline TIMESTAMPTZ,
      visibility TEXT NOT NULL DEFAULT 'matched' CHECK (visibility IN ('matched','invited','private')),
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','awarded','closed','cancelled')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sourcing_requests_buyer_status
      ON sourcing_requests (buyer_organization_id, status, created_at DESC);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE IF EXISTS sourcing_requests');
}
