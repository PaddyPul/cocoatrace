import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE TABLE auth_rate_limits (
    bucket_key VARCHAR(64) PRIMARY KEY CHECK (bucket_key ~ '^[0-9a-f]{64}$'),
    attempts INTEGER NOT NULL CHECK (attempts > 0),
    expires_at TIMESTAMPTZ NOT NULL
  );
  CREATE INDEX auth_rate_limits_expiry ON auth_rate_limits(expires_at);`);
}
export async function down(): Promise<void> {
  throw new Error('Do not roll back shared authentication protection; use a forward correction');
}
