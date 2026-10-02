import type {Knex} from 'knex';
export async function up(knex:Knex):Promise<void> {
  await knex.raw(`
    ALTER TABLE recall_notices ADD COLUMN resolution_reason TEXT;
    ALTER TABLE recall_notices ADD COLUMN resolved_by_user_id UUID REFERENCES users(id);
    ALTER TABLE recall_notices ADD COLUMN resolution_evidence_ids UUID[] NOT NULL DEFAULT '{}';
    CREATE TABLE recall_participants(
      recall_id UUID NOT NULL REFERENCES recall_notices(id),organization_id UUID NOT NULL REFERENCES organizations(id),
      first_queued_at TIMESTAMPTZ,acknowledged_at TIMESTAMPTZ,acknowledged_by_user_id UUID REFERENCES users(id),
      acknowledgement_note TEXT,contact_status TEXT NOT NULL DEFAULT 'pending' CHECK(contact_status IN ('pending','contacted','unreachable','escalated')),
      contact_note TEXT,contact_updated_by_user_id UUID REFERENCES users(id),contact_updated_at TIMESTAMPTZ,
      PRIMARY KEY(recall_id,organization_id)
    );
    CREATE TABLE recall_recovery_records(
      recall_id UUID NOT NULL REFERENCES recall_notices(id),holding_id UUID NOT NULL REFERENCES batch_holdings(id),
      quarantined_kg NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK(quarantined_kg>=0 AND quarantined_kg<>'NaN'::numeric),
      returned_kg NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK(returned_kg>=0 AND returned_kg<>'NaN'::numeric),
      destroyed_kg NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK(destroyed_kg>=0 AND destroyed_kg<>'NaN'::numeric),
      corrected_kg NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK(corrected_kg>=0 AND corrected_kg<>'NaN'::numeric),
      released_kg NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK(released_kg>=0 AND released_kg<>'NaN'::numeric),
      note TEXT NOT NULL,recorded_by_user_id UUID NOT NULL REFERENCES users(id),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(recall_id,holding_id)
    );
    CREATE TABLE recall_email_outbox(
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),recall_id UUID NOT NULL REFERENCES recall_notices(id),
      recipient_user_id UUID NOT NULL REFERENCES users(id),event_type TEXT NOT NULL DEFAULT 'activated' CHECK(event_type IN ('activated','resolved')),
      status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','sent','suppressed','failed','failed_terminal')),
      attempts INTEGER NOT NULL DEFAULT 0,next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      lease_token UUID,lease_expires_at TIMESTAMPTZ,sent_at TIMESTAMPTZ,last_error TEXT,exhausted_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(recall_id,recipient_user_id,event_type)
    );
    CREATE INDEX recall_email_pending ON recall_email_outbox(next_attempt_at) WHERE status IN ('queued','failed','sending');
    CREATE INDEX recall_participant_organization ON recall_participants(organization_id,recall_id);
    INSERT INTO recall_participants(recall_id,organization_id)
      SELECT recall.id,recall.initiated_by_organization_id FROM recall_notices recall
      UNION SELECT affected.recall_id,holding.holder_organization_id FROM recall_affected_batches affected JOIN batch_holdings holding ON holding.batch_id=affected.batch_id
      UNION SELECT affected.recall_id,contract.buyer_organization_id FROM recall_affected_batches affected JOIN batch_holdings holding ON holding.batch_id=affected.batch_id JOIN sales_contracts contract ON contract.holding_id=holding.id
      UNION SELECT affected.recall_id,contract.seller_organization_id FROM recall_affected_batches affected JOIN batch_holdings holding ON holding.batch_id=affected.batch_id JOIN sales_contracts contract ON contract.holding_id=holding.id
      UNION SELECT affected.recall_id,lot.owner_organization_id FROM recall_affected_lots affected JOIN material_lots lot ON lot.id=affected.lot_id
      UNION SELECT affected.recall_id,distribution.recipient_organization_id FROM recall_affected_lots affected JOIN lot_distributions distribution ON distribution.lot_id=affected.lot_id
      ON CONFLICT DO NOTHING;
    UPDATE recall_participants participant SET acknowledged_at=notice.initiated_at,acknowledged_by_user_id=notice.initiated_by_user_id,
      acknowledgement_note='Notice issued by this organization'
      FROM recall_notices notice WHERE notice.id=participant.recall_id AND notice.initiated_by_organization_id=participant.organization_id;
    INSERT INTO recall_email_outbox(recall_id,recipient_user_id)
      SELECT participant.recall_id,member.id FROM recall_participants participant JOIN recall_notices notice ON notice.id=participant.recall_id
      JOIN users member ON member.organization_id=participant.organization_id WHERE notice.status='active' AND member.active ON CONFLICT DO NOTHING;
    UPDATE recall_participants p SET first_queued_at=(SELECT MIN(queue.created_at) FROM recall_email_outbox queue JOIN users member ON member.id=queue.recipient_user_id WHERE queue.recall_id=p.recall_id AND member.organization_id=p.organization_id);
    UPDATE recall_participants p SET contact_status='escalated',contact_note='No active platform contact; operator follow-up required' WHERE NOT EXISTS(SELECT 1 FROM users member WHERE member.organization_id=p.organization_id AND member.active );
  `);
}
export async function down():Promise<void> {throw new Error('Recall responses and resolution evidence are audit history; use a reviewed forward migration.');}
