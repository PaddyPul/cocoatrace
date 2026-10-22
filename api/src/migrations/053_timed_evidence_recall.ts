import type { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE evidence_upload_intents ADD COLUMN document_expires_at TIMESTAMPTZ;
    ALTER TABLE evidence_items ADD COLUMN document_expires_at TIMESTAMPTZ;
    ALTER TABLE recall_notices ADD COLUMN acknowledgement_due_at TIMESTAMPTZ;
    CREATE INDEX evidence_document_expiry ON evidence_items(uploader_organization_id,document_expires_at,id)
      WHERE document_expires_at IS NOT NULL AND superseded_by_evidence_id IS NULL;
    CREATE INDEX certificate_renewal_due ON organic_certificates(certifier_organization_id,valid_to,id)
      WHERE status IN ('active','expired');
    CREATE INDEX certificate_farmer_renewal_due ON organic_certificates(farmer_organization_id,valid_to,id)
      WHERE status IN ('active','expired');
    CREATE INDEX recall_participant_pending_org ON recall_participants(organization_id,recall_id)
      WHERE acknowledged_at IS NULL;
    CREATE INDEX recall_acknowledgement_due ON recall_notices(acknowledgement_due_at,id)
      WHERE status='active' AND acknowledgement_due_at IS NOT NULL;
  `);
}
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DO $$ BEGIN
    IF EXISTS(SELECT 1 FROM evidence_items WHERE document_expires_at IS NOT NULL)
      OR EXISTS(SELECT 1 FROM evidence_upload_intents WHERE document_expires_at IS NOT NULL)
      OR EXISTS(SELECT 1 FROM recall_notices WHERE acknowledgement_due_at IS NOT NULL) THEN
      RAISE EXCEPTION 'Timed evidence/recall history exists; use forward repair';
    END IF;
  END $$;
  DROP INDEX evidence_document_expiry; DROP INDEX certificate_renewal_due; DROP INDEX certificate_farmer_renewal_due; DROP INDEX recall_participant_pending_org; DROP INDEX recall_acknowledgement_due;
  ALTER TABLE evidence_items DROP COLUMN document_expires_at;
  ALTER TABLE evidence_upload_intents DROP COLUMN document_expires_at;
  ALTER TABLE recall_notices DROP COLUMN acknowledgement_due_at;`);
}
