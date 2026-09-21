import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS user_onboarding (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed')),
      current_step INTEGER NOT NULL DEFAULT 0 CHECK (current_step BETWEEN 0 AND 4),
      primary_goal TEXT,
      pilot_mode BOOLEAN NOT NULL DEFAULT FALSE,
      completed_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS pilot_feedback (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      organization_id UUID NOT NULL REFERENCES organizations(id),
      page TEXT NOT NULL,
      task TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_pilot_feedback_org_created ON pilot_feedback (organization_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS user_invitations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id),
      email TEXT NOT NULL,
      role_id UUID NOT NULL REFERENCES roles(id),
      token_hash TEXT NOT NULL UNIQUE,
      invited_by_user_id UUID NOT NULL REFERENCES users(id),
      expires_at TIMESTAMPTZ NOT NULL,
      accepted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_user_invitations_org_created ON user_invitations (organization_id, created_at DESC);
    UPDATE roles SET permissions = array_append(permissions, 'member.invite')
      WHERE name='exporter' AND NOT ('member.invite'=ANY(permissions));
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP TABLE IF EXISTS user_invitations;
    DROP TABLE IF EXISTS pilot_feedback;
    DROP TABLE IF EXISTS user_onboarding;
    UPDATE roles SET permissions = array_remove(permissions, 'member.invite') WHERE name='exporter';
  `);
}
