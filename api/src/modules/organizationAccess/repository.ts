import { assertMutationAssurance } from '../mfa/assurance';
import { PoolClient, QueryResultRow } from 'pg';
import { getClient, query } from '../../db';
import { ConflictError, NotFoundError } from '../../errors';
import { hashObject } from '../../services/audit';
import {
  AccessReviewActor,
  ApprovedOrganizationAccess,
  OrganizationAccessApplication,
  RequestOrganizationAccess,
} from './types';

type CreateApplication = RequestOrganizationAccess & {
  verificationTokenHash: string;
  verificationExpiresAt: Date;
};

type ApproveApplication = {
  id: string;
  actor: AccessReviewActor;
  reason?: string;
  invitationTokenHash: string;
  invitationExpiresAt: Date;
};

const applicationColumns = `id,organization_name,organization_type,jurisdiction,legal_registration_number,
  admin_name,admin_email,status,verification_expires_at,email_verified_at,reviewed_by_user_id,
  reviewed_at,review_reason,approved_organization_id,first_admin_invitation_id,created_at,updated_at`;

function mapApplication(row: QueryResultRow): OrganizationAccessApplication {
  return {
    id: row.id,
    organizationName: row.organization_name,
    organizationType: row.organization_type,
    jurisdiction: row.jurisdiction,
    legalRegistrationNumber: row.legal_registration_number || undefined,
    adminName: row.admin_name,
    adminEmail: row.admin_email,
    status: row.status,
    verificationExpiresAt: row.verification_expires_at,
    emailVerifiedAt: row.email_verified_at,
    reviewedByUserId: row.reviewed_by_user_id,
    reviewedAt: row.reviewed_at,
    reviewReason: row.review_reason,
    approvedOrganizationId: row.approved_organization_id,
    firstAdminInvitationId: row.first_admin_invitation_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function recordReviewAudit(
  client: PoolClient,
  applicationId: string,
  actor: AccessReviewActor,
  action: string,
  reason?: string,
): Promise<void> {
  await client.query(
    `INSERT INTO audit_events
      (actor_user_id,actor_organization_id,action,entity_type,entity_id,new_state_hash,reason,metadata)
     VALUES ($1,$2,$3,'organization_access_application',$4,$5,$6,'{}'::jsonb)`,
    [actor.id, actor.organizationId, action, applicationId, hashObject({ applicationId, action }), reason || null],
  );
}

export interface OrganizationAccessRepository {
  create(input: CreateApplication): Promise<OrganizationAccessApplication>;
  removeUnverified(id: string): Promise<void>;
  verifyEmail(tokenHash: string): Promise<OrganizationAccessApplication | null>;
  list(): Promise<OrganizationAccessApplication[]>;
  get(id: string): Promise<OrganizationAccessApplication | null>;
  approve(input: ApproveApplication): Promise<ApprovedOrganizationAccess>;
  reject(id: string, actor: AccessReviewActor, reason?: string): Promise<OrganizationAccessApplication>;
}

export class PostgresOrganizationAccessRepository implements OrganizationAccessRepository {
  async create(input: CreateApplication): Promise<OrganizationAccessApplication> {
    const conflict = await query(
      `SELECT 1 FROM users WHERE LOWER(email)=LOWER($1)
       UNION ALL SELECT 1 FROM user_invitations WHERE LOWER(email)=LOWER($1) AND accepted_at IS NULL AND expires_at>NOW()
       UNION ALL SELECT 1 FROM organizations WHERE LOWER(name)=LOWER($2)
       LIMIT 1`,
      [input.adminEmail, input.organizationName],
    );
    if (conflict.rows[0]) throw new ConflictError('An active account, invitation, or organization already uses these details');
    try {
      const result = await query(
        `INSERT INTO organization_access_applications
          (organization_name,organization_type,jurisdiction,legal_registration_number,admin_name,admin_email,
           verification_token_hash,verification_expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (LOWER(admin_email))
           WHERE status IN ('pending_email_verification','pending_review')
         DO UPDATE SET verification_token_hash=EXCLUDED.verification_token_hash,
           verification_expires_at=EXCLUDED.verification_expires_at,updated_at=NOW()
         WHERE organization_access_applications.status='pending_email_verification'
           AND LOWER(organization_access_applications.organization_name)=LOWER(EXCLUDED.organization_name)
           AND organization_access_applications.organization_type=EXCLUDED.organization_type
           AND organization_access_applications.jurisdiction=EXCLUDED.jurisdiction
           AND organization_access_applications.admin_name=EXCLUDED.admin_name
           AND organization_access_applications.legal_registration_number IS NOT DISTINCT FROM EXCLUDED.legal_registration_number
         RETURNING ${applicationColumns}`,
        [input.organizationName, input.organizationType, input.jurisdiction, input.legalRegistrationNumber || null,
          input.adminName, input.adminEmail, input.verificationTokenHash, input.verificationExpiresAt],
      );
      if (!result.rows[0]) throw new ConflictError('An active access application already uses these details');
      return mapApplication(result.rows[0]);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ConflictError('An active access application already uses these details');
      throw error;
    }
  }

  async removeUnverified(id: string): Promise<void> {
    await query("DELETE FROM organization_access_applications WHERE id=$1 AND status='pending_email_verification'", [id]);
  }

  async verifyEmail(tokenHash: string): Promise<OrganizationAccessApplication | null> {
    const result = await query(
      `UPDATE organization_access_applications
       SET status='pending_review',email_verified_at=NOW(),verification_token_hash=NULL,updated_at=NOW()
       WHERE verification_token_hash=$1 AND status='pending_email_verification' AND verification_expires_at>NOW()
       RETURNING ${applicationColumns}`,
      [tokenHash],
    );
    return result.rows[0] ? mapApplication(result.rows[0]) : null;
  }

  async list(): Promise<OrganizationAccessApplication[]> {
    const result = await query(`SELECT ${applicationColumns} FROM organization_access_applications ORDER BY created_at DESC LIMIT 200`);
    return result.rows.map(mapApplication);
  }

  async get(id: string): Promise<OrganizationAccessApplication | null> {
    const result = await query(`SELECT ${applicationColumns} FROM organization_access_applications WHERE id=$1`, [id]);
    return result.rows[0] ? mapApplication(result.rows[0]) : null;
  }

  async approve(input: ApproveApplication): Promise<ApprovedOrganizationAccess> {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      await assertMutationAssurance(client,input.actor);
      const selected = await client.query(
        `SELECT ${applicationColumns} FROM organization_access_applications WHERE id=$1 FOR UPDATE`, [input.id],
      );
      const application = selected.rows[0];
      if (!application) throw new NotFoundError('Access application');
      if (application.status !== 'pending_review' || !application.email_verified_at) {
        throw new ConflictError('Only an email-verified application awaiting review can be approved');
      }
      const duplicate = await client.query(
        `SELECT 1 FROM organizations WHERE LOWER(name)=LOWER($1)
         UNION ALL SELECT 1 FROM users WHERE LOWER(email)=LOWER($2)
         UNION ALL SELECT 1 FROM user_invitations WHERE LOWER(email)=LOWER($2) AND accepted_at IS NULL AND expires_at>NOW()
         LIMIT 1`,
        [application.organization_name, application.admin_email],
      );
      if (duplicate.rows[0]) throw new ConflictError('The organization or administrator identity is already registered');

      const organizationType = application.organization_type === 'buyer' ? 'importer' : 'exporter';
      const roleName = application.organization_type === 'buyer' ? 'buyer_admin' : 'supplier_admin';
      const role = await client.query('SELECT id FROM roles WHERE name=$1', [roleName]);
      if (!role.rows[0]) throw new ConflictError(`Required role ${roleName} is not configured`);
      const organization = await client.query(
        `INSERT INTO organizations (name,type,jurisdiction,legal_registration_number,verification_status)
         VALUES ($1,$2,$3,$4,'verified') RETURNING id`,
        [application.organization_name, organizationType, application.jurisdiction, application.legal_registration_number],
      );
      const invitation = await client.query(
        `INSERT INTO user_invitations (organization_id,email,role_id,token_hash,invited_by_user_id,expires_at)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,expires_at`,
        [organization.rows[0].id, application.admin_email, role.rows[0].id, input.invitationTokenHash,
          input.actor.id, input.invitationExpiresAt],
      );
      const updated = await client.query(
        `UPDATE organization_access_applications SET status='approved',reviewed_by_user_id=$2,reviewed_at=NOW(),
           review_reason=$3,approved_organization_id=$4,first_admin_invitation_id=$5,updated_at=NOW()
         WHERE id=$1 RETURNING ${applicationColumns}`,
        [input.id, input.actor.id, input.reason || null, organization.rows[0].id, invitation.rows[0].id],
      );
      await recordReviewAudit(client, input.id, input.actor, 'organization_access.approve', input.reason);
      await client.query('COMMIT');
      return {
        application: mapApplication(updated.rows[0]),
        organizationId: organization.rows[0].id,
        invitationId: invitation.rows[0].id,
        invitationExpiresAt: invitation.rows[0].expires_at,
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async reject(id: string, actor: AccessReviewActor, reason?: string): Promise<OrganizationAccessApplication> {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      await assertMutationAssurance(client,actor);
      const result = await client.query(
        `UPDATE organization_access_applications SET status='rejected',reviewed_by_user_id=$2,reviewed_at=NOW(),
           review_reason=$3,verification_token_hash=NULL,updated_at=NOW()
         WHERE id=$1 AND status='pending_review' AND email_verified_at IS NOT NULL
         RETURNING ${applicationColumns}`,
        [id, actor.id, reason || null],
      );
      if (!result.rows[0]) {
        const exists = await client.query('SELECT 1 FROM organization_access_applications WHERE id=$1', [id]);
        if (!exists.rows[0]) throw new NotFoundError('Access application');
        throw new ConflictError('Only an email-verified application awaiting review can be rejected');
      }
      await recordReviewAudit(client, id, actor, 'organization_access.reject', reason);
      await client.query('COMMIT');
      return mapApplication(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
