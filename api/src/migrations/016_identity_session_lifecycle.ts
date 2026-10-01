import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS revoked_reason TEXT;
    CREATE INDEX IF NOT EXISTS idx_sessions_user_active
      ON sessions(user_id, expires_at) WHERE revoked_at IS NULL;

    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_active
      ON password_reset_tokens(user_id, expires_at) WHERE used_at IS NULL;

    CREATE TABLE IF NOT EXISTS security_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_type TEXT NOT NULL,
      actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      actor_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
      session_id UUID,
      success BOOLEAN NOT NULL,
      reason TEXT,
      metadata JSONB NOT NULL DEFAULT '{}',
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_security_events_type_time
      ON security_events(event_type, occurred_at DESC);
    CREATE INDEX IF NOT EXISTS idx_security_events_actor_time
      ON security_events(actor_user_id, occurred_at DESC);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP TABLE IF EXISTS security_events;
    DROP TABLE IF EXISTS password_reset_tokens;
    DROP INDEX IF EXISTS idx_sessions_user_active;
    ALTER TABLE sessions DROP COLUMN IF EXISTS revoked_reason;
    ALTER TABLE sessions DROP COLUMN IF EXISTS last_seen_at;
    ALTER TABLE users DROP COLUMN IF EXISTS password_changed_at;
  `);
}
