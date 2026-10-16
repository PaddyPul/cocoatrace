import type { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE TABLE access_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID NOT NULL REFERENCES users(id),
    actor_organization_id UUID NOT NULL REFERENCES organizations(id),
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    next_due_at TIMESTAMPTZ NOT NULL DEFAULT (NOW()+INTERVAL '30 days'),
    reason TEXT NOT NULL CHECK(length(reason) BETWEEN 10 AND 1000),
    snapshot JSONB NOT NULL,
    snapshot_hash TEXT NOT NULL CHECK(snapshot_hash ~ '^sha256:[a-f0-9]{64}$'),
    CHECK(next_due_at=reviewed_at+INTERVAL '30 days')
  ); CREATE INDEX access_reviews_latest ON access_reviews(reviewed_at DESC,id DESC)`);
}
export async function down(knex: Knex): Promise<void> { await knex.raw('DROP TABLE IF EXISTS access_reviews'); }
