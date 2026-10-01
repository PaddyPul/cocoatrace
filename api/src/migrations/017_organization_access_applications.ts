import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE organization_access_applications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_name TEXT NOT NULL,
      organization_type TEXT NOT NULL CHECK (organization_type IN ('buyer','supplier')),
      jurisdiction CHAR(2) NOT NULL,
      legal_registration_number TEXT,
      admin_name TEXT NOT NULL,
      admin_email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_email_verification'
        CHECK (status IN ('pending_email_verification','pending_review','approved','rejected')),
      verification_token_hash TEXT UNIQUE,
      verification_expires_at TIMESTAMPTZ NOT NULL,
      email_verified_at TIMESTAMPTZ,
      reviewed_by_user_id UUID REFERENCES users(id),
      reviewed_at TIMESTAMPTZ,
      review_reason TEXT,
      approved_organization_id UUID REFERENCES organizations(id),
      first_admin_invitation_id UUID REFERENCES user_invitations(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (
        (status='pending_email_verification' AND email_verified_at IS NULL)
        OR (status<>'pending_email_verification' AND email_verified_at IS NOT NULL)
      ),
      CHECK (
        (status='approved' AND approved_organization_id IS NOT NULL AND first_admin_invitation_id IS NOT NULL)
        OR (status<>'approved' AND approved_organization_id IS NULL AND first_admin_invitation_id IS NULL)
      )
    );

    CREATE UNIQUE INDEX organization_access_active_admin_email_unique
      ON organization_access_applications (LOWER(admin_email))
      WHERE status IN ('pending_email_verification','pending_review');
    CREATE UNIQUE INDEX organization_access_active_name_unique
      ON organization_access_applications (LOWER(organization_name))
      WHERE status IN ('pending_email_verification','pending_review');
    CREATE INDEX organization_access_review_queue
      ON organization_access_applications (status, created_at);

    INSERT INTO roles (name, permissions) VALUES
      ('buyer_admin', ARRAY[
        'listing.read','offer.create','contract.read','shipment.read','shipment.update','payment.read',
        'payment.confirm','evidence.read','evidence.upload','provenance.export','batch.read','farm.read',
        'certificate.read','member.invite'
      ]),
      ('supplier_admin', ARRAY[
        'farm.read','farm.create','batch.read','batch.create','holding.read','holding.create','listing.read',
        'listing.create','offer.respond','contract.read','shipment.read','shipment.update','payment.read',
        'payment.request','evidence.read','evidence.upload','recall.manage','member.invite'
      ])
      ON CONFLICT (name) DO UPDATE SET permissions=EXCLUDED.permissions;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TEMP TABLE reverted_access_invitations ON COMMIT DROP AS
      SELECT first_admin_invitation_id AS id
      FROM organization_access_applications
      WHERE first_admin_invitation_id IS NOT NULL;
    DROP TABLE IF EXISTS organization_access_applications;
    DELETE FROM user_invitations
      WHERE id IN (SELECT id FROM reverted_access_invitations)
        AND accepted_at IS NULL;
    DELETE FROM roles r WHERE r.name IN ('buyer_admin','supplier_admin')
      AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.role_id=r.id)
      AND NOT EXISTS (SELECT 1 FROM user_invitations i WHERE i.role_id=r.id);
  `);
}
