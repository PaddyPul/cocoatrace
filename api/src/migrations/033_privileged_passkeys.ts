import type { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE TABLE user_passkeys (
    id TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id),
    public_key BYTEA NOT NULL, counter BIGINT NOT NULL CHECK(counter>=0),
    label TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), revoked_at TIMESTAMPTZ);
    CREATE INDEX user_passkeys_owner ON user_passkeys(user_id) WHERE revoked_at IS NULL;
    CREATE TABLE mfa_challenges (
      session_id UUID PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id), challenge TEXT NOT NULL,
      purpose TEXT NOT NULL CHECK(purpose IN ('registration','authentication')),
      expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    ALTER TABLE users ADD COLUMN mfa_recovery_approved_until TIMESTAMPTZ;
    ALTER TABLE sessions ADD COLUMN mfa_verified_at TIMESTAMPTZ;
    ALTER TABLE sessions ADD COLUMN mfa_credential_id TEXT REFERENCES user_passkeys(id);`);
}
export async function down(): Promise<void> {
  throw new Error('Passkeys are a security boundary; use a forward correction');
}
