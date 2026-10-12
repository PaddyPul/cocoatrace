import type { Knex } from 'knex';

// Records object ownership before provider writes. Existing orphaned objects
// require a separate reviewed inventory; this migration does not infer owners.
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE evidence_object_cleanup (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      object_key TEXT NOT NULL UNIQUE CHECK (
        object_key ~ '^(quarantine|evidence)/(development|test|demo|staging|production)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      ),
      organization_id UUID NOT NULL REFERENCES organizations(id),
      bytes BIGINT NOT NULL CHECK (bytes >= 0),
      storage_provider TEXT NOT NULL CHECK (storage_provider IN ('local','s3')),
      upload_intent_id UUID REFERENCES evidence_upload_intents(id) ON DELETE SET NULL,
      evidence_id UUID REFERENCES evidence_items(id) ON DELETE SET NULL,
      state TEXT NOT NULL DEFAULT 'held' CHECK (state IN ('held','pending','processing','done','retained','dead')),
      lease_token UUID,
      lease_expires_at TIMESTAMPTZ,
      attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
      next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_error_code TEXT CHECK (last_error_code ~ '^[A-Z0-9_]{1,80}$'),
      reason TEXT NOT NULL CHECK (reason IN (
        'upload_quarantine','upload_final','upload_rejected','upload_expired','upload_stalled','malware_infected'
      )),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      CHECK (
        (state='processing' AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)
        OR (state<>'processing' AND lease_token IS NULL AND lease_expires_at IS NULL)
      ),
      CHECK ((state='done' AND deleted_at IS NOT NULL) OR (state<>'done' AND deleted_at IS NULL))
    );
    CREATE INDEX evidence_object_cleanup_due ON evidence_object_cleanup(next_attempt_at,id) WHERE state='pending';
    CREATE INDEX evidence_object_cleanup_expired_leases ON evidence_object_cleanup(lease_expires_at,id) WHERE state='processing';
    CREATE INDEX evidence_object_cleanup_tenant_state ON evidence_object_cleanup(organization_id,state);
    CREATE INDEX evidence_object_cleanup_held_intent ON evidence_object_cleanup(upload_intent_id,id) WHERE state='held';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM evidence_object_cleanup WHERE state<>'done') THEN
        RAISE EXCEPTION 'Evidence cleanup ledger still owns objects; reconcile them before rollback';
      END IF;
    END $$;
    DROP TABLE evidence_object_cleanup;
  `);
}
