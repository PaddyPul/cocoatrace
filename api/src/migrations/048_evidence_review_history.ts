import type { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE evidence_items
    ADD COLUMN superseded_by_evidence_id UUID REFERENCES evidence_items(id),
    ADD COLUMN replaces_evidence_id UUID REFERENCES evidence_items(id),
    ADD COLUMN review_revision INTEGER NOT NULL DEFAULT 0 CHECK(review_revision>=0),
    ADD CONSTRAINT evidence_no_self_replacement CHECK(id IS DISTINCT FROM superseded_by_evidence_id AND id IS DISTINCT FROM replaces_evidence_id);
    CREATE UNIQUE INDEX evidence_single_predecessor ON evidence_items(replaces_evidence_id) WHERE replaces_evidence_id IS NOT NULL;
    CREATE UNIQUE INDEX evidence_single_successor ON evidence_items(superseded_by_evidence_id) WHERE superseded_by_evidence_id IS NOT NULL;
    CREATE INDEX evidence_review_queue ON evidence_items(review_status,id DESC) WHERE superseded_by_evidence_id IS NULL;
    CREATE TABLE evidence_review_decisions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), evidence_id UUID NOT NULL REFERENCES evidence_items(id),
      decision TEXT NOT NULL CHECK(decision IN('approved','rejected')), reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 10 AND 2000),
      actor_user_id UUID NOT NULL REFERENCES users(id), actor_organization_id UUID NOT NULL REFERENCES organizations(id),
      source_hash TEXT NOT NULL, linked_entity_type TEXT NOT NULL, linked_entity_id UUID NOT NULL,
      expected_fingerprint TEXT NOT NULL, revision INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(evidence_id,revision));
    CREATE FUNCTION preserve_evidence_review_decision() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      RAISE EXCEPTION 'Evidence review decisions are immutable'; END $$;
    CREATE TRIGGER evidence_review_decision_immutable BEFORE UPDATE OR DELETE ON evidence_review_decisions
      FOR EACH ROW EXECUTE FUNCTION preserve_evidence_review_decision();
    CREATE FUNCTION preserve_evidence_version() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF (OLD.superseded_by_evidence_id IS NOT NULL AND NEW.superseded_by_evidence_id IS DISTINCT FROM OLD.superseded_by_evidence_id)
        OR (OLD.replaces_evidence_id IS NOT NULL AND NEW.replaces_evidence_id IS DISTINCT FROM OLD.replaces_evidence_id)
        OR ((OLD.superseded_by_evidence_id IS NOT NULL OR OLD.replaces_evidence_id IS NOT NULL) AND
          (NEW.sha256_hash IS DISTINCT FROM OLD.sha256_hash OR NEW.linked_entity_id IS DISTINCT FROM OLD.linked_entity_id
          OR NEW.linked_entity_type IS DISTINCT FROM OLD.linked_entity_type OR NEW.uploader_organization_id IS DISTINCT FROM OLD.uploader_organization_id
          OR NEW.storage_key IS DISTINCT FROM OLD.storage_key OR NEW.storage_path IS DISTINCT FROM OLD.storage_path
          OR NEW.storage_provider IS DISTINCT FROM OLD.storage_provider OR NEW.file_size_bytes IS DISTINCT FROM OLD.file_size_bytes
          OR NEW.type IS DISTINCT FROM OLD.type OR NEW.file_name IS DISTINCT FROM OLD.file_name))
      THEN RAISE EXCEPTION 'Evidence source and established lineage are immutable'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER evidence_version_immutable BEFORE UPDATE ON evidence_items FOR EACH ROW EXECUTE FUNCTION preserve_evidence_version();`);
}
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP TRIGGER evidence_version_immutable ON evidence_items; DROP FUNCTION preserve_evidence_version();
    DROP TABLE evidence_review_decisions; DROP FUNCTION preserve_evidence_review_decision();
    DROP INDEX evidence_review_queue; DROP INDEX evidence_single_predecessor; DROP INDEX evidence_single_successor;
    ALTER TABLE evidence_items DROP CONSTRAINT evidence_no_self_replacement, DROP COLUMN superseded_by_evidence_id, DROP COLUMN replaces_evidence_id, DROP COLUMN review_revision;`);
}
