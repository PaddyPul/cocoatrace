import type { Knex } from 'knex';

const MIGRATION = '021_trust_state_accuracy';
const SEEDED_FARMS = ['44444444-4444-4444-4444-444444444001', '44444444-4444-4444-4444-444444444002', '44444444-4444-4444-4444-444444444003'];
const SEEDED_PLOTS = ['55555555-5555-5555-5555-555555555001', '55555555-5555-5555-5555-555555555002', '55555555-5555-5555-5555-555555555003', '55555555-5555-5555-5555-555555555004'];

/** Correct raw legacy defaults without manufacturing a human review or deleting evidence. */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS trust_claim_reviews (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_type TEXT NOT NULL CHECK(entity_type IN ('organization','farm','plot','batch','evidence','certificate','attestation')),
      entity_id UUID NOT NULL,
      claim_key TEXT NOT NULL CHECK(length(trim(claim_key))>0),
      claim_source TEXT NOT NULL CHECK(length(trim(claim_source))>0),
      source_reference TEXT,
      reviewer_user_id UUID NOT NULL REFERENCES users(id),
      reviewer_organization_id UUID NOT NULL REFERENCES organizations(id),
      review_method TEXT NOT NULL CHECK(length(trim(review_method))>0),
      reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'reviewed' CHECK(status IN ('reviewed','revoked')),
      snapshot_metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    );
    CREATE INDEX IF NOT EXISTS trust_claim_reviews_entity_lookup
      ON trust_claim_reviews(entity_type,entity_id,claim_key,status);
    CREATE TABLE IF NOT EXISTS trust_state_corrections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      migration_name TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id UUID NOT NULL,
      field_name TEXT NOT NULL,
      previous_value JSONB NOT NULL,
      new_value JSONB NOT NULL,
      reason TEXT NOT NULL,
      corrected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(migration_name,entity_type,entity_id,field_name)
    );
    ALTER TABLE organizations ALTER COLUMN verification_status SET DEFAULT 'pending';
    ALTER TABLE farms ALTER COLUMN verification_status SET DEFAULT 'self_declared';
    ALTER TABLE farm_plots ALTER COLUMN verification_status SET DEFAULT 'self_declared';
    ALTER TABLE farm_plots ALTER COLUMN deforestation_risk_status SET DEFAULT 'unknown';
    ALTER TABLE farm_plots ALTER COLUMN eudr_cutoff_checked SET DEFAULT FALSE;
    ALTER TABLE evidence_items ALTER COLUMN review_status SET DEFAULT 'pending';
  `);

  // Existing organization approval governs sign-in, not claim verification. Do
  // not change approved workspace access as a side effect of this migration.
  // Deterministic fixture flags remain for reproducibility; read models must
  // require genuine review records for them, exactly as for customer data.
  const policies = [
    { table: 'farms', type: 'farm', field: 'verification_status', old: 'verified', next: 'self_declared', key: 'verification', seeds: SEEDED_FARMS },
    { table: 'farm_plots', type: 'plot', field: 'verification_status', old: 'verified', next: 'self_declared', key: 'verification', seeds: SEEDED_PLOTS },
    { table: 'farm_plots', type: 'plot', field: 'deforestation_risk_status', old: 'clear', next: 'unknown', key: 'deforestation_risk', seeds: SEEDED_PLOTS },
    { table: 'farm_plots', type: 'plot', field: 'eudr_cutoff_checked', old: true, next: false, key: 'eudr_cutoff', seeds: SEEDED_PLOTS },
    { table: 'evidence_items', type: 'evidence', field: 'review_status', old: 'approved', next: 'pending', key: 'evidence_review', seeds: [] as string[] },
  ];

  for (const policy of policies) {
    const column = policy.field;
    const owner = policy.type === 'farm' ? 'entity.farmer_organization_id'
      : policy.type === 'plot' ? '(SELECT farmer_organization_id FROM farms WHERE id=entity.farm_id)'
      : 'entity.uploader_organization_id';
    const excluded = policy.seeds.length ? `AND entity.id NOT IN (${policy.seeds.map(() => '?::uuid').join(',')})` : '';
    await knex.raw(`
      WITH unsupported AS (
        SELECT entity.id,to_jsonb(entity.${column}) AS previous_value
        FROM ${policy.table} entity
        WHERE entity.${column}=? ${excluded}
          AND NOT EXISTS (
            SELECT 1 FROM trust_claim_reviews review
            JOIN users reviewer ON reviewer.id=review.reviewer_user_id
              AND reviewer.organization_id=review.reviewer_organization_id
            WHERE review.entity_type=? AND review.entity_id=entity.id
              AND review.claim_key=? AND review.status='reviewed'
              AND review.reviewer_organization_id<>${owner}
              AND review.reviewed_at<=NOW()
              AND (review.expires_at IS NULL OR review.expires_at>NOW())
          )
      ), logged AS (
        INSERT INTO trust_state_corrections(migration_name,entity_type,entity_id,field_name,previous_value,new_value,reason)
        SELECT ?,?,id,?,previous_value,?::jsonb,'Legacy optimistic default has no attributable current review'
        FROM unsupported ON CONFLICT DO NOTHING RETURNING entity_id
      )
      UPDATE ${policy.table} entity SET ${column}=?
      WHERE entity.id IN (SELECT id FROM unsupported)
    `, [policy.old, ...policy.seeds, policy.type, policy.key, MIGRATION, policy.type, column, JSON.stringify(policy.next), policy.next]);
  }
}

export async function down(): Promise<void> {
  throw new Error('Trust corrections and review history require a reviewed forward migration; optimistic defaults cannot be restored automatically.');
}
