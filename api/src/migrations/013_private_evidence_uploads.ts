import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE evidence_items ALTER COLUMN storage_path DROP NOT NULL;
    ALTER TABLE evidence_items ADD COLUMN IF NOT EXISTS storage_key TEXT;
    ALTER TABLE evidence_items ADD COLUMN IF NOT EXISTS storage_provider TEXT NOT NULL DEFAULT 'legacy_local';
    ALTER TABLE evidence_items ADD COLUMN IF NOT EXISTS detected_mime_type TEXT;
    ALTER TABLE evidence_items ADD COLUMN IF NOT EXISTS validation_status TEXT NOT NULL DEFAULT 'validated';
    CREATE UNIQUE INDEX IF NOT EXISTS idx_evidence_items_storage_key ON evidence_items(storage_key) WHERE storage_key IS NOT NULL;
    CREATE TABLE IF NOT EXISTS evidence_upload_intents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), uploader_user_id UUID NOT NULL REFERENCES users(id),
      uploader_organization_id UUID NOT NULL REFERENCES organizations(id), evidence_type TEXT NOT NULL,
      original_file_name TEXT NOT NULL, claimed_mime_type TEXT NOT NULL,
      declared_size_bytes BIGINT NOT NULL CHECK (declared_size_bytes > 0), linked_entity_type TEXT NOT NULL,
      linked_entity_id UUID NOT NULL, claim_description TEXT NOT NULL DEFAULT '', quarantine_object_key TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','uploading','completed','rejected','expired')),
      rejection_reason TEXT, evidence_item_id UUID REFERENCES evidence_items(id), expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_evidence_upload_intents_quota ON evidence_upload_intents(uploader_organization_id,status,expires_at);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP TABLE IF EXISTS evidence_upload_intents;
    DROP INDEX IF EXISTS idx_evidence_items_storage_key;
    UPDATE evidence_items SET storage_path=COALESCE(storage_path,storage_key) WHERE storage_path IS NULL;
    ALTER TABLE evidence_items ALTER COLUMN storage_path SET NOT NULL;
    ALTER TABLE evidence_items DROP COLUMN IF EXISTS validation_status;
    ALTER TABLE evidence_items DROP COLUMN IF EXISTS detected_mime_type;
    ALTER TABLE evidence_items DROP COLUMN IF EXISTS storage_provider;
    ALTER TABLE evidence_items DROP COLUMN IF EXISTS storage_key;
  `);
}
