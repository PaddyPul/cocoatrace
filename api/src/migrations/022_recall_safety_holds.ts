import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE recall_safety_holds (
      recall_id UUID NOT NULL REFERENCES recall_notices(id),
      entity_type TEXT NOT NULL CHECK(entity_type IN ('lot','holding')),
      entity_id UUID NOT NULL,
      held_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      released_at TIMESTAMPTZ,
      PRIMARY KEY(recall_id,entity_type,entity_id)
    );
    CREATE INDEX recall_safety_hold_entity ON recall_safety_holds(entity_type,entity_id) WHERE released_at IS NULL;
    INSERT INTO recall_affected_batches(recall_id,batch_id)
      SELECT DISTINCT affected.recall_id,lot.batch_id FROM recall_affected_lots affected
      JOIN material_lots lot ON lot.id=affected.lot_id JOIN recall_notices recall ON recall.id=affected.recall_id
      WHERE recall.status='active' AND lot.batch_id IS NOT NULL ON CONFLICT DO NOTHING;
    INSERT INTO recall_safety_holds(recall_id,entity_type,entity_id)
      SELECT affected.recall_id,'lot',affected.lot_id FROM recall_affected_lots affected
      JOIN recall_notices recall ON recall.id=affected.recall_id WHERE recall.status='active';
    INSERT INTO recall_safety_holds(recall_id,entity_type,entity_id)
      SELECT affected.recall_id,'holding',holding.id FROM recall_affected_batches affected
      JOIN recall_notices recall ON recall.id=affected.recall_id JOIN batch_holdings holding ON holding.batch_id=affected.batch_id
      WHERE recall.status='active' ON CONFLICT DO NOTHING;
    UPDATE listings SET active=FALSE WHERE active AND holding_id IN (
      SELECT hold.entity_id FROM recall_safety_holds hold WHERE hold.entity_type='holding' AND hold.released_at IS NULL
    );
  `);
}
export async function down(): Promise<void> {
  throw new Error('Safety holds and recall history require a reviewed forward migration; automatic removal is not supported.');
}
